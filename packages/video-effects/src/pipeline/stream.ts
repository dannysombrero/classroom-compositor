import type { BgEffectStartOptions, Mode, Quality } from '../types';
import type { SegmentationResult, ISegmenter } from './segmenter';
import type { Compositor } from './compositor';
import { createSegmenter } from './segmenter';
import { createCompositor } from './compositor';
import { emaSmoothMask, refineMask } from './smoothing';

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

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

class PassthroughPipeline implements BackgroundEffectPipeline {
  readonly track: MediaStreamTrack;

  constructor(track: MediaStreamTrack) {
    this.track = track;
  }

  update(): void {
    // no-op – passthrough ignores updates.
  }

  stop(): void {
    // Consumers are responsible for stopping the original track.
  }
}

interface PipelineState {
  mode: Mode;
  quality: Quality;
  background?: BgEffectStartOptions['background'];
  inferenceFps?: number | undefined;
}

class InsertableStreamsPipeline implements BackgroundEffectPipeline {
  readonly track: MediaStreamTrack;

  private readonly processor: MediaStreamTrackProcessor<VideoFrame>;
  private readonly generator: MediaStreamTrackGenerator<VideoFrame>;
  private readonly reader: ReadableStreamDefaultReader<VideoFrame>;
  private readonly writer: WritableStreamDefaultWriter<VideoFrame>;
  private readonly segmenter: ISegmenter;
  private readonly compositor: Compositor;
  private readonly derivedTrack: MediaStreamTrack | null;
  private readonly inferenceDefault = 15;

  private readonly pumpPromise: Promise<void>;

  private stopped = false;
  private options: PipelineState;
  private lastMask: SegmentationResult | null = null;
  private lastInferenceTime = 0;
  private previousMaskData: Float32Array | null = null;

  constructor(
    sourceTrack: MediaStreamTrack,
    segmenter: ISegmenter,
    compositor: Compositor,
    initialState: PipelineState,
  ) {
    this.segmenter = segmenter;
    this.compositor = compositor;
    this.options = initialState;

    this.processor = new MediaStreamTrackProcessor({ track: sourceTrack });
    this.generator = new MediaStreamTrackGenerator({ kind: 'video' });
    this.reader = this.processor.readable.getReader();
    this.writer = this.generator.writable.getWriter();
    const stream = new MediaStream([this.generator]);
    this.derivedTrack = stream.getVideoTracks()[0] ?? null;
    this.track = this.derivedTrack ?? sourceTrack;

    this.pumpPromise = this.startPump();
  }

  private get inferenceIntervalMs(): number {
    const fps = this.options.inferenceFps ?? this.inferenceDefault;
    return fps > 0 ? 1000 / fps : Number.POSITIVE_INFINITY;
  }

  private async startPump(): Promise<void> {
    const shouldProcess = () => this.options.mode !== 'off';

    try {
      while (!this.stopped) {
        const { value: frame, done } = await this.reader.read();
        if (done || !frame) break;

        let outputFrame: VideoFrame | null = null;
        let currentMask: SegmentationResult | null = null;

        try {
          if (shouldProcess()) {
            const nowTs = now();
            if (!this.lastMask || nowTs - this.lastInferenceTime >= this.inferenceIntervalMs) {
              const rawMask = await this.segmenter.segment(frame);
              const smoothed = emaSmoothMask(rawMask.mask, {
                previous: this.previousMaskData,
              });
              const refined = refineMask(smoothed, {
                width: rawMask.maskWidth,
                height: rawMask.maskHeight,
              });

              this.previousMaskData = refined;
              this.lastMask = {
                mask: refined,
                maskWidth: rawMask.maskWidth,
                maskHeight: rawMask.maskHeight,
              };
              this.lastInferenceTime = nowTs;
            }
            currentMask = this.lastMask;
          }

          const compositeInput =
            currentMask != null
              ? {
                  frame,
                  mask: {
                    data: currentMask.mask,
                    width: currentMask.maskWidth,
                    height: currentMask.maskHeight,
                  },
                }
              : { frame };

          outputFrame = await this.compositor.composite(compositeInput);
          await this.writer.write(outputFrame);
        } catch (error) {
          console.warn('Background pipeline frame failed', error);
          await this.writer.write(frame);
        } finally {
          frame.close();
          if (outputFrame && outputFrame !== frame) {
            outputFrame.close();
          }
        }
      }
    } catch (error) {
      console.warn('Background pipeline pump failed', error);
    } finally {
      await this.writer.close().catch(() => {});
      await this.reader.releaseLock();
    }
  }

  update(opts: Partial<Omit<BgEffectStartOptions, 'engine'>>): void {
    const nextState: PipelineState = {
      mode: opts.mode ?? this.options.mode,
      quality: opts.quality ?? this.options.quality,
      background: 'background' in opts ? opts.background : this.options.background,
      inferenceFps: 'inferenceFps' in opts ? opts.inferenceFps : this.options.inferenceFps,
    };

    this.options = nextState;
    this.lastMask = null;
    this.previousMaskData = null;
    this.compositor.update({
      mode: this.options.mode,
      background: this.options.background,
    });
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.reader.cancel().catch(() => {});
    this.writer.close().catch(() => {});
    this.generator.stop();
    this.segmenter.dispose();
    this.compositor.dispose();
    this.derivedTrack?.stop();
    this.previousMaskData = null;
  }
}

export async function createBackgroundEffectPipeline(
  source: MediaStreamTrack,
  opts: BackgroundEffectPipelineOptions,
): Promise<BackgroundEffectPipeline> {
  if (!processorSupported) {
    return new PassthroughPipeline(source);
  }

  const segmenter = await createSegmenter(opts.engine);
  await segmenter.init({ quality: opts.quality });

  const compositor = await createCompositor({
    mode: opts.mode,
    background: opts.background,
  });

  const initialState: PipelineState = {
    mode: opts.mode,
    quality: opts.quality,
  };

  if ('background' in opts) {
    initialState.background = opts.background;
  }

  if ('inferenceFps' in opts) {
    initialState.inferenceFps = opts.inferenceFps;
  }

  return new InsertableStreamsPipeline(source, segmenter, compositor, initialState);
}
