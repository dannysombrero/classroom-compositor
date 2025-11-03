/**
 * Mask smoothing utilities will evolve alongside the segmentation adapters.
 * For now these helpers are placeholders that simply echo the source data.
 */

export interface MaskDimensions {
  width: number;
  height: number;
}

/**
 * Exponential moving average smoothing placeholder.
 * TODO: implement temporal smoothing once segmentation is in place.
 */
export function emaSmoothMask(mask: Float32Array, _dims: MaskDimensions, _alpha = 0.6): Float32Array {
  return mask;
}

/**
 * Placeholder for morphological operations (dilate/erode).
 */
export function refineMask(mask: Float32Array, _dims: MaskDimensions): Float32Array {
  return mask;
}
