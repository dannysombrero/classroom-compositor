/**
 * Debug utilities for monitoring media track and video element leaks.
 * Useful for development to ensure proper cleanup of MediaStreams.
 */

/**
 * Log all active media devices available to the browser.
 */
export function logActiveMediaTracks() {
  if (typeof navigator === 'undefined') return;

  navigator.mediaDevices.enumerateDevices().then(devices => {
    console.group('📹 Active Media Devices');
    devices.forEach(device => {
      console.log(`${device.kind}: ${device.label || 'Unknown'}`);
    });
    console.groupEnd();
  });
}

/**
 * Log all <video> elements in the DOM and their state.
 */
export function logDOMVideoElements() {
  const videos = document.querySelectorAll('video');
  console.group(`🎥 DOM Video Elements (${videos.length})`);
  videos.forEach((video, i) => {
    const stream = video.srcObject as MediaStream;
    console.log(`Video ${i}:`, {
      src: video.src || 'MediaStream',
      tracks: stream?.getTracks().length || 0,
      playing: !video.paused,
      parent: video.parentElement?.tagName,
    });
  });
  console.groupEnd();
}

/**
 * Enable continuous monitoring of media leaks.
 * Returns a cleanup function to stop monitoring.
 */
export function enableLeakMonitoring() {
  const interval = setInterval(() => {
    console.log('🔍 Leak Monitor Check:');
    logActiveMediaTracks();
    logDOMVideoElements();
  }, 10000);

  return () => clearInterval(interval);
}
