/**
 * Canvas renderer for drawing scenes and layers.
 */

import type { Scene, Layer } from '../types/scene';
import {
  drawScreenLayer,
  drawCameraLayer,
  drawImageLayer,
  drawTextLayer,
  drawShapeLayer,
  drawGroupLayer,
} from './drawLayer';

/**
 * Draw a complete scene to a canvas context.
 * 
 * @param scene - Scene to draw
 * @param ctx - Canvas 2D rendering context
 */
export function drawScene(scene: Scene | null, ctx: CanvasRenderingContext2D): void {
  if (!scene) {
    // Clear canvas if no scene
    // Use default scene dimensions (1920x1080) to match the transform coordinate space
    const defaultWidth = 1920;
    const defaultHeight = 1080;
    ctx.clearRect(0, 0, defaultWidth, defaultHeight);
    return;
  }

  // Clear canvas using scene coordinates
  // The transform set in PresenterCanvas will scale these to the actual canvas size
  ctx.clearRect(0, 0, scene.width, scene.height);

  // Sort layers by z-order
  const sortedLayers = [...scene.layers].sort((a, b) => a.z - b.z);

  // Draw each layer
  for (const layer of sortedLayers) {
    // Skip invisible layers
    if (!layer.visible) continue;

    // Skip locked layers (optional, but good practice)
    // Actually, locked layers should still render, just not be editable

    // Dispatch to type-specific drawer
    switch (layer.type) {
      case 'screen':
        drawScreenLayer(ctx, layer);
        break;
      case 'camera':
        drawCameraLayer(ctx, layer);
        break;
      case 'image':
        drawImageLayer(ctx, layer);
        break;
      case 'text':
        drawTextLayer(ctx, layer);
        break;
      case 'shape':
        drawShapeLayer(ctx, layer);
        break;
      case 'group':
        // Groups will be handled recursively in a future iteration
        drawGroupLayer(ctx, layer);
        break;
      default:
        // Unknown layer type, skip
        console.warn('Unknown layer type:', layer);
    }
  }
}

/**
 * Get the logical canvas size for a scene.
 */
export function getCanvasSize(scene: Scene | null): { width: number; height: number } {
  if (!scene) {
    return { width: 1920, height: 1080 };
  }
  return { width: scene.width, height: scene.height };
}

