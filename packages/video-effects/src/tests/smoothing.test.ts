import { describe, expect, it } from 'vitest';
import { emaSmoothMask, refineMask, type MaskDimensions } from '../pipeline/smoothing';

describe('emaSmoothMask', () => {
  it('returns a copy of the current mask when no previous mask is provided', () => {
    const current = new Float32Array([0, 0.5, 1]);
    const result = emaSmoothMask(current);

    expect(Array.from(result)).toEqual([0, 0.5, 1]);
    expect(result).not.toBe(current);
  });

  it('blends with the previous mask using the provided alpha', () => {
    const current = new Float32Array([0, 1, 0.5]);
    const previous = new Float32Array([1, 0, 0.5]);

    const result = emaSmoothMask(current, { alpha: 0.75, previous });

    expect(Array.from(result)).toEqual([
      0.25 * 1 + 0.75 * 0,
      0.25 * 0 + 0.75 * 1,
      0.25 * 0.5 + 0.75 * 0.5,
    ]);
  });
});

describe('refineMask', () => {
  const dims: MaskDimensions = { width: 3, height: 3 };

  it('returns a shallow copy when no refinement iterations are requested', () => {
    const mask = new Float32Array([
      0, 0, 0,
      0, 1, 0,
      0, 0, 0,
    ]);

    const refined = refineMask(mask, dims);

    expect(Array.from(refined)).toEqual([
      0, 0, 0,
      0, 1, 0,
      0, 0, 0,
    ]);
  });

  it('supports dilation followed by erosion when iterations are provided', () => {
    const mask = new Float32Array([
      0, 0.2, 0,
      0.2, 1, 0.2,
      0, 0.2, 0,
    ]);

    const refined = refineMask(mask, dims, { dilateIterations: 1, erodeIterations: 1 });

    expect(refined[4]).toBeCloseTo(1);
    expect(refined[0]).toBeGreaterThanOrEqual(0);
    expect(refined[8]).toBeGreaterThanOrEqual(0);
  });

  it('clamps values into the [0, 1] range', () => {
    const mask = new Float32Array([
      -2, 2, 0.5,
      0.1, 0.9, 0,
      1, 1, 1,
    ]);

    const refined = refineMask(mask, dims, { dilateIterations: 0, erodeIterations: 0 });

    expect(refined.every((value) => value >= 0 && value <= 1)).toBe(true);
  });
});
