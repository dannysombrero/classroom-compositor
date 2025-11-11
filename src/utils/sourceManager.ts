let lastGestureTime = 0;
export function noteUserGesture() { lastGestureTime = Date.now(); }
function hasRecentGesture(ms = 4000) { return Date.now() - lastGestureTime < ms; }

export async function requestDisplayCapture(opts?: DisplayMediaStreamOptions): Promise<MediaStream> {
  if (!hasRecentGesture()) {
    throw new Error("getDisplayMedia must be triggered by a user gesture (click/keydown)");
  }
  return await (navigator.mediaDevices as any).getDisplayMedia(opts ?? { video: true, audio: false });
}