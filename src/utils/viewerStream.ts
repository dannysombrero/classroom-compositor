/**
 * Utilities for capturing canvas stream and managing viewer window communication.
 */
import { getRegisteredStream, registerSessionStream, releaseSessionStream } from "../stores/sessionStore";
import { postSessionMessage, resolveTargetOrigin } from "./sessionMessaging";

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
      // NOTE: Removed requestStreamFrame() call - captureStream(fps) will automatically
      // capture frames as the canvas is drawn at the specified fps. Forcing frame requests
      // can cause performance issues.
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

const PRIMARY_STREAM_ID = 'presenter:primary';
const GLOBAL_STREAM_REGISTRY_KEY = '__classroomCompositorStreams__';

type StreamRegistry = Map<string, MediaStream>;

function getWindowStreamRegistry(target: Window & typeof globalThis): StreamRegistry {
  const existing = (target as any)[GLOBAL_STREAM_REGISTRY_KEY] as StreamRegistry | undefined;
  if (existing) return existing;
  const registry: StreamRegistry = new Map();
  Object.defineProperty(target, GLOBAL_STREAM_REGISTRY_KEY, {
    value: registry,
    configurable: true,
    enumerable: false,
    writable: false,
  });
  return registry;
}

function setStreamInPresenterRegistry(id: string, stream: MediaStream | null): void {
  if (typeof window === 'undefined') return;
  const registry = getWindowStreamRegistry(window);
  if (stream) {
    registry.set(id, stream);
  } else {
    registry.delete(id);
  }
}

export function getStreamFromOpener(streamId: string): MediaStream | null {
  if (typeof window === 'undefined') return null;
  const opener = window.opener as (Window & typeof globalThis) | null;
  if (!opener || opener.closed) return null;
  try {
    const registry = (opener as any)[GLOBAL_STREAM_REGISTRY_KEY] as StreamRegistry | undefined;
    if (!registry) return null;
    return registry.get(streamId) ?? null;
  } catch (error) {
    console.warn('Failed to access opener stream registry', error);
    return null;
  }
}

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
  return getRegisteredStream(PRIMARY_STREAM_ID);
}

/**
 * Set the current stream.
 */
export function setCurrentStream(stream: MediaStream | null): void {
  if (stream) {
    registerSessionStream(PRIMARY_STREAM_ID, stream, { label: 'Primary Presenter Stream' });
  } else {
    releaseSessionStream(PRIMARY_STREAM_ID);
  }
  setStreamInPresenterRegistry(PRIMARY_STREAM_ID, stream);
  // NOTE: Removed requestStreamFrame() call - the canvas captureStream automatically
  // captures frames as the canvas is drawn. No need to force frame requests.
}

/**
 * Request a frame from the current canvas capture stream.
 * Helpful when using dirty rendering so the viewer sees the latest frame.
 */
export function requestCurrentStreamFrame(): void {
  requestStreamFrame(getCurrentStream());
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

    // Debug logging removed to prevent heap accumulation during rapid open/close cycles
    // (console.log objects were accumulating in memory during testing)

    // Store stream globally so viewer can access it later
    setCurrentStream(stream);

    postSessionMessage(targetWindow, {
      type: 'stream-announce',
      streamId: PRIMARY_STREAM_ID,
      label: 'Primary Presenter Stream',
      hasStream: true,
      transferSupported: false,
    });

    postSessionMessage(
      targetWindow,
      {
        type: 'deliver-stream',
        streamId: PRIMARY_STREAM_ID,
        transferSupported: false,
      },
      { origin: resolvedOrigin },
    );

    const legacyMessage: ViewerMessage = { type: 'stream', streamAvailable: true };
    targetWindow.postMessage(legacyMessage, resolvedOrigin);

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
    postSessionMessage(window, {
      type: 'stream-ended',
      streamId: PRIMARY_STREAM_ID,
    });
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

// Legacy global accessors removed – viewers retrieve streams via postMessage handshake.
