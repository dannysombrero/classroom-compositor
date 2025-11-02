/**
 * Layer-specific drawing functions for the canvas renderer.
 */

import type { Layer } from '../types/scene';
import { getVideoForLayer } from '../media/sourceManager';

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
 * Draw a screen capture layer using the live video element.
 */
export function drawScreenLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer
): void {
  if (layer.type !== 'screen') return;

  applyTransform(ctx, layer.transform, layer);

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
 * Draw a camera layer with a circular mask and soft border.
 */
export function drawCameraLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer
): void {
  if (layer.type !== 'camera') return;

  applyTransform(ctx, layer.transform, layer);

  const video = getVideoForLayer(layer.id);
  if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    ctx.restore();
    return;
  }

  const diameter = layer.diameter ?? 320;
  const radius = diameter / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  const videoWidth = video.videoWidth || diameter;
  const videoHeight = video.videoHeight || diameter;
  let drawWidth = diameter;
  let drawHeight = diameter;

  if (videoWidth > 0 && videoHeight > 0) {
    const aspect = videoWidth / videoHeight;
    if (aspect > 1) {
      drawHeight = diameter;
      drawWidth = diameter * aspect;
    } else {
      drawWidth = diameter;
      drawHeight = diameter / aspect;
    }
  }

  ctx.drawImage(video, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();

  const gradient = ctx.createRadialGradient(0, 0, radius * 0.7, 0, 0, radius);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.6)');

  ctx.lineWidth = Math.max(6, radius * 0.12);
  ctx.strokeStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();

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
