import type {
  CameraLayer,
  ScreenLayer,
  TextLayer,
  ImageLayer,
  ShapeLayer,
  Transform,
} from '../types/scene';

const DEFAULT_CAMERA_DIAMETER = 320;

function createBaseTransform(
  x: number,
  y: number
): Transform {
  return {
    pos: { x, y },
    scale: { x: 1, y: 1 },
    rot: 0,
    opacity: 1,
  };
}

export function createScreenLayer(
  id: string,
  sceneWidth: number,
  sceneHeight: number
): ScreenLayer {
  return {
    id,
    type: 'screen',
    name: 'Screen Capture',
    visible: true,
    locked: false,
    z: 0,
    transform: createBaseTransform(sceneWidth / 2, sceneHeight / 2),
    // streamId is undefined initially - will be set when screen share is activated
  };
}

export function createCameraLayer(
  id: string,
  sceneWidth: number,
  sceneHeight: number
): CameraLayer {
  return {
    id,
    type: 'camera',
    name: 'Camera',
    visible: true,
    locked: false,
    z: 0,
    transform: createBaseTransform(sceneWidth - DEFAULT_CAMERA_DIAMETER, sceneHeight - DEFAULT_CAMERA_DIAMETER),
    streamId: id,
    diameter: DEFAULT_CAMERA_DIAMETER,
    videoOffset: { x: 0, y: 0 },
    videoScale: 1,
  };
}

export function createTextLayer(
  id: string,
  sceneWidth: number,
  sceneHeight: number
): TextLayer {
  return {
    id,
    type: 'text',
    name: 'Text',
    visible: true,
    locked: false,
    z: 0,
    transform: createBaseTransform(sceneWidth / 2, sceneHeight / 3),
    content: 'New Text',
    font: 'Inter, system-ui, sans-serif',
    fontSize: 48,
    textAlign: 'center',
    textColor: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    padding: 24,
    shadow: '0px 8px 24px rgba(0, 0, 0, 0.45)',
    autoSize: true,
  };
}

interface ImageLayerOptions {
  width: number;
  height: number;
  dataUri?: string;
}

export function createImageLayer(
  id: string,
  sceneWidth: number,
  sceneHeight: number,
  options: ImageLayerOptions
): ImageLayer {
  const { width, height, dataUri } = options;
  return {
    id,
    type: 'image',
    name: 'Image',
    visible: true,
    locked: false,
    z: 0,
    transform: createBaseTransform(sceneWidth / 2, sceneHeight / 2),
    assetId: dataUri ? 'embedded' : 'placeholder',
    width,
    height,
    dataUri,
    scaleLocked: true,
  };
}

export function createShapeLayer(
  id: string,
  sceneWidth: number,
  sceneHeight: number
): ShapeLayer {
  return {
    id,
    type: 'shape',
    name: 'Rectangle',
    visible: true,
    locked: false,
    z: 0,
    transform: createBaseTransform(sceneWidth / 2, sceneHeight / 2),
    shapeType: 'rect',
    width: 640,
    height: 360,
    fillColor: 'rgba(0, 0, 0, 0.4)',
    strokeColor: 'rgba(255, 255, 255, 0.45)',
    strokeWidth: 4,
    scaleLocked: true,
  };
}
