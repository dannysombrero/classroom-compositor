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
 * - Respects presenter's aspect ratio (handles 16:9, 16:10, 21:9, etc.)
 * - Caps maximum dimension at 1920px to control bandwidth
 * - Uses 90% of viewport to leave room for UI chrome
 * - Returns dimensions that fill the presenter's screen properly
 *
 * @returns Scene dimensions optimized for current viewport
 */
export function calculateOptimalSceneDimensions(): SceneDimensions {
  const MAX_WIDTH = 1920;
  const MAX_HEIGHT = 1080;
  const VIEWPORT_USAGE = 0.9; // Use 90% of viewport for canvas

  // Get presenter's effective viewport
  const viewportWidth = window.innerWidth * VIEWPORT_USAGE;
  const viewportHeight = window.innerHeight * VIEWPORT_USAGE;
  const presenterAspect = viewportWidth / viewportHeight;

  let sceneWidth: number;
  let sceneHeight: number;

  // Determine if we're limited by width or height
  if (presenterAspect >= 16 / 9) {
    // Wider than 16:9 (ultrawide monitors, etc.)
    // Cap by width
    sceneWidth = Math.min(MAX_WIDTH, viewportWidth);
    sceneHeight = Math.round(sceneWidth / presenterAspect);
  } else {
    // Standard or taller than 16:9
    // Cap by height
    sceneHeight = Math.min(MAX_HEIGHT, viewportHeight);
    sceneWidth = Math.round(sceneHeight * presenterAspect);
  }

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
