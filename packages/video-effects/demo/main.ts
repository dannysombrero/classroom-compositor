import { createBgEffect } from '../src';

type StatKey = 'mode' | 'engine' | 'inference' | 'fps';

const statNodes = new Map<StatKey, HTMLElement>();

function registerStats() {
  const entries: Array<[StatKey, string]> = [
    ['mode', 'stat-mode'],
    ['engine', 'stat-engine'],
    ['inference', 'stat-inference'],
    ['fps', 'stat-fps'],
  ];

  for (const [key, id] of entries) {
    const node = document.getElementById(id);
    if (node instanceof HTMLElement) {
      statNodes.set(key, node);
    }
  }
}

function setStat(key: StatKey, value: string) {
  const node = statNodes.get(key);
  if (node) {
    node.textContent = value;
  }
}

function formatInferenceTarget(inferenceFps: number | undefined): string {
  if (typeof inferenceFps === 'number' && inferenceFps > 0) {
    return `${inferenceFps.toFixed(0)} fps`;
  }
  return 'auto';
}

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: VideoFrameCallbackMetadata) => void) => number;
};

function monitorFps(video: HTMLVideoElement) {
  const videoEl = video as VideoWithFrameCallback;
  let frameCount = 0;
  let lastTimestamp = performance.now();
  let rafId: number | null = null;

  const update = (timestamp: number) => {
    frameCount += 1;
    const elapsed = timestamp - lastTimestamp;
    if (elapsed >= 1000) {
      const fps = (frameCount * 1000) / elapsed;
      setStat('fps', fps.toFixed(1));
      frameCount = 0;
      lastTimestamp = timestamp;
    }
  };

  const loop = () => {
    if (typeof videoEl.requestVideoFrameCallback === 'function') {
      videoEl.requestVideoFrameCallback((now) => {
        update(now);
        loop();
      });
      return;
    }

    rafId = requestAnimationFrame((now) => {
      update(now);
      loop();
    });
  };

  loop();

  return () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
  };
}

async function bootstrap() {
  const videoEl = document.getElementById('preview') as HTMLVideoElement | null;
  if (!videoEl) {
    console.warn('Preview element not found');
    return;
  }

  registerStats();
  setStat('mode', 'initialising');
  setStat('engine', '--');
  setStat('inference', '--');
  setStat('fps', '--');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const [track] = stream.getVideoTracks();
    if (!track) {
      videoEl.srcObject = stream;
      return;
    }

    const enginePreference: Parameters<typeof createBgEffect>[0] = 'mediapipe';
    const engine = createBgEffect(enginePreference);
    const engineStartOptions = { mode: 'off', quality: 'balanced', inferenceFps: undefined as number | undefined };
    const processedTrack = await engine.start(track, engineStartOptions);

    const processedStream = new MediaStream([processedTrack]);
    videoEl.srcObject = processedStream;

    setStat('engine', enginePreference);
    setStat('mode', engineStartOptions.mode);
    setStat('inference', formatInferenceTarget(engineStartOptions.inferenceFps));
    monitorFps(videoEl);
  } catch (error) {
    console.error('Failed to initialise background effect:', error);
    setStat('mode', 'error');
    setStat('fps', '0');
  }
}

void bootstrap();
