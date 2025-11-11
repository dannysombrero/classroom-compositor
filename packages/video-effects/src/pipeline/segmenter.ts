import type { Engine, Quality } from '../types';
import { createSegmenterAdapter } from '../adapters';

export type SegmentationQuality = Quality;

export interface SegmentationResult {
  mask: Float32Array;
  maskWidth: number;
  maskHeight: number;
}

export interface SegmenterInitOptions {
  quality?: SegmentationQuality;
}

export interface ISegmenter {
  init(opts?: SegmenterInitOptions): Promise<void>;
  segment(frame: VideoFrame): Promise<SegmentationResult>;
  dispose(): void;
}

export async function createSegmenter(engine: Engine): Promise<ISegmenter> {
  return createSegmenterAdapter(engine);
}
