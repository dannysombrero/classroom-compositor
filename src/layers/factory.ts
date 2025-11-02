import type { CameraLayer, ScreenLayer, Transform } from '../types/scene';

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
    streamId: id,
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
  };
}

