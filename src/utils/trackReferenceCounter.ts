/**
 * Reference counting system for MediaStreamTrack objects.
 * Ensures tracks are only stopped when all references are released.
 */

const trackRefCounts = new Map<MediaStreamTrack, number>();
const trackCleanupCallbacks = new Map<MediaStreamTrack, (() => void)[]>();

/**
 * Increment the reference count for a track.
 */
export function incrementTrackRef(track: MediaStreamTrack): void {
  const currentCount = trackRefCounts.get(track) || 0;
  trackRefCounts.set(track, currentCount + 1);
  console.log(`🔵 Track ${track.id} ref count: ${currentCount} → ${currentCount + 1}`);
}

/**
 * Decrement the reference count for a track.
 * When count reaches 0, stops the track and runs cleanup callbacks.
 */
export function decrementTrackRef(track: MediaStreamTrack): void {
  const currentCount = trackRefCounts.get(track) || 0;

  if (currentCount <= 0) {
    console.warn(`⚠️ Attempted to decrement track ${track.id} with zero refs`);
    return;
  }

  const newCount = currentCount - 1;
  trackRefCounts.set(track, newCount);
  console.log(`🔴 Track ${track.id} ref count: ${currentCount} → ${newCount}`);

  if (newCount === 0) {
    const callbacks = trackCleanupCallbacks.get(track) || [];
    callbacks.forEach(cb => cb());

    track.stop();

    trackRefCounts.delete(track);
    trackCleanupCallbacks.delete(track);
    console.log(`🛑 Track ${track.id} stopped and cleaned up`);
  }
}

/**
 * Register a cleanup callback to run when a track's ref count reaches 0.
 */
export function onTrackCleanup(track: MediaStreamTrack, callback: () => void): void {
  const callbacks = trackCleanupCallbacks.get(track) || [];
  callbacks.push(callback);
  trackCleanupCallbacks.set(track, callbacks);
}

/**
 * Get the current reference count for a track.
 */
export function getTrackRefCount(track: MediaStreamTrack): number {
  return trackRefCounts.get(track) || 0;
}

/**
 * Force cleanup of a track regardless of ref count.
 * WARNING: Use only when absolutely necessary.
 */
export function forceCleanupTrack(track: MediaStreamTrack): void {
  console.warn(`Force cleaning up track ${track.id}`);

  const callbacks = trackCleanupCallbacks.get(track) || [];
  callbacks.forEach(cb => cb());

  track.stop();

  trackRefCounts.delete(track);
  trackCleanupCallbacks.delete(track);
}
