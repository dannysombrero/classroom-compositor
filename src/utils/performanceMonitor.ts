/**
 * Performance monitor for adaptive FPS and frame skipping.
 * Monitors rendering performance and automatically adjusts frame rate.
 */

export interface PerformanceStats {
  currentFPS: number;
  targetFPS: number;
  droppedFrames: number;
  averageFrameTime: number;
}

export class PerformanceMonitor {
  private targetFPS: number;
  private minFPS: number;
  private maxFPS: number;

  private frameTimesMs: number[] = [];
  private maxSamples = 60; // Track last 60 frames

  private lastFrameTime = 0;
  private droppedFramesCount = 0;
  private currentFPS: number;

  // Thresholds
  private readonly SLOW_FRAME_THRESHOLD_MS = 40; // 25fps
  private readonly FAST_FRAME_THRESHOLD_MS = 25; // 40fps

  constructor(targetFPS = 30, minFPS = 15, maxFPS = 30) {
    this.targetFPS = targetFPS;
    this.minFPS = minFPS;
    this.maxFPS = maxFPS;
    this.currentFPS = targetFPS;
  }

  /**
   * Record a frame render time and determine if we should render the next frame.
   * Returns true if we should render, false if we should skip.
   */
  recordFrame(timestamp: number): boolean {
    if (this.lastFrameTime === 0) {
      this.lastFrameTime = timestamp;
      return true;
    }

    const elapsed = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    // Record frame time
    this.frameTimesMs.push(elapsed);
    if (this.frameTimesMs.length > this.maxSamples) {
      this.frameTimesMs.shift();
    }

    // Calculate average frame time
    const avgFrameTime = this.frameTimesMs.reduce((a, b) => a + b, 0) / this.frameTimesMs.length;

    // Adapt target FPS based on performance
    if (avgFrameTime > this.SLOW_FRAME_THRESHOLD_MS && this.targetFPS > this.minFPS) {
      // Too slow, reduce target FPS
      this.targetFPS = Math.max(this.minFPS, this.targetFPS - 2);
      console.log(`[PerformanceMonitor] Reducing FPS to ${this.targetFPS} (avg frame time: ${avgFrameTime.toFixed(1)}ms)`);
    } else if (avgFrameTime < this.FAST_FRAME_THRESHOLD_MS && this.targetFPS < this.maxFPS) {
      // Running fast, can increase target FPS
      this.targetFPS = Math.min(this.maxFPS, this.targetFPS + 2);
      console.log(`[PerformanceMonitor] Increasing FPS to ${this.targetFPS} (avg frame time: ${avgFrameTime.toFixed(1)}ms)`);
    }

    // Calculate current FPS from frame times
    this.currentFPS = 1000 / avgFrameTime;

    // Determine if we should skip this frame
    const targetFrameTime = 1000 / this.targetFPS;
    if (elapsed < targetFrameTime * 0.8) {
      // Frame came too early, skip it
      this.droppedFramesCount++;
      return false;
    }

    return true;
  }

  /**
   * Check if we should skip a frame based on current performance.
   */
  shouldSkipFrame(): boolean {
    const avgFrameTime = this.frameTimesMs.length > 0
      ? this.frameTimesMs.reduce((a, b) => a + b, 0) / this.frameTimesMs.length
      : 0;

    // If we're struggling (frame time > 50ms = under 20fps), skip some frames
    if (avgFrameTime > 50) {
      return Math.random() < 0.3; // Skip 30% of frames when struggling
    }

    return false;
  }

  getStats(): PerformanceStats {
    const avgFrameTime = this.frameTimesMs.length > 0
      ? this.frameTimesMs.reduce((a, b) => a + b, 0) / this.frameTimesMs.length
      : 0;

    return {
      currentFPS: this.currentFPS,
      targetFPS: this.targetFPS,
      droppedFrames: this.droppedFramesCount,
      averageFrameTime: avgFrameTime,
    };
  }

  getTargetFPS(): number {
    return this.targetFPS;
  }

  reset(): void {
    this.frameTimesMs = [];
    this.droppedFramesCount = 0;
    this.lastFrameTime = 0;
  }
}
