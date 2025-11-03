import type { Mode } from '../types';

export interface ChromaSettings {
  keyColor?: [number, number, number];
  threshold?: number;
  softness?: number;
}

export interface CompositeOptions {
  mode: Mode;
  background?: HTMLImageElement | HTMLVideoElement | OffscreenCanvas;
  blurRadius?: number;
  chroma?: ChromaSettings;
}

export interface CompositeInput {
  frame: VideoFrame;
  mask?: {
    data: Float32Array;
    width: number;
    height: number;
  };
}

export interface Compositor {
  composite(input: CompositeInput): Promise<VideoFrame>;
  update(opts: Partial<CompositeOptions>): void;
  dispose(): void;
}

export async function createCompositor(opts: CompositeOptions): Promise<Compositor> {
  return {
    async composite({ frame }: CompositeInput): Promise<VideoFrame> {
      return frame;
    },
    update() {},
    dispose() {},
  };
}
