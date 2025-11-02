/**
 * Layer-specific drawing functions for the canvas renderer.
 */

import type { Layer } from '../types/scene';

/**
 * Apply transform to canvas context.
 */
function applyTransform(
  ctx: CanvasRenderingContext2D,
  transform: Layer['transform'],
  layer: Layer
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
 * Draw a screen layer (placeholder for now).
 */
export function drawScreenLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer
): void {
  if (layer.type !== 'screen') return;

  applyTransform(ctx, layer.transform, layer);

  // Placeholder: draw a dark rectangle
  ctx.fillStyle = '#000000';
  ctx.fillRect(-50, -50, 100, 100);

  ctx.restore();
}

/**
 * Draw a camera layer (placeholder for now).
 */
export function drawCameraLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer
): void {
  if (layer.type !== 'camera') return;

  applyTransform(ctx, layer.transform, layer);

  // Placeholder: draw a circle (will be replaced with actual video)
  ctx.fillStyle = '#444444';
  ctx.beginPath();
  ctx.arc(0, 0, 50, 0, Math.PI * 2);
  ctx.fill();

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

  applyTransform(ctx, layer.transform, layer);

  // Placeholder: draw a rectangle with image dimensions
  ctx.fillStyle = '#666666';
  ctx.fillRect(-layer.width / 2, -layer.height / 2, layer.width, layer.height);

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

  applyTransform(ctx, layer.transform, layer);

  // Placeholder: draw a rounded rectangle with text
  const { content, fontSize, backgroundColor, borderRadius, padding } = layer;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = backgroundColor;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  // Measure text
  const metrics = ctx.measureText(content);
  const textWidth = metrics.width;
  const textHeight = fontSize;

  // Draw background pill
  const width = textWidth + padding * 2;
  const height = textHeight + padding * 2;
  ctx.beginPath();
  
  // Use roundRect if available, otherwise use arcTo for compatibility
  if (ctx.roundRect) {
    ctx.roundRect(-width / 2, -height / 2, width, height, borderRadius);
  } else {
    // Fallback: draw rounded rectangle manually
    const x = -width / 2;
    const y = -height / 2;
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

  // Draw text
  ctx.fillStyle = '#ffffff';
  ctx.fillText(content, 0, 0);

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

  applyTransform(ctx, layer.transform, layer);

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
  ctx: CanvasRenderingContext2D,
  layer: Layer
): void {
  if (layer.type !== 'group') return;

  // Groups are drawn by iterating children in the main renderer
  // This is a placeholder that does nothing
}

