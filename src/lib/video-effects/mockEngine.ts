import type { EffectMode, EffectQuality } from "../../stores/videoEffects";

export type BgEffect = {
  start: (track: MediaStreamTrack, opts: {
    mode: EffectMode; quality: EffectQuality;
    background?: HTMLImageElement | HTMLVideoElement | OffscreenCanvas;
    inferenceFps?: number;
  }) => Promise<MediaStreamTrack>;
  update: (opts: Partial<Parameters<BgEffect["start"]>[1]>) => void;
  stop: () => void;
};

export function createMockBgEffect(): BgEffect {
  let current: MediaStreamTrack | null = null;
  return {
    async start(track) { current = track; return track; }, // pass-through
    update() {},
    stop() { current = null; }
  };
}