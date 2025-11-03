import { useEffect, useMemo, useRef, useState } from 'react';
import type { Scene, Layer } from '../types/scene';
import type { CanvasLayout } from './PresenterCanvas';
import { useAppStore } from '../app/store';
import { getLayerBaseSize } from '../utils/layerGeometry';
import { requestCurrentStreamFrame } from '../utils/viewerStream';

const FRAME_THROTTLE_MS = 16; // ~60fps

interface CanvasSelectionOverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  layout: CanvasLayout | null;
  scene: Scene | null;
}

type Point = { x: number; y: number };

type MarqueeDragState = {
  type: 'marquee';
  pointerId: number;
  startScene: Point;
  currentScene: Point;
  initialSelection: string[];
  extend: boolean;
};

type MoveSelectionDragState = {
  type: 'move-selection';
  pointerId: number;
  startScene: Point;
  layerSnapshots: Array<{
    id: string;
    initialPos: { x: number; y: number };
  }>;
  historySnapshot?: Scene | null;
  historyApplied?: boolean;
};

type DragState = MarqueeDragState | MoveSelectionDragState;

interface SceneRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function CanvasSelectionOverlay({ canvasRef, layout, scene }: CanvasSelectionOverlayProps) {
  const [marqueeRect, setMarqueeRect] = useState<SceneRect | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const lastFrameRequestRef = useRef<number>(0);
  const selection = useAppStore((state) => state.selection);

  const topLayers = useMemo(() => {
    if (!scene) return [];
    return [...scene.layers]
      .filter((layer) => layer.visible)
      .sort((a, b) => b.z - a.z);
  }, [scene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout || !scene) {
      return;
    }

    const toScenePoint = (event: PointerEvent): Point => ({
      x: (event.clientX - layout.x) / layout.scaleX,
      y: (event.clientY - layout.y) / layout.scaleY,
    });

    const hitTest = (layer: Layer, point: Point): boolean => {
      const bounds = getLayerBounds(layer, scene);
      return (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
      );
    };

    const getLayerAtPoint = (point: Point): Layer | null => {
      for (const layer of topLayers) {
        if (hitTest(layer, point)) {
          return layer;
        }
      }
      return null;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const point = toScenePoint(event);
      const multi = event.shiftKey || event.metaKey || event.ctrlKey;
      const hitLayer = getLayerAtPoint(point);
      const selection = useAppStore.getState().selection;

      if (hitLayer) {
        if (multi) {
          const store = useAppStore.getState();
          if (selection.includes(hitLayer.id)) {
            store.setSelection(selection.filter((id) => id !== hitLayer.id));
          } else {
            store.setSelection([...selection, hitLayer.id]);
          }
          return;
        }

        if (!selection.includes(hitLayer.id)) {
          useAppStore.getState().setSelection([hitLayer.id]);
        }

        const activeSelection = useAppStore.getState().selection;
        const movableSnapshots = activeSelection
          .map((id) => scene.layers.find((layer) => layer.id === id))
          .filter((layer): layer is Layer => Boolean(layer && !layer.locked))
          .map((layer) => ({
            id: layer.id,
            initialPos: { ...layer.transform.pos },
          }));

        if (movableSnapshots.length === 0) {
          return;
        }

        dragStateRef.current = {
          type: 'move-selection',
          pointerId: event.pointerId,
          startScene: point,
          layerSnapshots: movableSnapshots,
          historySnapshot: cloneSceneForHistory(useAppStore.getState().getCurrentScene()),
          historyApplied: false,
        };

        event.preventDefault();
        canvas.setPointerCapture?.(event.pointerId);
        window.addEventListener('pointermove', handlePointerMove, { passive: false });
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
        return;
      }

      dragStateRef.current = {
        type: 'marquee',
        pointerId: event.pointerId,
        startScene: point,
        currentScene: point,
        initialSelection: selection,
        extend: multi,
      };
      setMarqueeRect({ x: point.x, y: point.y, width: 0, height: 0 });
      event.preventDefault();
      window.addEventListener('pointermove', handlePointerMove, { passive: false });
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== event.pointerId) return;
      event.preventDefault();

      if (state.type === 'marquee') {
        const scenePoint = toScenePoint(event);
        dragStateRef.current = {
          ...state,
          currentScene: scenePoint,
        };
        setMarqueeRect(calculateRect(state.startScene, scenePoint));
        return;
      }

      if (state.type === 'move-selection') {
        const scenePoint = toScenePoint(event);
        const deltaX = scenePoint.x - state.startScene.x;
        const deltaY = scenePoint.y - state.startScene.y;
        const store = useAppStore.getState();
        const currentScene = store.getCurrentScene();
        if (!currentScene) {
          return;
        }

        const layerUpdates: Array<{ id: string; changes: Partial<Layer> }> = [];

        state.layerSnapshots.forEach(({ id, initialPos }) => {
          const currentLayer = currentScene.layers.find((layer) => layer.id === id);
          if (!currentLayer) {
            return;
          }
          layerUpdates.push({
            id,
            changes: {
              transform: {
                ...currentLayer.transform,
                pos: {
                  x: initialPos.x + deltaX,
                  y: initialPos.y + deltaY,
                },
              },
            },
          });
        });

        if (layerUpdates.length > 0) {
          const historyOptions = state.historyApplied
            ? { recordHistory: false, persist: false }
            : { historySnapshot: state.historySnapshot ?? null, persist: false };

          store.updateLayers(layerUpdates, historyOptions);
          state.historyApplied = true;
          
          // Throttled frame request to limit redraws to ~60fps
          const now = Date.now();
          if (now - lastFrameRequestRef.current > FRAME_THROTTLE_MS) {
            requestCurrentStreamFrame();
            lastFrameRequestRef.current = now;
          }
        }
        return;
      }
    };

