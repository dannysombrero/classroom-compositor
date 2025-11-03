import type {
  BgEffect,
  BgEffectFactory,
  BgEffectStartOptions,
  Engine,
  Mode,
  Quality,
} from './types';
import type { BackgroundEffectPipeline, BackgroundEffectPipelineOptions } from './pipeline';
import { createBackgroundEffectPipeline } from './pipeline';

const DEFAULT_MODE: Mode = 'off';
const DEFAULT_QUALITY: Quality = 'balanced';
const DEFAULT_ENGINE: Engine = 'mediapipe';

class MockBgEffect implements BgEffect {
  private readonly engine: Engine | undefined;
  private sourceTrack: MediaStreamTrack | null = null;
  private processedTrack: MediaStreamTrack | null = null;
  private mode: Mode = DEFAULT_MODE;
  private quality: Quality = DEFAULT_QUALITY;
  private background: BgEffectStartOptions['background'] = undefined;
  private inferenceFps: number | undefined = undefined;
  private pipeline: BackgroundEffectPipeline | null = null;
  private activeEngine: Engine = DEFAULT_ENGINE;

  constructor(engine?: Engine) {
    this.engine = engine;
  }

  async start(track: MediaStreamTrack, opts: BgEffectStartOptions = {}): Promise<MediaStreamTrack> {
    this.stop();
    this.sourceTrack = track;

    this.mode = opts.mode ?? DEFAULT_MODE;
    this.quality = opts.quality ?? DEFAULT_QUALITY;
    this.background = opts.background;
    this.inferenceFps = opts.inferenceFps;
    this.activeEngine = opts.engine ?? this.engine ?? DEFAULT_ENGINE;

    const pipelineOptions = {
      engine: this.activeEngine,
      mode: this.mode,
      quality: this.quality,
      ...(this.background !== undefined ? { background: this.background } : {}),
      ...(typeof this.inferenceFps === 'number' ? { inferenceFps: this.inferenceFps } : {}),
    } satisfies BackgroundEffectPipelineOptions;

    try {
      this.pipeline = await createBackgroundEffectPipeline(track, pipelineOptions);
    } catch (error) {
      this.pipeline = null;
      this.processedTrack = null;
      this.sourceTrack = null;
      throw error;
    }

    if (!this.pipeline) {
      throw new Error('Background effect pipeline did not initialise.');
    }

    this.processedTrack = this.pipeline.track;
    return this.processedTrack;
  }

  update(opts: Partial<Omit<BgEffectStartOptions, 'engine'>>): void {
    if (typeof opts.mode === 'string') this.mode = opts.mode;
    if (typeof opts.quality === 'string') this.quality = opts.quality;
    if ('background' in opts) this.background = opts.background;
    if ('inferenceFps' in opts) this.inferenceFps = opts.inferenceFps;

    const updatePayload: Partial<Omit<BgEffectStartOptions, 'engine'>> = {
      mode: this.mode,
      quality: this.quality,
    };

    if ('background' in opts || this.background !== undefined) {
      updatePayload.background = this.background;
    }

    if ('inferenceFps' in opts || typeof this.inferenceFps === 'number') {
      updatePayload.inferenceFps = this.inferenceFps;
    }

    this.pipeline?.update(updatePayload);
  }

  stop(): void {
    this.pipeline?.stop();
    this.pipeline = null;
    this.processedTrack = null;
    this.sourceTrack = null;
  }
}

export const createBgEffect: BgEffectFactory = (engine?: Engine) => new MockBgEffect(engine);
