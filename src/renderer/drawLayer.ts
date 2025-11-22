/**
 * Layer-specific drawing functions for the canvas renderer.
 */

import type { Layer, ChatLayer } from '../types/scene';
import { getVideoForLayer } from '../media/sourceManager';
import { getImageElement } from './imageCache';
import { measureTextBlock } from '../utils/layerGeometry';
import { useChatStore, getSenderDisplayName, formatMessageTime } from '../ai/stores/chatStore';

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

  // Check if this is a pending screen share (no streamId)
  const isPending = !layer.streamId;

  if (isPending) {
    // Draw placeholder for pending screen share
    const width = 1920;
    const height = 1080;

    // Gray background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-width / 2, -height / 2, width, height);

    // Diagonal lines pattern
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 2;
    const spacing = 40;
    for (let i = -width; i < width + height; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(i - height / 2, -height / 2);
      ctx.lineTo(i + height / 2, height / 2);
      ctx.stroke();
    }

    // Text: "Screen Share - Will activate when live"
    ctx.fillStyle = '#888888';
    ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Screen Share', 0, -40);
    ctx.font = '32px system-ui, -apple-system, sans-serif';
    ctx.fillText('Will activate when live', 0, 20);

    ctx.restore();
    return;
  }

  // Normal rendering: show video
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

  const diameter = layer.diameter ?? 320;
  const radius = diameter / 2;

  const video = getVideoForLayer(layer.id);
  const hasVideo = video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

  // Draw placeholder if no video stream
  if (!hasVideo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Draw gray striped background
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(-radius, -radius, diameter, diameter);

    // Draw diagonal stripes
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = 8;
    const stripeSpacing = 20;
    for (let i = -diameter; i < diameter * 2; i += stripeSpacing) {
      ctx.beginPath();
      ctx.moveTo(i - diameter, -radius);
      ctx.lineTo(i, radius);
      ctx.stroke();
    }

    // Draw text
    ctx.fillStyle = '#888888';
    ctx.font = `bold ${Math.max(12, radius / 8)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Check if it's a phone camera and its activation status
    const isPhoneCamera = (layer as any).isPhoneCamera || layer.name?.toLowerCase().includes('phone');
    const hasPhoneCameraId = !!(layer as any).phoneCameraId;

    const text = isPhoneCamera ? 'Phone Camera' : 'Camera';
    ctx.fillText(text, 0, -10);

    ctx.font = `${Math.max(10, radius / 10)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = '#666666';

    // Show different message based on phone camera activation status
    let statusText = 'Waiting for stream...';
    if (isPhoneCamera && !hasPhoneCameraId) {
      statusText = 'Start Session to activate';
    } else if (isPhoneCamera && hasPhoneCameraId) {
      statusText = 'Scan QR code to connect';
    }
    ctx.fillText(statusText, 0, 15);

    ctx.restore();

    // Draw border
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 1.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
    return;
  }

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

  const scale = layer.videoScale ?? 1;
  const scaledWidth = drawWidth * scale;
  const scaledHeight = drawHeight * scale;
  const offset = layer.videoOffset ?? { x: 0, y: 0 };
  ctx.drawImage(
    video,
    -scaledWidth / 2 - offset.x,
    -scaledHeight / 2 - offset.y,
    scaledWidth,
    scaledHeight
  );
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

/**
 * Draw a chat layer with messages from the chat store.
 */
export function drawChatLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer
): void {
  if (layer.type !== 'chat') return;

  const chatLayer = layer as ChatLayer;

  applyTransform(ctx, layer.transform);

  // Get recent messages from chat store
  const messages = useChatStore.getState().getRecentMessages(10);

  const { width, height } = chatLayer;

  // Draw background
  ctx.fillStyle = 'rgba(15, 15, 15, 0.95)';
  ctx.fillRect(0, 0, width, height);

  // Draw border
  ctx.strokeStyle = 'rgba(147, 51, 234, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  // Draw header background
  const headerHeight = 44;
  ctx.fillStyle = 'rgba(147, 51, 234, 0.1)';
  ctx.fillRect(0, 0, width, headerHeight);

  // Draw header border
  ctx.strokeStyle = 'rgba(147, 51, 234, 0.2)';
  ctx.beginPath();
  ctx.moveTo(0, headerHeight);
  ctx.lineTo(width, headerHeight);
  ctx.stroke();

  // Draw title
  ctx.fillStyle = '#c084fc';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('💬 AI Bot Chat', 16, headerHeight / 2);

  // Draw message count
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '10px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `${messages.length} message${messages.length !== 1 ? 's' : ''}`,
    16,
    headerHeight / 2 + 16
  );

  // Draw messages
  let y = headerHeight + 16;
  const padding = 12;
  const messageSpacing = 12;
  const maxWidth = width - padding * 2;

  ctx.textBaseline = 'alphabetic';

  for (const msg of messages) {
    // Check if we have space for at least one line
    if (y + 50 > height) break;

    // Draw sender name and timestamp on same line
    const senderColor =
      msg.from === 'bot' ? '#c084fc' : msg.from === 'teacher' ? '#60a5fa' : '#86efac';
    ctx.fillStyle = senderColor;
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    const senderName = getSenderDisplayName(msg);
    ctx.fillText(senderName, padding, y);

    // Draw timestamp next to sender name
    const timestamp = formatMessageTime(msg.timestamp);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    const senderWidth = ctx.measureText(senderName).width;
    ctx.fillText(` • ${timestamp}`, padding + senderWidth, y);
    y += 16;

    // Draw message text with wrapping
    ctx.fillStyle = '#eaeaea';
    ctx.font = '12px system-ui, -apple-system, sans-serif';

    const words = msg.text.split(' ');
    let line = '';

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && line !== '') {
        // Draw current line and start new one
        ctx.fillText(line.trim(), padding, y);
        y += 16;
        line = words[i] + ' ';

        // Stop if we run out of space
        if (y + 20 > height) break;
      } else {
        line = testLine;
      }
    }

    // Draw last line if there's space
    if (y + 16 <= height && line.trim()) {
      ctx.fillText(line.trim(), padding, y);
      y += 16;
    }

    y += messageSpacing;
  }

  ctx.restore();
}