    const applySelection = (ids: string[]) => {
      const unique = Array.from(new Set(ids));
      useAppStore.getState().setSelection(unique);
    };

    const handlePointerUp = (_event: PointerEvent) => {
      const state = dragStateRef.current;
      dragStateRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      setMarqueeRect(null);
      if (!state) return;

      if (state.type === 'marquee') {
        const rect = calculateRect(state.startScene, state.currentScene);
        const selectedIds = scene.layers
          .filter((layer) => layer.visible)
          .filter((layer) => intersects(rect, getLayerBounds(layer, scene)))
          .map((layer) => layer.id);
        if (state.extend) {
          applySelection([...state.initialSelection, ...selectedIds]);
        } else {
          applySelection(selectedIds);
        }
        return;
      }

      if (state.type === 'move-selection' && state.historyApplied) {
        void useAppStore.getState().saveScene();
        requestCurrentStreamFrame();
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [canvasRef, layout, scene, topLayers]);

  if (!layout || !scene) {
    return null;
  }

  const marqueeDisplay = marqueeRect
    ? {
        left: layout.x + marqueeRect.x * layout.scaleX,
        top: layout.y + marqueeRect.y * layout.scaleY,
        width: marqueeRect.width * layout.scaleX,
        height: marqueeRect.height * layout.scaleY,
      }
    : null;

  const selectedRects = useMemo(() => {
    if (!scene || !layout) return [] as SceneRect[];
    const unique = Array.from(new Set(selection));
    return unique
      .map((id) => scene.layers.find((layer) => layer.id === id))
      .filter((layer): layer is Layer => Boolean(layer && layer.visible))
      .map((layer) => getLayerBounds(layer, scene))
      .map((rect) => ({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      }));
  }, [selection, scene, layout]);

  return (
    <>
      {selectedRects.map((rect, index) => {
        const display = {
          left: layout.x + rect.x * layout.scaleX,
          top: layout.y + rect.y * layout.scaleY,
          width: rect.width * layout.scaleX,
          height: rect.height * layout.scaleY,
        };
        return (
          <div
            key={`selection-${index}`}
            style={{
              position: 'fixed',
              left: `${display.left}px`,
              top: `${display.top}px`,
              width: `${display.width}px`,
              height: `${display.height}px`,
              pointerEvents: 'none',
              border: '2px solid rgba(0, 166, 255, 0.8)',
              boxShadow: '0 0 0 2px rgba(0, 166, 255, 0.2)',
              background: 'rgba(0, 166, 255, 0.12)',
              zIndex: 11,
            }}
          />
        );
      })}
      {marqueeDisplay && (
        <div
          style={{
            position: 'fixed',
            left: `${marqueeDisplay.left}px`,
            top: `${marqueeDisplay.top}px`,
            width: `${Math.max(0, marqueeDisplay.width)}px`,
            height: `${Math.max(0, marqueeDisplay.height)}px`,
            pointerEvents: 'none',
            border: '1px solid rgba(0, 166, 255, 0.75)',
            background: 'rgba(0, 166, 255, 0.15)',
            zIndex: 12,
          }}
        />
      )}
    </>
  );
}

function calculateRect(start: Point, end: Point): SceneRect {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return { x, y, width, height };
}

function getLayerBounds(layer: Layer, scene: Scene): SceneRect {
  const base = getLayerBaseSize(layer, scene);
  const scaleX = Math.abs(layer.transform.scale.x || 1);
  const scaleY = Math.abs(layer.transform.scale.y || 1);
  const width = base.width * scaleX;
  const height = base.height * scaleY;
  return {
    x: layer.transform.pos.x - width / 2,
    y: layer.transform.pos.y - height / 2,
    width,
    height,
  };
}

function intersects(a: SceneRect, b: SceneRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function cloneSceneForHistory(source: Scene | null): Scene | null {
  if (!source) return null;
  return JSON.parse(JSON.stringify(source)) as Scene;
}
