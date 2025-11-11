/**
 * Utilities for calculating optimal scene resolution based on presenter's display.
 * Maintains aspect ratio while capping maximum dimensions for reasonable bandwidth.
 */

export interface SceneDimensions {
  width: number;
  height: number;
}

/**
 * Calculate optimal scene dimensions based on the presenter's viewport.
 *
 * Strategy:
 * - Uses the presenter's native monitor resolution
 * - Accounts for UI chrome (panels, toolbars, etc.)
 * - NO CAP on maximum dimensions - use full native resolution for best quality
 * - Canvas scales down in browser to fit, but stream is at full resolution
 * - Future: Add quality presets for presenter to lower if network struggles
 *
 * @returns Scene dimensions matching presenter's native display (minus UI chrome)
 */
export function calculateOptimalSceneDimensions(): SceneDimensions {
  // Account for typical UI chrome (panels, toolbars, etc.)
  // LayersPanel is ~280px, control strips ~100px, margins ~40px
  const UI_WIDTH_OFFSET = 350;  // Horizontal UI space
  const UI_HEIGHT_OFFSET = 150; // Vertical UI space (control strips, margins)

  // Get presenter's effective viewport, accounting for UI chrome
  // Use native screen resolution for best quality
  const viewportWidth = Math.max(1280, window.innerWidth - UI_WIDTH_OFFSET);
  const viewportHeight = Math.max(720, window.innerHeight - UI_HEIGHT_OFFSET);
  const presenterAspect = viewportWidth / viewportHeight;

  let sceneWidth: number;
  let sceneHeight: number;

  // Calculate scene size based on viewport, maintaining aspect ratio
  // No maximum cap - use full native resolution
  sceneWidth = viewportWidth;
  sceneHeight = viewportHeight;

  // Ensure minimum viable dimensions (prevent tiny canvases)
  const MIN_WIDTH = 1280;
  const MIN_HEIGHT = 720;

  if (sceneWidth < MIN_WIDTH) {
    sceneWidth = MIN_WIDTH;
    sceneHeight = Math.round(sceneWidth / presenterAspect);
  }

  if (sceneHeight < MIN_HEIGHT) {
    sceneHeight = MIN_HEIGHT;
    sceneWidth = Math.round(sceneHeight * presenterAspect);
  }

  return {
    width: sceneWidth,
    height: sceneHeight,
  };
}

/**
 * Get standard fallback dimensions when viewport is not available.
 * Used during server-side rendering or when window is not defined.
 */
export function getFallbackSceneDimensions(): SceneDimensions {
  return {
    width: 1920,
    height: 1080,
  };
}

/**
 * Calculate appropriate viewer window dimensions based on scene size.
 * Adds a bit of padding for browser chrome.
 */
export function calculateViewerWindowDimensions(sceneDimensions: SceneDimensions): string {
  const CHROME_PADDING = 100; // Approximate browser chrome height
  const width = sceneDimensions.width;
  const height = sceneDimensions.height + CHROME_PADDING;

  return `width=${width},height=${height}`;
}
