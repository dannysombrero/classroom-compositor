import type { Layer } from '../types/scene';
import type { Scene } from '../types/scene';

interface Size {
  width: number;
  height: number;
}

const measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const measureCtx = measureCanvas ? measureCanvas.getContext('2d') : null;

export const TEXT_LINE_HEIGHT_RATIO = 1.25;

export interface TextBlockMetrics extends Size {
  lineHeight: number;
  lines: string[];
}

export function measureTextBlock(content: string, fontSize: number, fontFamily: string, padding: number): TextBlockMetrics {
  const rawLines = content.split(/\r?\n/);
  const lines = rawLines.length > 0 ? rawLines : [''];
  const lineHeight = fontSize * TEXT_LINE_HEIGHT_RATIO;

  if (!measureCtx) {
    const widest = lines.reduce((max, line) => Math.max(max, line.length), 0);
    const width = Math.max(1, widest) * fontSize * 0.6 + padding * 2;
    const height = lineHeight * lines.length + padding * 2;
    return { width, height, lineHeight, lines };
  }

  measureCtx.save();
  measureCtx.font = `${fontSize}px ${fontFamily}`;
  let maxWidth = 0;
  for (const line of lines) {
    const text = line === '' ? ' ' : line;
    const metrics = measureCtx.measureText(text);
    maxWidth = Math.max(maxWidth, metrics.width);
  }
  measureCtx.restore();
  return {
    width: maxWidth + padding * 2,
    height: lineHeight * lines.length + padding * 2,
    lineHeight,
    lines,
  };
}

export function getLayerBaseSize(layer: Layer, scene: Scene): Size {
  switch (layer.type) {
    case 'screen':
      return { width: scene.width, height: scene.height };
    case 'camera':
      // Default camera dimensions (16:9 aspect ratio)
      return { width: 1280, height: 720 };
    case 'image':
      return { width: layer.width, height: layer.height };
    case 'shape':
      return { width: layer.width, height: layer.height };
    case 'text':
      return measureTextBlock(layer.content, layer.fontSize, layer.font, layer.padding);
    case 'group':
      // TODO: compute bounds from children when groups are implemented
      return { width: 400, height: 300 };
    default:
      return { width: 400, height: 300 };
  }
}

export function getLayerBoundingSize(layer: Layer, scene: Scene): Size {
  const base = getLayerBaseSize(layer, scene);
  return {
    width: base.width * Math.abs(layer.transform.scale.x),
    height: base.height * Math.abs(layer.transform.scale.y),
  };
}
