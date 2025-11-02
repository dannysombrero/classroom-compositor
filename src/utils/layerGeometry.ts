import type { Layer } from '../types/scene';
import type { Scene } from '../types/scene';

interface Size {
  width: number;
  height: number;
}

const measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const measureCtx = measureCanvas ? measureCanvas.getContext('2d') : null;

function measureText(content: string, fontSize: number, fontFamily: string, padding: number): Size {
  if (!measureCtx) {
    const approximateWidth = Math.max(1, content.length) * fontSize * 0.6 + padding * 2;
    const approximateHeight = fontSize + padding * 2;
    return { width: approximateWidth, height: approximateHeight };
  }

  measureCtx.save();
  measureCtx.font = `${fontSize}px ${fontFamily}`;
  const metrics = measureCtx.measureText(content || ' ');
  const textWidth = metrics.width;
  measureCtx.restore();
  return {
    width: textWidth + padding * 2,
    height: fontSize + padding * 2,
  };
}

export function getLayerBaseSize(layer: Layer, scene: Scene): Size {
  switch (layer.type) {
    case 'screen':
      return { width: scene.width, height: scene.height };
    case 'camera':
      return { width: layer.diameter, height: layer.diameter };
    case 'image':
      return { width: layer.width, height: layer.height };
    case 'shape':
      return { width: layer.width, height: layer.height };
    case 'text':
      return measureText(layer.content, layer.fontSize, layer.font, layer.padding);
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
