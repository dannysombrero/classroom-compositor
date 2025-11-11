import {
  useMemo,
  useRef,
  useCallback,
  type PointerEvent as ReactPointerEvent,
  useEffect,
} from 'react';
import type { CanvasLayout } from './PresenterCanvas';
import type { Layer, Scene } from '../types/scene';
import { useAppStore } from '../app/store';
import { getLayerBoundingSize } from '../utils/layerGeometry';
import { requestCurrentStreamFrame } from '../utils/viewerStream';

const MIN_SIZE = 40;

type ResizeHandle = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

interface GroupTransformControlsProps {
  layout: CanvasLayout;
  scene: Scene;
  layerIds: string[];
}

interface Bounds {
  center: { x: number; y: number };
  width: number;
  height: number;
}

interface LayerTransformSnapshot {
  id: string;
  startPos: { x: number; y: number };
  startScale: { x: number; y: number };
  scaleLocked?: boolean;
}

type GroupDragState =
  | {
      type: 'move';
      pointerId: number;
      origin: { x: number; y: number };
      latest: { x: number; y: number };
      layers: LayerTransformSnapshot[];
      historySnapshot?: Scene | null;
      historyApplied: boolean;
    }
  | {
      type: 'resize';
      pointerId: number;
      handle: ResizeHandle;
      opposite: { x: number; y: number };
      startBounds: Bounds;
      layers: LayerTransformSnapshot[];
      historySnapshot?: Scene | null;
      historyApplied: boolean;
    };

const handles: Array<{ key: ResizeHandle; left: string; top: string }> = [
  { key: 'top-left', left: '-8px', top: '-8px' },
  { key: 'top-right', left: 'calc(100% - 8px)', top: '-8px' },
  { key: 'bottom-right', left: 'calc(100% - 8px)', top: 'calc(100% - 8px)' },
  { key: 'bottom-left', left: '-8px', top: 'calc(100% - 8px)' },
];

function computeLayerBounds(layer: Layer, scene: Scene) {
  const size = getLayerBoundingSize(layer, scene);
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  return {
    minX: layer.transform.pos.x - halfWidth,
    maxX: layer.transform.pos.x + halfWidth,
    minY: layer.transform.pos.y - halfHeight,
    maxY: layer.transform.pos.y + halfHeight,
    width: size.width,
    height: size.height,
  };
}

function computeSelectionBounds(layers: Layer[], scene: Scene): Bounds | null {
  if (layers.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const layer of layers) {
    const bounds = computeLayerBounds(layer, scene);
    minX = Math.min(minX, bounds.minX);
    maxX = Math.max(maxX, bounds.maxX);
    minY = Math.min(minY, bounds.minY);
    maxY = Math.max(maxY, bounds.maxY);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return null;
  }

  const width = Math.max(MIN_SIZE, maxX - minX);
  const height = Math.max(MIN_SIZE, maxY - minY);
  return {
    center: {
      x: minX + width / 2,
      y: minY + height / 2,
    },
    width,
    height,
  };
}

function computeCenterFromHandle(
  handle: ResizeHandle,
  opposite: { x: number; y: number },
  halfWidth: number,
  halfHeight: number
): { x: number; y: number } {
  switch (handle) {
    case 'top-left':
      return { x: opposite.x - halfWidth, y: opposite.y - halfHeight };
    case 'top-right':
      return { x: opposite.x + halfWidth, y: opposite.y - halfHeight };
    case 'bottom-right':
      return { x: opposite.x + halfWidth, y: opposite.y + halfHeight };
    case 'bottom-left':
    default:
      return { x: opposite.x - halfWidth, y: opposite.y + halfHeight };
  }
}

const cloneSceneForHistory = (source: Scene | null): Scene | null => {
  if (!source) return null;
  return JSON.parse(JSON.stringify(source)) as Scene;
};

