import type { ISegmenter, SegmentationResult, SegmenterInitOptions } from '../pipeline/segmenter';

class PlaceholderMediaPipeSegmenter implements ISegmenter {
  private initialised = false;

  async init(_opts?: SegmenterInitOptions): Promise<void> {
    this.initialised = true;
  }

  async segment(frame: VideoFrame): Promise<SegmentationResult> {
    if (!this.initialised) {
      throw new Error('MediaPipe segmenter used before init');
    }

    const width = frame.displayWidth || frame.codedWidth || 1;
    const height = frame.displayHeight || frame.codedHeight || 1;

    const mask = new Float32Array(width * height);
    mask.fill(1);

    return {
      mask,
      maskWidth: width,
      maskHeight: height,
    };
  }

  dispose(): void {
    this.initialised = false;
  }
}

export async function createMediaPipeSegmenter(): Promise<ISegmenter> {
  return new PlaceholderMediaPipeSegmenter();
}
