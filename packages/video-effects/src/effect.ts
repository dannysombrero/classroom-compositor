import type { BgEffect, BgEffectFactory, BgEffectStartOptions, Engine, Mode, Quality } from './types';

const DEFAULT_MODE: Mode = 'off';
const DEFAULT_QUALITY: Quality = 'balanced';

class MockBgEffect implements BgEffect {
  private readonly engine: Engine | undefined;
  private sourceTrack: MediaStreamTrack | null = null;
  private processedTrack: MediaStreamTrack | null = null;
  private mode: Mode = DEFAULT_MODE;
  private quality: Quality = DEFAULT_QUALITY;
  private background?: BgEffectStartOptions['background'];
  private inferenceFps?: number;

  constructor(engine?: Engine) {
    this.engine = engine;
  }

  async start(track: MediaStreamTrack, opts: BgEffectStartOptions = {}): Promise<MediaStreamTrack> {
    this.sourceTrack = track;
    this.mode = opts.mode ?? DEFAULT_MODE;
    this.quality = opts.quality ?? DEFAULT_QUALITY;
    this.background = opts.background;
    this.inferenceFps = opts.inferenceFps;
    // For now we simply pass through the existing track until the processing pipeline is wired.
    this.processedTrack = track;
    return track;
  }

  update(opts: Partial<Omit<BgEffectStartOptions, 'engine'>>): void {
    if (typeof opts.mode === 'string') this.mode = opts.mode;
    if (typeof opts.quality === 'string') this.quality = opts.quality;
    if (opts.background !== undefined) this.background = opts.background;
    if (typeof opts.inferenceFps === 'number') this.inferenceFps = opts.inferenceFps;
  }

  stop(): void {
    this.processedTrack = null;
    this.sourceTrack = null;
  }
}

export const createBgEffect: BgEffectFactory = (engine?: Engine) => new MockBgEffect(engine);
