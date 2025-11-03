import type {
  BgEffect,
  BgEffectFactory,
  BgEffectStartOptions,
  Engine,
  Mode,
  Quality,
} from './types';
import type { BackgroundEffectPipeline } from './pipeline';
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
  private background?: BgEffectStartOptions['background'];
  private inferenceFps?: number;
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

    try {
      this.pipeline = await createBackgroundEffectPipeline(track, {
        engine: this.activeEngine,
        mode: this.mode,
        quality: this.quality,
        background: this.background,
        inferenceFps: this.inferenceFps,
      });
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
    if (opts.background !== undefined) this.background = opts.background;
    if (typeof opts.inferenceFps === 'number') this.inferenceFps = opts.inferenceFps;
    this.pipeline?.update({
      mode: this.mode,
      quality: this.quality,
      background: this.background,
      inferenceFps: this.inferenceFps,
    });
  }

  stop(): void {
    this.pipeline?.stop();
    this.pipeline = null;
    this.processedTrack = null;
    this.sourceTrack = null;
  }
}

export const createBgEffect: BgEffectFactory = (engine?: Engine) => new MockBgEffect(engine);
