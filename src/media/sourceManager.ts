/**
 * Manages live MediaStream sources (screen share and webcam) for layers.
 *
 * Stores streams and backing <video> elements outside of the Zustand store so
 * state remains serializable while draw routines can fetch the latest frame.
 */

type SourceType = 'screen' | 'camera';

interface ActiveSource {
  stream: MediaStream;
  video: HTMLVideoElement;
  type: SourceType;
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
  const active: ActiveSource = { stream, video, type };
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
 * Important:
 * - We DO NOT stop() the old video track here, because another pipeline
 *   (e.g., the fake-blur/ML engine) may still be reading from it.
 * - We just remove it from the rendering stream and add the new processed track.
 */
export function replaceVideoTrack(layerId: string, newTrack: MediaStreamTrack): boolean {
  const active = sources.get(layerId);
  if (!active) return false;

  const { stream, video } = active;

  try {
    // Remove existing video tracks from the stream (do not stop them).
    const oldVideoTracks = stream.getVideoTracks();
    for (const t of oldVideoTracks) {
      try {
        stream.removeTrack(t);
      } catch {
        /* ignore */
      }
    }

    // Add the processed track
    stream.addTrack(newTrack);

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
 */
export function stopSource(layerId: string): void {
  const existing = sources.get(layerId);
  if (!existing) return;

  existing.stream.getTracks().forEach((track) => {
    try { track.stop(); } catch { /* ignore */ }
  });
  try {
    existing.video.srcObject = null;
  } catch { /* ignore */ }

  sources.delete(layerId);
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