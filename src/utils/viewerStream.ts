/**
 * Utilities for capturing canvas stream and managing viewer window communication.
 */

/**
 * Default frame rate for canvas capture stream.
 */
export const DEFAULT_STREAM_FPS = 30;

/**
 * Options for capturing a canvas stream.
 */
export interface StreamCaptureOptions {
  /** Frame rate for the stream (default: 30) */
  fps?: number;
}

/**
 * Capture a MediaStream from a canvas element.
 * 
 * @param canvas - Canvas element to capture
 * @param options - Capture options
 * @returns MediaStream from the canvas
 */
export function captureCanvasStream(
  canvas: HTMLCanvasElement,
  options: StreamCaptureOptions = {}
): MediaStream | null {
  const fps = options.fps ?? DEFAULT_STREAM_FPS;

  try {
    // Use captureStream if available (Chrome, Firefox, Edge)
    if ('captureStream' in canvas) {
      return (canvas as any).captureStream(fps);
    }

    // Fallback: captureStream may not be available in all browsers
    console.warn('Canvas captureStream not available');
    return null;
  } catch (error) {
    console.error('Failed to capture canvas stream:', error);
    return null;
  }
}

/**
 * Message types for viewer window communication.
 */
export type ViewerMessage =
  | { type: 'stream'; streamAvailable?: boolean; stream?: MediaStream }
  | { type: 'stream-ended' }
  | { type: 'handshake' }
  | { type: 'viewer-ready' }
  | { type: 'request-stream' };

/**
 * Global storage for the current stream (accessible to viewer via window.opener).
 * This is a workaround since MediaStream cannot be transferred via postMessage.
 */
let globalStreamRef: MediaStream | null = null;

/**
 * Get the current stream (for viewer window to access via opener).
 */
export function getCurrentStream(): MediaStream | null {
  return globalStreamRef;
}

/**
 * Set the current stream.
 */
export function setCurrentStream(stream: MediaStream | null): void {
  globalStreamRef = stream;
}

/**
 * Send a MediaStream to a viewer window.
 * Since MediaStream cannot be cloned via postMessage, we store it globally
 * and notify the viewer to retrieve it via window.opener.
 * 
 * @param window - Target window to send message to
 * @param stream - MediaStream to send
 */
export function sendStreamToViewer(
  window: Window,
  stream: MediaStream
): void {
  try {
    console.log('Sending stream to viewer:', {
      hasStream: !!stream,
      videoTracks: stream.getVideoTracks().length,
      targetOrigin: window.location.origin,
    });
    
    // Store stream globally so viewer can access it
    setCurrentStream(stream);
    
    // Notify viewer that stream is available
    // The viewer will retrieve it via window.opener
    window.postMessage(
      {
        type: 'stream',
        streamAvailable: true,
      } as any,
      window.location.origin
    );
    
    console.log('Stream notification sent successfully');
  } catch (error) {
    console.error('Failed to send stream to viewer:', error);
  }
}

/**
 * Send a stream-ended message to viewer.
 */
export function notifyStreamEnded(window: Window): void {
  try {
    window.postMessage(
      { type: 'stream-ended' } as ViewerMessage,
      window.location.origin
    );
  } catch (error) {
    console.error('Failed to notify stream ended:', error);
  }
}

/**
 * Expose getCurrentStream globally so viewer can access it via window.opener
 * This is a workaround for MediaStream not being transferable via postMessage.
 */
if (typeof window !== 'undefined') {
  (window as any).getCurrentStream = getCurrentStream;
  (window as any).viewerStream = { getCurrentStream };
  // Also expose stream directly for easier access
  Object.defineProperty(window, 'currentStream', {
    get: () => globalStreamRef,
    set: (value: MediaStream | null) => {
      globalStreamRef = value;
    },
    configurable: true,
  });
}

