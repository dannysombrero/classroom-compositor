import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { CanvasLayout } from './PresenterCanvas';
import type { Layer, Scene } from '../types/scene';
import { useAppStore } from '../app/store';
import { getLayerBoundingSize } from '../utils/layerGeometry';
import { requestCurrentStreamFrame } from '../utils/viewerStream';

interface CanvasSelectionOverlayProps {
  layout: CanvasLayout | null;
  scene: Scene | null;
  skipLayerIds?: string[];
}

interface ScenePoint {
  x: number;
  y: number;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface MarqueeRect extends Bounds {}

const MOVE_THRESHOLD = 2;

type InteractionState =
  | { type: 'idle' }
  | { type: 'layer-click'; pointerId: number }
  | {
      type: 'marquee';
      pointerId: number;
      origin: ScenePoint;
      latest: ScenePoint;
      shiftKey: boolean;
    };

interface MoveTarget {
  id: string;
  start: ScenePoint;
}

interface MoveSelectionState {
  type: 'move-selection';
  pointerId: number;
  origin: ScenePoint;
  latest: ScenePoint;
  moved: boolean;
  targets: MoveTarget[];
  historySnapshot?: Scene | null;
  historyApplied: boolean;
}

interface PendingMoveState {
  type: 'pending-move';
  pointerId: number;
  origin: ScenePoint;
  latest: ScenePoint;
  moved: boolean;
  targets: MoveTarget[];
  historySnapshot?: Scene | null;
  historyApplied: boolean;
}

type OverlayInteractionState = InteractionState | PendingMoveState | MoveSelectionState;

const IDLE_STATE: OverlayInteractionState = { type: 'idle' };

const cloneSceneForHistory = (source: Scene | null): Scene | null => {
  if (!source) return null;
  return JSON.parse(JSON.stringify(source)) as Scene;
};

function computeBounds(layer: Layer, scene: Scene): Bounds {
  const size = getLayerBoundingSize(layer, scene);
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  const { x, y } = layer.transform.pos;

  return {
    minX: x - halfWidth,
    maxX: x + halfWidth,
    minY: y - halfHeight,
    maxY: y + halfHeight,
  };
}

function pointInBounds(point: ScenePoint, bounds: Bounds): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

function rectIntersects(layerBounds: Bounds, marquee: Bounds): boolean {
  return !(
    marquee.maxX < layerBounds.minX ||
    marquee.minX > layerBounds.maxX ||
    marquee.maxY < layerBounds.minY ||
    marquee.minY > layerBounds.maxY
  );
}

export function CanvasSelectionOverlay({ layout, scene, skipLayerIds }: CanvasSelectionOverlayProps) {
  const setSelection = useAppStore((state) => state.setSelection);
  const selection = useAppStore((state) => state.selection);
  const updateLayer = useAppStore((state) => state.updateLayer);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const skipIds = useMemo(() => new Set(skipLayerIds ?? []), [skipLayerIds]);

  type LayerIndexEntry = { layer: Layer; index: number };

  const selectableLayers = useMemo<LayerIndexEntry[]>(() => {
    if (!scene) return [];
    return scene.layers
      .map((layer, index) => ({ layer, index }))
      .filter(({ layer }) => layer.visible && !skipIds.has(layer.id));
  }, [scene, skipIds]);

  const layersSortedByZ = useMemo(() => {
    if (!scene) return [] as Layer[];
    return selectableLayers
      .slice()
      .sort((a, b) => {
        const zDiff = b.layer.z - a.layer.z;
        if (zDiff !== 0) return zDiff;
        // If z is equal, fall back to original order so last drawn is hit first
        return b.index - a.index;
      })
      .map(({ layer }) => layer);
  }, [scene, selectableLayers]);

  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const interactionRef = useRef<OverlayInteractionState>(IDLE_STATE);

  const selectedLayers = useMemo(() => {
    if (!scene) return [] as Layer[];
    const layerMap = new Map(scene.layers.map((layer) => [layer.id, layer]));
    return selection
      .map((id) => layerMap.get(id))
      .filter((layer): layer is Layer => !!layer && !skipIds.has(layer.id));
  }, [scene, selection, skipIds]);

  const pointerToScene = useCallback(
    (clientX: number, clientY: number): ScenePoint | null => {
      if (!layout || !scene) return null;
      const sceneX = (clientX - layout.x) / layout.scaleX;
      const sceneY = (clientY - layout.y) / layout.scaleY;
      if (!Number.isFinite(sceneX) || !Number.isFinite(sceneY)) {
        return null;
      }
      return { x: sceneX, y: sceneY };
    },
    [layout, scene]
  );

  const pickLayerAtPoint = useCallback(
    (point: ScenePoint): Layer | null => {
      if (!scene) return null;
      for (const layer of layersSortedByZ) {
        const bounds = computeBounds(layer, scene);
        if (pointInBounds(point, bounds)) {
          return layer;
        }
      }
      return null;
    },
    [layersSortedByZ, scene]
  );

  const normalizeRect = useCallback((a: ScenePoint, b: ScenePoint): Bounds => {
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    return { minX, maxX, minY, maxY };
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!scene || !layout) return;
      if (event.button !== 0) return;

      const pointerScene = pointerToScene(event.clientX, event.clientY);
      if (!pointerScene) return;

      if (
        pointerScene.x < 0 ||
        pointerScene.y < 0 ||
        pointerScene.x > scene.width ||
        pointerScene.y > scene.height
      ) {
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);

      const targetLayer = pickLayerAtPoint(pointerScene);
      if (targetLayer) {
        const isMulti = event.shiftKey || event.metaKey;
        const currentSelection = selectionRef.current;

        if (isMulti) {
          const alreadySelected = currentSelection.includes(targetLayer.id);
          const nextSelection = alreadySelected
            ? currentSelection.filter((id) => id !== targetLayer.id)
            : [...currentSelection, targetLayer.id];
          selectionRef.current = nextSelection;
          setSelection(nextSelection);
          interactionRef.current = { type: 'layer-click', pointerId: event.pointerId };
          setMarqueeRect(null);
          event.preventDefault();
          return;
        }

        let nextSelection = currentSelection;
        if (!currentSelection.includes(targetLayer.id)) {
          nextSelection = [targetLayer.id];
        } else if (currentSelection[0] !== targetLayer.id) {
          nextSelection = [targetLayer.id, ...currentSelection.filter((id) => id !== targetLayer.id)];
        }

        if (nextSelection !== currentSelection) {
          selectionRef.current = nextSelection;
          setSelection(nextSelection);
        }

        const targetLayers = nextSelection
          .map((id) => scene.layers.find((layer) => layer.id === id) ?? null)
          .filter((layer): layer is Layer => !!layer && !layer.locked && layer.visible && !skipIds.has(layer.id))
          .map((layer) => ({
            id: layer.id,
            start: { x: layer.transform.pos.x, y: layer.transform.pos.y },
          }));

        if (targetLayers.length > 0) {
          interactionRef.current = {
            type: 'pending-move',
            pointerId: event.pointerId,
            origin: pointerScene,
            latest: pointerScene,
            moved: false,
            targets: targetLayers,
            historySnapshot: cloneSceneForHistory(useAppStore.getState().getCurrentScene()),
            historyApplied: false,
          };
          setMarqueeRect(null);
        } else {
          interactionRef.current = { type: 'layer-click', pointerId: event.pointerId };
        }
      } else {
        interactionRef.current = {
          type: 'marquee',
          pointerId: event.pointerId,
          origin: pointerScene,
          latest: pointerScene,
          shiftKey: event.shiftKey || event.metaKey,
        };
        setMarqueeRect({
          minX: pointerScene.x,
          maxX: pointerScene.x,
          minY: pointerScene.y,
          maxY: pointerScene.y,
        });
      }

      event.preventDefault();
    },
    [layout, pickLayerAtPoint, pointerToScene, scene, setSelection, skipIds]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      let state = interactionRef.current;
      if (state.type === 'pending-move' && state.pointerId === event.pointerId) {
        const pointerScene = pointerToScene(event.clientX, event.clientY);
        if (!pointerScene) return;

        const deltaX = pointerScene.x - state.origin.x;
        const deltaY = pointerScene.y - state.origin.y;
        state.latest = pointerScene;

        const withinThreshold = Math.abs(deltaX) < MOVE_THRESHOLD && Math.abs(deltaY) < MOVE_THRESHOLD;
        if (withinThreshold) {
          return;
        }

        const promotedState: MoveSelectionState = {
          type: 'move-selection',
          pointerId: state.pointerId,
          origin: state.origin,
          latest: pointerScene,
          moved: false,
          targets: state.targets,
          historySnapshot: state.historySnapshot,
          historyApplied: state.historyApplied,
        };
        interactionRef.current = promotedState;
        state = promotedState;
      }

      if (state.type === 'move-selection' && state.pointerId === event.pointerId) {
        const pointerScene = pointerToScene(event.clientX, event.clientY);
        if (!pointerScene) return;

        const deltaX = pointerScene.x - state.origin.x;
        const deltaY = pointerScene.y - state.origin.y;

        state.latest = pointerScene;

        const appState = useAppStore.getState();
        const currentSceneState = appState.getCurrentScene();
        if (!currentSceneState) return;

        const historyOptions = () => {
          if (!state.historyApplied) {
            state.historyApplied = true;
            if (state.historySnapshot) {
              return { recordHistory: false, persist: false, historySnapshot: state.historySnapshot };
            }
          }
          return { recordHistory: false, persist: false } as const;
        };

        for (const target of state.targets) {
          const layer = currentSceneState.layers.find((item) => item.id === target.id);
          if (!layer) continue;

          updateLayer(
            target.id,
            {
              transform: {
                ...layer.transform,
                pos: {
                  x: target.start.x + deltaX,
                  y: target.start.y + deltaY,
                },
              },
            },
            historyOptions()
          );
        }

        state.moved = true;
        requestCurrentStreamFrame();
        event.preventDefault();
        return;
      }

      if (state.type !== 'marquee' || state.pointerId !== event.pointerId) {
        return;
      }

      const pointerScene = pointerToScene(event.clientX, event.clientY);
      if (!pointerScene) return;

      state.latest = pointerScene;
      setMarqueeRect(normalizeRect(state.origin, pointerScene));
      event.preventDefault();
    },
    [normalizeRect, pointerToScene, updateLayer]
  );

  const finishMove = useCallback((state: MoveSelectionState, options?: { cancel?: boolean }) => {
    const shouldSave = state.historyApplied && !options?.cancel && state.moved;
    interactionRef.current = IDLE_STATE;
    setMarqueeRect(null);
    if (shouldSave) {
      void useAppStore.getState().saveScene();
    }
  }, [setMarqueeRect]);

  const finishMarquee = useCallback(() => {
    const state = interactionRef.current;
    if (state.type !== 'marquee' || !scene) {
      interactionRef.current = IDLE_STATE;
      setMarqueeRect(null);
      return;
    }

    const normalized = normalizeRect(state.origin, state.latest);
    const width = normalized.maxX - normalized.minX;
    const height = normalized.maxY - normalized.minY;
    const isClick = width < 2 && height < 2;

    if (isClick) {
      if (!state.shiftKey && selectionRef.current.length > 0) {
        setSelection([]);
      }
      interactionRef.current = IDLE_STATE;
      setMarqueeRect(null);
      return;
    }

    const hitIds = layersSortedByZ
      .filter((layer) => {
        const bounds = computeBounds(layer, scene);
        return rectIntersects(bounds, normalized);
      })
      .map((layer) => layer.id);

    if (state.shiftKey) {
      const combined = new Set(selectionRef.current);
      hitIds.forEach((id) => combined.add(id));
      setSelection(Array.from(combined));
    } else {
      setSelection(hitIds);
    }

    interactionRef.current = IDLE_STATE;
    setMarqueeRect(null);
  }, [layersSortedByZ, normalizeRect, scene, setSelection]);

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = interactionRef.current;
      if (state.type === 'move-selection' && state.pointerId === event.pointerId) {
        finishMove(state);
        event.currentTarget.releasePointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
      if (state.type === 'pending-move' && state.pointerId === event.pointerId) {
        interactionRef.current = IDLE_STATE;
        setMarqueeRect(null);
        event.currentTarget.releasePointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
      if (state.type === 'marquee' && state.pointerId === event.pointerId) {
        finishMarquee();
        event.currentTarget.releasePointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
      if (state.type === 'layer-click' && state.pointerId === event.pointerId) {
        interactionRef.current = IDLE_STATE;
        setMarqueeRect(null);
        event.currentTarget.releasePointerCapture(event.pointerId);
        event.preventDefault();
      }
    },
    [finishMarquee, finishMove]
  );

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = interactionRef.current;

      if (state.type === 'move-selection' && state.pointerId === event.pointerId) {
        finishMove(state, { cancel: true });
        event.currentTarget.releasePointerCapture(event.pointerId);
        return;
      }

      if (state.type === 'pending-move' && state.pointerId === event.pointerId) {
        interactionRef.current = IDLE_STATE;
        event.currentTarget.releasePointerCapture(event.pointerId);
        return;
      }

      if (state.type === 'marquee' && state.pointerId === event.pointerId) {
        interactionRef.current = IDLE_STATE;
        setMarqueeRect(null);
        event.currentTarget.releasePointerCapture(event.pointerId);
        return;
      }

      if (state.type === 'layer-click' && state.pointerId === event.pointerId) {
        interactionRef.current = IDLE_STATE;
        setMarqueeRect(null);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [finishMove]
  );

  if (!layout || !scene) {
    return null;
  }

  const selectionOutlines = selectedLayers.map((layer) => {
    const bounds = computeBounds(layer, scene);
    const left = layout.x + bounds.minX * layout.scaleX;
    const top = layout.y + bounds.minY * layout.scaleY;
    const width = Math.max(0, (bounds.maxX - bounds.minX) * layout.scaleX);
    const height = Math.max(0, (bounds.maxY - bounds.minY) * layout.scaleY);
    const isPrimary = selectionRef.current[0] === layer.id;

    return (
      <div
        key={`selection-${layer.id}`}
        style={{
          position: 'fixed',
          left,
          top,
          width,
          height,
          border: isPrimary ? '2px solid rgba(0, 166, 255, 0.95)' : '1px dashed rgba(0, 166, 255, 0.75)',
          boxShadow: isPrimary ? '0 0 0 1px rgba(0, 166, 255, 0.35)' : '0 0 0 1px rgba(0, 166, 255, 0.25)',
          backgroundColor: isPrimary ? 'rgba(0, 166, 255, 0.12)' : 'rgba(0, 166, 255, 0.08)',
          pointerEvents: 'none',
          zIndex: 11,
        }}
      />
    );
  });

  const marqueeVisual = (() => {
    if (!marqueeRect) return null;
    const left = layout.x + marqueeRect.minX * layout.scaleX;
    const top = layout.y + marqueeRect.minY * layout.scaleY;
    const width = Math.max(0, (marqueeRect.maxX - marqueeRect.minX) * layout.scaleX);
    const height = Math.max(0, (marqueeRect.maxY - marqueeRect.minY) * layout.scaleY);
    return (
      <div
        key="marquee"
        style={{
          position: 'fixed',
          left,
          top,
          width,
          height,
          border: '1px dashed rgba(0, 166, 255, 0.9)',
          backgroundColor: 'rgba(0, 166, 255, 0.2)',
          pointerEvents: 'none',
          zIndex: 12,
        }}
      />
    );
  })();

  return (
    <>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{
          position: 'fixed',
          left: layout.x,
          top: layout.y,
          width: layout.width,
          height: layout.height,
          pointerEvents: 'auto',
          zIndex: 10,
        }}
      />
      {marqueeVisual}
      {selectionOutlines}
    </>
  );
}
