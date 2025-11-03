import { createBgEffect } from '../src';

const videoEl = document.getElementById('preview') as HTMLVideoElement | null;

async function bootstrap() {
  if (!videoEl) {
    console.warn('Preview element not found');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const [track] = stream.getVideoTracks();
    if (!track) {
      videoEl.srcObject = stream;
      return;
    }

    // Mock engine for now – returns the source track untouched.
    const engine = createBgEffect('mediapipe');
    const processedTrack = await engine.start(track, { mode: 'off', quality: 'balanced' });
    videoEl.srcObject = new MediaStream([processedTrack]);
  } catch (error) {
    console.error('Failed to initialise background effect:', error);
  }
}

void bootstrap();
