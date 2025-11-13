/**
 * Manages live MediaStream sources (screen share and webcam) for layers.
 *
 * Stores streams and backing <video> elements outside of the Zustand store so
 * state remains serializable while draw routines can fetch the latest frame.
 */

import {
  incrementTrackRef,
  decrementTrackRef,
  onTrackCleanup
} from '../utils/trackReferenceCounter';

type SourceType = 'screen' | 'camera';

interface ActiveSource {
  stream: MediaStream;
  video: HTMLVideoElement;
  type: SourceType;
  rawTrack: MediaStreamTrack | null;
}

const sources = new Map<string, ActiveSource>();

/**
 * Create a muted, inline video element bound to a MediaStream.
 */
async function createVideoElement(stream: MediaStream): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;

  try {
    await video.play();
  } catch (error) {
    // Autoplay policies may block play() until user gesture; caller can retry.
    console.warn('Video play blocked, awaiting user gesture:', error);
  }

  return video;
}

async function registerSource(
  layerId: string,
  stream: MediaStream,
  type: SourceType
): Promise<ActiveSource> {
  stopSource(layerId);

  const video = await createVideoElement(stream);
  const track = stream.getVideoTracks()[0] ?? null;

  if (track) {
    // Increment reference count for the track
    incrementTrackRef(track);

    // Register cleanup callback to run when track ref count reaches 0
    onTrackCleanup(track, () => {
      video.srcObject = null;
      video.remove?.();
      sources.delete(layerId);
    });
  }

  const active: ActiveSource = {
    stream,
    video,
    type,
    rawTrack: track,
  };
  sources.set(layerId, active);
  return active;
}

/**
 * Start screen/window capture for a given layer ID.
 */
export async function startScreenCapture(layerId: string): Promise<ActiveSource | null> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
    });

    return registerSource(layerId, stream, 'screen');
  } catch (error) {
    console.error('Failed to start screen capture:', error);
    return null;
  }
}

/**
 * Start webcam capture for a given layer ID.
 */
export async function startCameraCapture(layerId: string): Promise<ActiveSource | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });

    return registerSource(layerId, stream, 'camera');
  } catch (error) {
    console.error('Failed to start camera capture:', error);
    return null;
  }
}

/**
 * Replace ONLY the video track in the active stream for a layer.
 *
 * Uses reference counting to ensure old tracks are properly cleaned up
 * when no longer in use (e.g., by effects pipelines).
 */
export function replaceVideoTrack(layerId: string, newTrack: MediaStreamTrack): boolean {
  const active = sources.get(layerId);
  if (!active) return false;

  const { stream, video } = active;

  try {
    // Increment ref count for the new track
    incrementTrackRef(newTrack);

    // Remove existing video tracks from the stream
    const oldVideoTracks = stream.getVideoTracks();
    for (const t of oldVideoTracks) {
      try {
        stream.removeTrack(t);
        // Decrement ref count for old track (may still be used by effects pipeline)
        decrementTrackRef(t);
      } catch (e) {
        console.warn('Failed to remove/decrement old track:', e);
      }
    }

    // Add the new processed track
    stream.addTrack(newTrack);

    // Update rawTrack reference
    active.rawTrack = newTrack;

    // Re-bind to ensure element reflects the new track (helps in some browsers)
    video.srcObject = stream;

    // Try to play again in case autoplay was interrupted
    void video.play().catch(() => { /* ignore */ });

    return true;
  } catch (err) {
    console.warn('replaceVideoTrack: failed to replace track', err);
    return false;
  }
}

/**
 * Stop an active capture and release its resources.
 * Uses reference counting to ensure tracks are only stopped when all refs are released.
 */
export function stopSource(layerId: string): void {
  const existing = sources.get(layerId);
  if (!existing) return;

  // Decrement ref count for all tracks in the stream
  existing.stream.getTracks().forEach((track) => {
    try {
      decrementTrackRef(track);
    } catch (e) {
      console.warn('Failed to decrement track ref:', e);
    }
  });

  // Decrement ref for raw track if it's different
  if (existing.rawTrack && !existing.stream.getTracks().includes(existing.rawTrack)) {
    try {
      decrementTrackRef(existing.rawTrack);
    } catch (e) {
      console.warn('Failed to decrement raw track ref:', e);
    }
  }

  // Cleanup will be handled by onTrackCleanup callback when ref count reaches 0
}

/**
 * Get the <video> element associated with a layer.
 */
export function getVideoForLayer(layerId: string): HTMLVideoElement | null {
  return sources.get(layerId)?.video ?? null;
}

/**
 * Check if a layer currently has an active capture source.
 */
export function hasActiveSource(layerId: string): boolean {
  return sources.has(layerId);
}

/**
 * Retrieve the active video track for a layer, if one exists.
 */
export function getActiveVideoTrack(layerId: string): MediaStreamTrack | null {
  const active = sources.get(layerId);
  if (!active) return null;
  return active.rawTrack ?? active.stream.getVideoTracks?.()[0] ?? null;
}
