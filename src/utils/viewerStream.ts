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
      const stream: MediaStream = (canvas as any).captureStream(fps);
      requestStreamFrame(stream);
      return stream;
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

function isWindowAlive(target: Window | null | undefined): target is Window {
  try {
    return Boolean(target && !target.closed);
  } catch {
    return false;
  }
}

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
  if (stream) {
    requestStreamFrame(stream);
  }
}

/**
 * Request a frame from the current canvas capture stream.
 * Helpful when using dirty rendering so the viewer sees the latest frame.
 */
export function requestCurrentStreamFrame(): void {
  requestStreamFrame(globalStreamRef);
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
  targetWindow: Window,
  stream: MediaStream
): void {
  try {
    if (!isWindowAlive(targetWindow)) {
      console.warn('Attempted to send stream to a closed viewer window.');
      return;
    }

    const resolvedOrigin = resolveTargetOrigin(targetWindow);

    console.log('Sending stream to viewer:', {
      hasStream: !!stream,
      videoTracks: stream.getVideoTracks().length,
      targetOrigin: resolvedOrigin,
    });
    
    // Store stream globally so viewer can access it
    setCurrentStream(stream);
    
    // Notify viewer that stream is available
    // The viewer will retrieve it via window.opener
    const message: ViewerMessage = {
      type: 'stream',
      streamAvailable: true,
    };
    targetWindow.postMessage(message, resolvedOrigin);
    
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
    if (!isWindowAlive(window)) {
      return;
    }
    const resolvedOrigin = resolveTargetOrigin(window);
    const message: ViewerMessage = { type: 'stream-ended' };
    window.postMessage(message, resolvedOrigin);
  } catch (error) {
    console.error('Failed to notify stream ended:', error);
  }
}

/**
 * Request a frame from a canvas capture stream if supported.
 */
function requestStreamFrame(stream: MediaStream | null): void {
  if (!stream) return;
  
  const track = stream.getVideoTracks?.()[0] as CanvasCaptureMediaStreamTrack | undefined;
  if (track && typeof track.requestFrame === 'function') {
    try {
      track.requestFrame();
    } catch (error) {
      console.warn('Failed to request canvas stream frame:', error);
    }
  }
}

/**
 * Determine the best origin to target when posting messages to the viewer window.
 */
function resolveTargetOrigin(targetWindow: Window): string {
  try {
    const targetOrigin = targetWindow.location?.origin;
    if (targetOrigin && targetOrigin !== 'null') {
      return targetOrigin;
    }
  } catch (error) {
    console.warn('Failed to read viewer origin, falling back to presenter origin:', error);
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '*';
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
