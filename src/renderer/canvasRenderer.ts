/**
 * Canvas renderer for drawing scenes and layers.
 */

import type { Scene } from '../types/scene';
import {
  drawScreenLayer,
  drawCameraLayer,
  drawImageLayer,
  drawTextLayer,
  drawShapeLayer,
  drawGroupLayer,
} from './drawLayer';

// Cache for background images to avoid reloading every frame
const backgroundImageCache = new Map<string, HTMLImageElement>();

function loadBackgroundImage(src: string): HTMLImageElement | null {
  if (backgroundImageCache.has(src)) {
    return backgroundImageCache.get(src)!;
  }

  const img = new Image();
  img.src = src;

  if (img.complete && img.naturalWidth > 0) {
    backgroundImageCache.set(src, img);
    return img;
  }

  // Set up onload to cache it for next frame
  img.onload = () => {
    backgroundImageCache.set(src, img);
  };

  return null; // Not loaded yet
}

/**
 * Draw a complete scene to a canvas context.
 * 
 * @param scene - Scene to draw
 * @param ctx - Canvas 2D rendering context
 */
interface DrawSceneOptions {
  skipLayerIds?: string[];
  dirtyRect?: { x: number; y: number; width: number; height: number };
  background?: {
    type: 'color' | 'image';
    value: string;
  };
}

export function drawScene(
  scene: Scene | null,
  ctx: CanvasRenderingContext2D,
  options: DrawSceneOptions = {}
): void {
  const dirtyRect = options.dirtyRect;
  const shouldClip =
    !!dirtyRect &&
    dirtyRect.width > 0 &&
    dirtyRect.height > 0;
  if (shouldClip) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
    ctx.clip();
  }

  if (!scene) {
    // Clear canvas if no scene
    // Use fallback dimensions (1920x1080) for safety when scene is not yet initialized
    // Note: New scenes are created with viewport-optimized dimensions via calculateOptimalSceneDimensions()
    const defaultWidth = 1920;
    const defaultHeight = 1080;

    // Fill with dark background to show canvas is working
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, defaultWidth, defaultHeight);
    if (shouldClip) {
      ctx.restore();
    }
    return;
  }

  // Fill canvas with background (color or image)
  const background = options.background || { type: 'color', value: '#ffffff' };

  // Use dirty rect if available, otherwise full canvas
  const fillX = dirtyRect?.x ?? 0;
  const fillY = dirtyRect?.y ?? 0;
  const fillWidth = dirtyRect?.width ?? scene.width;
  const fillHeight = dirtyRect?.height ?? scene.height;

  if (background.type === 'color') {
    ctx.fillStyle = background.value;
    ctx.fillRect(fillX, fillY, fillWidth, fillHeight);
  } else if (background.type === 'image') {
    // Fill with white first as fallback
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(fillX, fillY, fillWidth, fillHeight);

    // Try to draw the cached image
    const img = loadBackgroundImage(background.value);
    if (img && img.complete && img.naturalWidth > 0) {
      if (dirtyRect) {
        // Calculate the source rectangle from the image proportionally
        // The image is scaled to fit the scene, so we need to map dirty rect coords
        // to source image coordinates
        const scaleX = img.naturalWidth / scene.width;
        const scaleY = img.naturalHeight / scene.height;
        const sx = fillX * scaleX;
        const sy = fillY * scaleY;
        const sWidth = fillWidth * scaleX;
        const sHeight = fillHeight * scaleY;

        // Draw the portion of the image that corresponds to the dirty rect
        ctx.drawImage(
          img,
          sx, sy, sWidth, sHeight,        // Source rect (in image coordinates)
          fillX, fillY, fillWidth, fillHeight  // Dest rect (in canvas coordinates)
        );
      } else {
        // Draw full image scaled to scene dimensions
        ctx.drawImage(img, 0, 0, scene.width, scene.height);
      }
    }
  }
  
  // Draw corner markers to show it's working (when empty)
  if (scene.layers.length === 0) {
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 2;
    const markerSize = 30;
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
    
    // Add center indicator
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 1;
    const centerX = scene.width / 2;
    const centerY = scene.height / 2;
    const crossSize = 20;
    ctx.beginPath();
    ctx.moveTo(centerX - crossSize, centerY);
    ctx.lineTo(centerX + crossSize, centerY);
    ctx.moveTo(centerX, centerY - crossSize);
    ctx.lineTo(centerX, centerY + crossSize);
    ctx.stroke();
  }

  // Sort layers by z-order
  const sortedLayers = [...scene.layers].sort((a, b) => a.z - b.z);

  // Draw each layer
  const skipSet = new Set(options.skipLayerIds ?? []);

  for (const layer of sortedLayers) {
    // Skip invisible layers
    if (!layer.visible) continue;
    if (skipSet.has(layer.id)) continue;

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

  if (shouldClip) {
    ctx.restore();
  }
}

/**
 * Get the logical canvas size for a scene.
 * Returns the scene's actual dimensions, or fallback if scene is null.
 * Note: New scenes are created with viewport-optimized dimensions.
 */
export function getCanvasSize(scene: Scene | null): { width: number; height: number } {
  if (!scene) {
    // Fallback for edge cases (scene not yet initialized)
    return { width: 1920, height: 1080 };
  }
  return { width: scene.width, height: scene.height };
}
