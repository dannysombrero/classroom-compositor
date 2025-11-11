import type { Mode } from '../types';

interface ShaderModule {
  init(): Promise<void>;
  dispose(): void;
}

class PlaceholderBlurShader implements ShaderModule {
  async init(): Promise<void> {
    // TODO: compile WebGL/WebGPU blur shader here.
  }

  dispose(): void {
    // TODO: release shader resources.
  }
}

class PlaceholderReplaceShader implements ShaderModule {
  async init(): Promise<void> {}
  dispose(): void {}
}

class PlaceholderChromaShader implements ShaderModule {
  async init(): Promise<void> {}
  dispose(): void {}
}

export interface ChromaSettings {
  keyColor?: [number, number, number];
  threshold?: number;
  softness?: number;
}

export interface CompositeOptions {
  mode: Mode;
  background?: HTMLImageElement | HTMLVideoElement | OffscreenCanvas | undefined;
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

/**
 * TODO roadmap:
 * - Wire WebGL/WebGPU initialisation (lazily) with feature detection.
 * - Hook blur shader into Gaussian/separable pipeline.
 * - Implement background replacement sampling.
 * - Implement chroma key shader with spill suppression.
 * - Provide CPU fallback when WebGL/WebGPU unavailable.
 */
export async function createCompositor(_opts: CompositeOptions): Promise<Compositor> {
  const blurShader = new PlaceholderBlurShader();
  const replaceShader = new PlaceholderReplaceShader();
  const chromaShader = new PlaceholderChromaShader();

  await Promise.all([
    blurShader.init(),
    replaceShader.init(),
    chromaShader.init(),
  ]);

  return {
    async composite({ frame }: CompositeInput): Promise<VideoFrame> {
      return frame;
    },
    update() {},
    dispose() {
      blurShader.dispose();
      replaceShader.dispose();
      chromaShader.dispose();
    },
  };
}
