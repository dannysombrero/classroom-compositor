import type { BgEffectStartOptions, Mode, Quality } from '../types';

const processorSupported =
  typeof MediaStreamTrackProcessor !== 'undefined' && typeof MediaStreamTrackGenerator !== 'undefined';

export interface BackgroundEffectPipelineOptions extends BgEffectStartOptions {
  engine: NonNullable<BgEffectStartOptions['engine']>;
  mode: Mode;
  quality: Quality;
}

export interface BackgroundEffectPipeline {
  readonly track: MediaStreamTrack;
  update(opts: Partial<Omit<BgEffectStartOptions, 'engine'>>): void;
  stop(): void;
}

class PassthroughPipeline implements BackgroundEffectPipeline {
  readonly track: MediaStreamTrack;

  constructor(track: MediaStreamTrack) {
    this.track = track;
  }

  update(): void {
    // no-op
  }

  stop(): void {
    // Consumers are responsible for stopping the original track.
  }
}

export async function createBackgroundEffectPipeline(
  source: MediaStreamTrack,
  _opts: BackgroundEffectPipelineOptions,
): Promise<BackgroundEffectPipeline> {
  if (!processorSupported) {
    return new PassthroughPipeline(source);
  }

  const processor = new MediaStreamTrackProcessor({ track: source });
  const generator = new MediaStreamTrackGenerator({ kind: 'video' });
  const reader = processor.readable.getReader();
  const writer = generator.writable.getWriter();
  const processedStream = new MediaStream([generator]);
  const processedTrack = processedStream.getVideoTracks()[0] ?? generator;

  let stopped = false;

  const pump = async () => {
    try {
      while (!stopped) {
        const { value: frame, done } = await reader.read();
        if (done || !frame) break;
        try {
          await writer.write(frame);
        } finally {
          frame.close();
        }
      }
    } catch (error) {
      console.warn('Background pipeline pump failed', error);
    } finally {
      await writer.close().catch(() => {});
      await reader.releaseLock();
    }
  };

  void pump();

  return {
    track: processedTrack,
    update(): void {
      // Pipeline is pass-through for now; future updates will adjust processing state.
    },
    stop(): void {
      if (stopped) return;
      stopped = true;
      reader.cancel().catch(() => {});
      writer.close().catch(() => {});
      generator.stop();
    },
  };
}