export function GroupTransformControls({ layout, scene, layerIds }: GroupTransformControlsProps) {
  const updateLayer = useAppStore((state) => state.updateLayer);
  const dragStateRef = useRef<GroupDragState | null>(null);
  const pointerMoveRef = useRef<((event: PointerEvent) => void) | null>(null);
  const pointerUpRef = useRef<((event: PointerEvent) => void) | null>(null);
  const pointerCancelRef = useRef<((event: PointerEvent) => void) | null>(null);

  const layers = useMemo(() => {
    return layerIds
      .map((id) => scene.layers.find((layer) => layer.id === id) ?? null)
      .filter((layer): layer is Layer => !!layer && !layer.locked && layer.visible);
  }, [layerIds, scene.layers]);

  const bounds = useMemo(() => computeSelectionBounds(layers, scene), [layers, scene]);

  const pointerToScene = useCallback(
    (clientX: number, clientY: number) => ({
      x: (clientX - layout.x) / layout.scaleX,
      y: (clientY - layout.y) / layout.scaleY,
    }),
    [layout.x, layout.y, layout.scaleX, layout.scaleY]
  );

  const buildLayerSnapshots = useCallback((): LayerTransformSnapshot[] => {
    return layers.map((layer) => ({
      id: layer.id,
      startPos: { ...layer.transform.pos },
      startScale: { ...layer.transform.scale },
      scaleLocked:
        layer.type === 'image' || layer.type === 'shape'
          ? layer.scaleLocked ?? true
          : undefined,
    }));
  }, [layers]);

  const applyMove = useCallback(
    (state: Extract<GroupDragState, { type: 'move' }>, pointerScene: { x: number; y: number }) => {
      const deltaX = pointerScene.x - state.origin.x;
      const deltaY = pointerScene.y - state.origin.y;

      const currentScene = useAppStore.getState().getCurrentScene();
      if (!currentScene) return;

      const historyOptions = () => {
        if (!state.historyApplied) {
          state.historyApplied = true;
          if (state.historySnapshot) {
            return { recordHistory: false, persist: false, historySnapshot: state.historySnapshot };
          }
        }
        return { recordHistory: false, persist: false } as const;
      };

      for (const target of state.layers) {
        const layer = currentScene.layers.find((item) => item.id === target.id);
        if (!layer) continue;

        updateLayer(
          target.id,
          {
            transform: {
              ...layer.transform,
              pos: {
                x: target.startPos.x + deltaX,
                y: target.startPos.y + deltaY,
              },
            },
          },
          historyOptions()
        );
      }

      requestCurrentStreamFrame();
    },
    [updateLayer]
  );

  const applyResize = useCallback(
    (state: Extract<GroupDragState, { type: 'resize' }>, pointerScene: { x: number; y: number }) => {
      const { startBounds, handle, opposite } = state;
      const hasLockedMember = state.layers.some((layer) => layer.scaleLocked);

      const rawWidth = Math.abs(pointerScene.x - opposite.x);
      const rawHeight = Math.abs(pointerScene.y - opposite.y);
      let targetWidth = Math.max(MIN_SIZE, rawWidth);
      let targetHeight = Math.max(MIN_SIZE, rawHeight);

      let scaleX = startBounds.width === 0 ? 1 : targetWidth / startBounds.width;
      let scaleY = startBounds.height === 0 ? 1 : targetHeight / startBounds.height;

      if (hasLockedMember) {
        const uniformScale = Math.min(scaleX, scaleY);
        scaleX = uniformScale;
        scaleY = uniformScale;
        targetWidth = Math.max(MIN_SIZE, startBounds.width * uniformScale);
        targetHeight = Math.max(MIN_SIZE, startBounds.height * uniformScale);
      }

      const halfWidth = Math.max(MIN_SIZE / 2, targetWidth / 2);
      const halfHeight = Math.max(MIN_SIZE / 2, targetHeight / 2);
      const newCenter = computeCenterFromHandle(handle, opposite, halfWidth, halfHeight);

      const currentScene = useAppStore.getState().getCurrentScene();
      if (!currentScene) return;

      const historyOptions = () => {
        if (!state.historyApplied) {
          state.historyApplied = true;
          if (state.historySnapshot) {
            return { recordHistory: false, persist: false, historySnapshot: state.historySnapshot };
          }
        }
        return { recordHistory: false, persist: false } as const;
      };

      for (const target of state.layers) {
        const layer = currentScene.layers.find((item) => item.id === target.id);
        if (!layer) continue;

        const offsetX = target.startPos.x - startBounds.center.x;
        const offsetY = target.startPos.y - startBounds.center.y;
        const nextPos = {
          x: newCenter.x + offsetX * scaleX,
          y: newCenter.y + offsetY * scaleY,
        };

        const uniformScale = Math.min(scaleX, scaleY);
        const baseScaleX = target.scaleLocked ? uniformScale : scaleX;
        const baseScaleY = target.scaleLocked ? uniformScale : scaleY;
        const nextScale = {
          x: target.startScale.x * baseScaleX,
          y: target.startScale.y * baseScaleY,
        };

        updateLayer(
          target.id,
          {
            transform: {
              ...layer.transform,
              pos: nextPos,
              scale: nextScale,
            },
          },
          historyOptions()
        );
      }

      requestCurrentStreamFrame();
    },
    [updateLayer]
  );

  const finishTransform = useCallback((state: GroupDragState | null, cancelled = false) => {
    if (!state) return;
    if (state.historyApplied && !cancelled) {
      void useAppStore.getState().saveScene();
    }
    dragStateRef.current = null;
  }, []);

  const cleanupPointerListeners = useCallback(() => {
    if (pointerMoveRef.current) {
      window.removeEventListener('pointermove', pointerMoveRef.current);
    }
    if (pointerUpRef.current) {
      window.removeEventListener('pointerup', pointerUpRef.current);
    }
    if (pointerCancelRef.current) {
      window.removeEventListener('pointercancel', pointerCancelRef.current);
    }
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== event.pointerId) return;

      const pointerScene = pointerToScene(event.clientX, event.clientY);
      event.preventDefault();

      if (state.type === 'move') {
        applyMove(state, pointerScene);
      } else {
        applyResize(state, pointerScene);
      }
    },
    [applyMove, applyResize, pointerToScene]
  );
  pointerMoveRef.current = handlePointerMove;

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== event.pointerId) return;
      finishTransform(state);
      cleanupPointerListeners();
    },
    [finishTransform, cleanupPointerListeners]
  );
  pointerUpRef.current = handlePointerUp;

  const startMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!bounds) return;

      const pointerScene = pointerToScene(event.clientX, event.clientY);
      dragStateRef.current = {
        type: 'move',
        pointerId: event.pointerId,
        origin: pointerScene,
        latest: pointerScene,
        layers: buildLayerSnapshots(),
        historySnapshot: cloneSceneForHistory(useAppStore.getState().getCurrentScene()),
        historyApplied: false,
      };
      cleanupPointerListeners();
      if (pointerMoveRef.current) {
        window.addEventListener('pointermove', pointerMoveRef.current, { passive: false });
      }
      if (pointerUpRef.current) {
        window.addEventListener('pointerup', pointerUpRef.current);
      }
      if (pointerCancelRef.current) {
        window.addEventListener('pointercancel', pointerCancelRef.current);
      }
    },
    [bounds, pointerToScene, buildLayerSnapshots]
  );

  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, handle: ResizeHandle) => {
      event.preventDefault();
      event.stopPropagation();
      if (!bounds) return;

      const snapshots = buildLayerSnapshots();
      if (snapshots.length === 0) {
        return;
      }

      const opposite: { [K in ResizeHandle]: { x: number; y: number } } = {
        'top-left': {
          x: bounds.center.x + bounds.width / 2,
          y: bounds.center.y + bounds.height / 2,
        },
        'top-right': {
          x: bounds.center.x - bounds.width / 2,
          y: bounds.center.y + bounds.height / 2,
        },
        'bottom-right': {
          x: bounds.center.x - bounds.width / 2,
          y: bounds.center.y - bounds.height / 2,
        },
        'bottom-left': {
          x: bounds.center.x + bounds.width / 2,
          y: bounds.center.y - bounds.height / 2,
        },
      };

      dragStateRef.current = {
        type: 'resize',
        pointerId: event.pointerId,
        handle,
        opposite: opposite[handle],
        startBounds: bounds,
        layers: snapshots,
        historySnapshot: cloneSceneForHistory(useAppStore.getState().getCurrentScene()),
        historyApplied: false,
      };

      cleanupPointerListeners();
      if (pointerMoveRef.current) {
        window.addEventListener('pointermove', pointerMoveRef.current, { passive: false });
      }
      if (pointerUpRef.current) {
        window.addEventListener('pointerup', pointerUpRef.current);
      }
      if (pointerCancelRef.current) {
        window.addEventListener('pointercancel', pointerCancelRef.current);
      }
    },
    [bounds, buildLayerSnapshots]
  );

  const handlePointerCancel = useCallback(
    (event: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== event.pointerId) return;
      finishTransform(state, true);
      cleanupPointerListeners();
    },
    [finishTransform, cleanupPointerListeners]
  );
  pointerCancelRef.current = handlePointerCancel;

  useEffect(
    () => () => {
      cleanupPointerListeners();
    },
    [cleanupPointerListeners]
  );

  if (!bounds || layers.length < 2) {
    return null;
  }

  const left = layout.x + (bounds.center.x - bounds.width / 2) * layout.scaleX;
  const top = layout.y + (bounds.center.y - bounds.height / 2) * layout.scaleY;
  const width = bounds.width * layout.scaleX;
  const height = bounds.height * layout.scaleY;

  return (
    <div
      style={{
        position: 'fixed',
        left,
        top,
        width,
        height,
        border: '2px solid rgba(0, 166, 255, 0.85)',
        boxShadow: '0 0 0 1px rgba(0, 166, 255, 0.45)',
        background: 'rgba(0, 166, 255, 0.08)',
        cursor: 'move',
        pointerEvents: 'auto',
        zIndex: 16,
      }}
      onPointerDown={startMove}
    >
      {handles.map((handle) => {
        const cursor = handle.key === 'top-left' || handle.key === 'bottom-right'
          ? 'nwse-resize'
          : 'nesw-resize';
        return (
          <button
            key={handle.key}
            onPointerDown={(event) => startResize(event, handle.key)}
            style={{
              position: 'absolute',
              left: handle.left,
              top: handle.top,
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              border: '2px solid rgba(5, 120, 200, 0.9)',
              background: 'rgba(0, 166, 255, 0.85)',
              transform: 'translate(-50%, -50%)',
              cursor,
              padding: 0,
            }}
            aria-label={`Resize from ${handle.key}`}
          />
        );
      })}
    </div>
  );
}
