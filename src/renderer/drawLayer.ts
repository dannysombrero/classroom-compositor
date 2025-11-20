/**
 * Layer-specific drawing functions for the canvas renderer.
 */

import type { Layer } from '../types/scene';
import { getVideoForLayer } from '../media/sourceManager';
import { getImageElement } from './imageCache';
import { measureTextBlock } from '../utils/layerGeometry';

/**
 * Apply transform to canvas context.
 */
function applyTransform(
  ctx: CanvasRenderingContext2D,
  transform: Layer['transform']
): void {
  const { pos, scale, rot, opacity } = transform;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Translate to position
  ctx.translate(pos.x, pos.y);

  // Rotate
  if (rot !== 0) {
    ctx.rotate((rot * Math.PI) / 180);
  }

  // Scale
  if (scale.x !== 1 || scale.y !== 1) {
    ctx.scale(scale.x, scale.y);
  }
}

/**
 * Draw a screen capture layer using the live video element.
 */
export function drawScreenLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer
): void {
  if (layer.type !== 'screen') return;

  applyTransform(ctx, layer.transform);

  const video = getVideoForLayer(layer.id);
  if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    ctx.restore();
    return;
  }

  const width = video.videoWidth || 1920;
  const height = video.videoHeight || 1080;

  ctx.drawImage(video, -width / 2, -height / 2, width, height);

  ctx.restore();
}

/**
 * Draw a camera layer (rectangular, similar to screen layer).
 */
export function drawCameraLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer
): void {
  if (layer.type !== 'camera') return;

  applyTransform(ctx, layer.transform);

  const video = getVideoForLayer(layer.id);
  if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    ctx.restore();
    return;
  }

  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;

  ctx.drawImage(video, -width / 2, -height / 2, width, height);

  ctx.restore();
}

/**
 * Draw an image layer (placeholder for now).
 */
export function drawImageLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer
): void {
  if (layer.type !== 'image') return;

  applyTransform(ctx, layer.transform);

  if (layer.dataUri) {
    const image = getImageElement(layer.dataUri);
    if (image.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
    } else {
      ctx.fillStyle = '#333333';
      ctx.fillRect(-layer.width / 2, -layer.height / 2, layer.width, layer.height);
    }
  } else {
    ctx.fillStyle = '#666666';
    ctx.fillRect(-layer.width / 2, -layer.height / 2, layer.width, layer.height);
  }

  ctx.restore();
}

/**
 * Draw a text layer (placeholder for now).
 */
export function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer
): void {
  if (layer.type !== 'text') return;

  applyTransform(ctx, layer.transform);

  const { content, fontSize, backgroundColor, borderRadius, padding, font, textColor, textAlign } = layer;
  const fontFamily = font || 'sans-serif';
  const align = textAlign ?? 'center';
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = backgroundColor;
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;

  const metrics = measureTextBlock(content, fontSize, fontFamily, padding);
  const width = metrics.width;
  const height = metrics.height;
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  ctx.beginPath();
  
  // Use roundRect if available, otherwise use arcTo for compatibility
  if (ctx.roundRect) {
    ctx.roundRect(-halfWidth, -halfHeight, width, height, borderRadius);
  } else {
    // Fallback: draw rounded rectangle manually
    const x = -halfWidth;
    const y = -halfHeight;
    ctx.moveTo(x + borderRadius, y);
    ctx.lineTo(x + width - borderRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + borderRadius);
    ctx.lineTo(x + width, y + height - borderRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - borderRadius, y + height);
    ctx.lineTo(x + borderRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - borderRadius);
    ctx.lineTo(x, y + borderRadius);
    ctx.quadraticCurveTo(x, y, x + borderRadius, y);
    ctx.closePath();
  }
  ctx.fill();

  ctx.fillStyle = textColor || '#ffffff';

  const startY = -halfHeight + padding + metrics.lineHeight / 2;
  const x =
    align === 'left'
      ? -halfWidth + padding
      : align === 'right'
        ? halfWidth - padding
        : 0;
  metrics.lines.forEach((line, index) => {
    const text = line === '' ? ' ' : line;
    const y = startY + index * metrics.lineHeight;
    ctx.fillText(text, x, y);
  });

  ctx.restore();
}

/**
 * Draw a shape layer (rectangle).
 */
export function drawShapeLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer
): void {
  if (layer.type !== 'shape') return;

  applyTransform(ctx, layer.transform);

  const { width, height, fillColor, strokeColor, strokeWidth } = layer;

  // Draw fill
  ctx.fillStyle = fillColor;
  ctx.fillRect(-width / 2, -height / 2, width, height);

  // Draw stroke if specified
  if (strokeColor && strokeWidth) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.strokeRect(-width / 2, -height / 2, width, height);
  }

  ctx.restore();
}

/**
 * Draw a group layer (placeholder - groups will be drawn recursively).
 */
export function drawGroupLayer(
  _ctx: CanvasRenderingContext2D,
  layer: Layer
): void {
  if (layer.type !== 'group') return;

  // Groups are drawn by iterating children in the main renderer
  // This is a placeholder that does nothing
}
