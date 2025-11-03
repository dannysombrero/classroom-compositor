import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { CanvasLayout } from './PresenterCanvas';
import type { Layer, Scene } from '../types/scene';
import { useAppStore } from '../app/store';
import { getLayerBoundingSize } from '../utils/layerGeometry';

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

const IDLE_STATE: InteractionState = { type: 'idle' };

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
  const interactionRef = useRef<InteractionState>(IDLE_STATE);

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
        if (isMulti) {
          const alreadySelected = selectionRef.current.includes(targetLayer.id);
          const nextSelection = alreadySelected
            ? selectionRef.current.filter((id) => id !== targetLayer.id)
            : [...selectionRef.current, targetLayer.id];
          setSelection(nextSelection);
        } else {
          if (selectionRef.current.length !== 1 || selectionRef.current[0] !== targetLayer.id) {
            setSelection([targetLayer.id]);
          }
        }
        interactionRef.current = { type: 'layer-click', pointerId: event.pointerId };
        setMarqueeRect(null);
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
    [layout, pickLayerAtPoint, pointerToScene, scene, setSelection]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = interactionRef.current;
      if (state.type !== 'marquee' || state.pointerId !== event.pointerId) {
        return;
      }

      const pointerScene = pointerToScene(event.clientX, event.clientY);
      if (!pointerScene) return;

      state.latest = pointerScene;
      setMarqueeRect(normalizeRect(state.origin, pointerScene));
      event.preventDefault();
    },
    [normalizeRect, pointerToScene]
  );

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
      if (state.type !== 'layer-click' && state.type !== 'marquee') {
        return;
      }
      if (state.pointerId !== event.pointerId) {
        return;
      }

      if (state.type === 'marquee') {
        finishMarquee();
      } else {
        interactionRef.current = IDLE_STATE;
        setMarqueeRect(null);
      }

      event.currentTarget.releasePointerCapture(event.pointerId);
      event.preventDefault();
    },
    [finishMarquee]
  );

  const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = interactionRef.current;
    if (state.type === 'marquee' && state.pointerId === event.pointerId) {
      interactionRef.current = IDLE_STATE;
      setMarqueeRect(null);
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

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
