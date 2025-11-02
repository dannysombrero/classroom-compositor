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
  | { type: 'stream'; stream: MediaStream }
  | { type: 'stream-ended' }
  | { type: 'handshake' }
  | { type: 'viewer-ready' };

/**
 * Send a MediaStream to a viewer window via postMessage.
 * Note: MediaStream cannot be transferred via postMessage directly.
 * Instead, we need to use the BroadcastChannel API or a different approach.
 * For now, we'll pass the stream reference (same origin only).
 * 
 * @param window - Target window to send message to
 * @param stream - MediaStream to send
 */
export function sendStreamToViewer(
  window: Window,
  stream: MediaStream
): void {
  try {
    // Send stream object (same-origin only, will work for our use case)
    window.postMessage(
      {
        type: 'stream',
        stream: stream,
      } as ViewerMessage,
      window.location.origin
    );
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

