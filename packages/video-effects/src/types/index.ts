export type Engine = 'mediapipe' | 'onnx-modnet';

export type Mode = 'off' | 'blur' | 'replace' | 'chroma';

export type Quality = 'fast' | 'balanced' | 'high';

export interface BgEffectStartOptions {
  engine?: Engine;
  mode?: Mode;
  background?: HTMLImageElement | HTMLVideoElement | OffscreenCanvas;
  quality?: Quality;
  inferenceFps?: number;
}

export interface BgEffect {
  start(track: MediaStreamTrack, opts?: BgEffectStartOptions): Promise<MediaStreamTrack>;
  update(opts: Partial<Omit<BgEffectStartOptions, 'engine'>>): void;
  stop(): void;
}

export type BgEffectFactory = (engine?: Engine) => BgEffect;
