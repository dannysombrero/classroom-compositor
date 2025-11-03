import type { Engine } from '../types';
import type { ISegmenter } from '../pipeline/segmenter';
import { createMediaPipeSegmenter } from './mediapipe';

export async function createSegmenterAdapter(engine: Engine): Promise<ISegmenter> {
  switch (engine) {
    case 'mediapipe':
      return createMediaPipeSegmenter();
    default:
      throw new Error(`Unsupported engine "${engine}"`);
  }
}
