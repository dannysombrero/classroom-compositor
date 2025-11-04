export interface MaskDimensions {
  width: number;
  height: number;
}

export interface EmaOptions {
  alpha?: number;
  previous?: Float32Array | null;
}

export interface RefineOptions {
  dilateIterations?: number;
  erodeIterations?: number;
}

const DEFAULT_ALPHA = 0.6;
const DEFAULT_ITERATIONS = 0;

export function emaSmoothMask(
  current: Float32Array,
  { alpha = DEFAULT_ALPHA, previous = null }: EmaOptions = {},
): Float32Array {
  const length = current.length;
  const clampedAlpha = Math.min(Math.max(alpha, 0), 1);
  const beta = 1 - clampedAlpha;

  if (!previous || previous.length !== length) {
    return current.slice();
  }

  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const raw = clampedAlpha * current[i] + beta * previous[i];
    output[i] = clamp01(raw);
  }
  return output;
}

export function refineMask(
  mask: Float32Array,
  dims: MaskDimensions,
  { dilateIterations = DEFAULT_ITERATIONS, erodeIterations = DEFAULT_ITERATIONS }: RefineOptions = {},
): Float32Array {
  if (dilateIterations <= 0 && erodeIterations <= 0) {
    return copyAndClamp(mask);
  }

  let working = copyAndClamp(mask);

  for (let i = 0; i < dilateIterations; i += 1) {
    working = dilate(working, dims.width, dims.height);
  }

  for (let i = 0; i < erodeIterations; i += 1) {
    working = erode(working, dims.width, dims.height);
  }

  return working;
}

function dilate(source: Float32Array, width: number, height: number): Float32Array {
  const output = new Float32Array(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let maxValue = 0;

      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;

        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;

          const index = ny * width + nx;
          maxValue = Math.max(maxValue, source[index]);
        }
      }

      output[y * width + x] = clamp01(maxValue);
    }
  }
  return output;
}

function erode(source: Float32Array, width: number, height: number): Float32Array {
  const output = new Float32Array(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let minValue = 1;

      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;

        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;

          const index = ny * width + nx;
          minValue = Math.min(minValue, source[index]);
        }
      }

      output[y * width + x] = clamp01(minValue);
    }
  }
  return output;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function copyAndClamp(source: Float32Array): Float32Array {
  const output = new Float32Array(source.length);
  for (let i = 0; i < source.length; i += 1) {
    output[i] = clamp01(source[i]);
  }
  return output;
}
