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
 * - Respects presenter's aspect ratio (handles 16:9, 16:10, 21:9, ultrawides)
 * - Caps at 1920×1080 for smooth streaming and reasonable bandwidth
 * - Accounts for UI chrome (panels, toolbars, etc.)
 * - Canvas scales nicely in browser regardless of cap
 *
 * Why cap at 1080p?
 * - Higher resolution = more pixels = slower rendering = choppy stream
 * - 1080p cap ensures smooth 30fps streaming on all hardware
 * - Viewer latency and smoothness more important than max quality
 *
 * @returns Scene dimensions optimized for smooth streaming
 */
export function calculateOptimalSceneDimensions(): SceneDimensions {
  const MAX_WIDTH = 1920;
  const MAX_HEIGHT = 1080;

  // Account for typical UI chrome (panels, toolbars, etc.)
  // LayersPanel is ~280px, control strips ~100px, margins ~40px
  const UI_WIDTH_OFFSET = 350;  // Horizontal UI space
  const UI_HEIGHT_OFFSET = 150; // Vertical UI space (control strips, margins)

  // Get presenter's effective viewport, accounting for UI chrome
  const viewportWidth = Math.max(1280, window.innerWidth - UI_WIDTH_OFFSET);
  const viewportHeight = Math.max(720, window.innerHeight - UI_HEIGHT_OFFSET);
  const presenterAspect = viewportWidth / viewportHeight;

  let sceneWidth: number;
  let sceneHeight: number;

  // Calculate scene size, respecting aspect ratio but capped for performance
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
