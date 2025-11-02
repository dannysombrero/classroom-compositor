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
    
    // Fill with dark background to show canvas is working
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, defaultWidth, defaultHeight);
    return;
  }

  // Fill canvas with dark background (scene background color)
  // This ensures we can see the canvas even when there are no layers
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, scene.width, scene.height);
  
  // Draw a subtle border to show canvas bounds when empty
  if (scene.layers.length === 0) {
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, scene.width - 2, scene.height - 2);
    
    // Draw a subtle grid or corner markers to show it's working
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    // Draw corner markers
    const markerSize = 20;
    ctx.beginPath();
    // Top-left
    ctx.moveTo(0, markerSize);
    ctx.lineTo(0, 0);
    ctx.lineTo(markerSize, 0);
    // Top-right
    ctx.moveTo(scene.width - markerSize, 0);
    ctx.lineTo(scene.width, 0);
    ctx.lineTo(scene.width, markerSize);
    // Bottom-right
    ctx.moveTo(scene.width, scene.height - markerSize);
    ctx.lineTo(scene.width, scene.height);
    ctx.lineTo(scene.width - markerSize, scene.height);
    // Bottom-left
    ctx.moveTo(markerSize, scene.height);
    ctx.lineTo(0, scene.height);
    ctx.lineTo(0, scene.height - markerSize);
    ctx.stroke();
  }

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

