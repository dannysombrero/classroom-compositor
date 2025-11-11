import { useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Layer, Scene } from '../types/scene';
import type { CanvasLayout } from './PresenterCanvas';
import { getLayerBaseSize, getLayerBoundingSize, measureTextBlock } from '../utils/layerGeometry';
import { useAppStore } from '../app/store';
import { requestCurrentStreamFrame } from '../utils/viewerStream';

const MIN_SIZE = 40;
const IMAGE_SCALE_MIN = 0.05;
const IMAGE_SCALE_MAX = 6;

type ResizeHandle = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

type DragState =
  | {
      type: 'move';
      pointerId: number;
      offsetX: number;
      offsetY: number;
      historySnapshot?: Scene | null;
      historyApplied?: boolean;
    }
  | {
      type: 'resize';
      pointerId: number;
      handle: ResizeHandle;
      opposite: { x: number; y: number };
      baseSize: { width: number; height: number };
      initialFontSize?: number;
      historySnapshot?: Scene | null;
      historyApplied?: boolean;
    };

interface TransformControlsProps {
  layout: CanvasLayout;
  layer: Layer;
  scene: Scene;
  onRequestEdit?: () => void;
}

const cloneSceneForHistory = (source: Scene | null): Scene | null => {
  if (!source) return null;
  return JSON.parse(JSON.stringify(source)) as Scene;
};

export function TransformControls({ layout, layer, scene, onRequestEdit }: TransformControlsProps) {
  const updateLayer = useAppStore((state) => state.updateLayer);
  const dragStateRef = useRef<DragState | null>(null);
  const layerRef = useRef(layer);

  useEffect(() => {
    layerRef.current = layer;
  }, [layer]);

  const baseSize = useMemo(() => getLayerBaseSize(layer, scene), [layer, scene]);
  const boundingSize = useMemo(() => getLayerBoundingSize(layer, scene), [layer, scene]);

  const halfWidth = boundingSize.width / 2;
  const halfHeight = boundingSize.height / 2;

  const centerScene = layer.transform.pos;
  const centerPx = {
    x: layout.x + centerScene.x * layout.scaleX,
    y: layout.y + centerScene.y * layout.scaleY,
  };

  const boxStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${centerPx.x - halfWidth * layout.scaleX}px`,
    top: `${centerPx.y - halfHeight * layout.scaleY}px`,
    width: `${boundingSize.width * layout.scaleX}px`,
    height: `${boundingSize.height * layout.scaleY}px`,
    border: '2px solid rgba(0, 166, 255, 0.85)',
    boxShadow: '0 0 0 1px rgba(0, 166, 255, 0.45)',
    background: 'rgba(0, 166, 255, 0.08)',
    cursor: 'move',
    pointerEvents: 'auto',
    zIndex: 16,
  };

  const handles: Array<{ key: ResizeHandle; left: string; top: string }> = [
    { key: 'top-left', left: '-8px', top: '-8px' },
    { key: 'top-right', left: `calc(100% - 8px)`, top: '-8px' },
    { key: 'bottom-right', left: `calc(100% - 8px)`, top: `calc(100% - 8px)` },
    { key: 'bottom-left', left: '-8px', top: `calc(100% - 8px)` },
  ];

  const computeCenterFromHandle = useCallback(
    (handle: ResizeHandle, opposite: { x: number; y: number }, halfWidth: number, halfHeight: number) => {
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
    },
    []
  );

  const pointerToScene = useCallback(
    (clientX: number, clientY: number) => ({
      x: (clientX - layout.x) / layout.scaleX,
      y: (clientY - layout.y) / layout.scaleY,
    }),
    [layout.x, layout.y, layout.scaleX, layout.scaleY]
  );

  const startMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pointerScene = pointerToScene(event.clientX, event.clientY);
    dragStateRef.current = {
      type: 'move',
      pointerId: event.pointerId,
      offsetX: pointerScene.x - layerRef.current.transform.pos.x,
      offsetY: pointerScene.y - layerRef.current.transform.pos.y,
      historySnapshot: cloneSceneForHistory(useAppStore.getState().getCurrentScene()),
      historyApplied: false,
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>, handle: ResizeHandle) => {
    event.preventDefault();
    event.stopPropagation();

    const currentLayer = layerRef.current;
    const currentCenter = currentLayer.transform.pos;
    const currentBounding = getLayerBoundingSize(currentLayer, scene);
    const halfW = currentBounding.width / 2;
    const halfH = currentBounding.height / 2;

    const opposite: { [K in ResizeHandle]: { x: number; y: number } } = {
      'top-left': { x: currentCenter.x + halfW, y: currentCenter.y + halfH },
      'top-right': { x: currentCenter.x - halfW, y: currentCenter.y + halfH },
      'bottom-right': { x: currentCenter.x - halfW, y: currentCenter.y - halfH },
      'bottom-left': { x: currentCenter.x + halfW, y: currentCenter.y - halfH },
    };

    dragStateRef.current = {
      type: 'resize',
      pointerId: event.pointerId,
      handle,
      opposite: opposite[handle],
      baseSize,
      initialFontSize: currentLayer.type === 'text' ? currentLayer.fontSize : undefined,
      historySnapshot: cloneSceneForHistory(useAppStore.getState().getCurrentScene()),
      historyApplied: false,
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();

      const currentLayer = layerRef.current;
      const pointerScene = pointerToScene(event.clientX, event.clientY);
      const currentDrag = dragStateRef.current;

      const historyOptions = () => {
        if (!currentDrag) return { recordHistory: false, persist: false };
        if (!currentDrag.historyApplied && currentDrag.historySnapshot) {
          currentDrag.historyApplied = true;
          return {
            recordHistory: false,
            persist: false,
            historySnapshot: currentDrag.historySnapshot,
          } as const;
        }
        return { recordHistory: false, persist: false } as const;
      };

      if (dragState.type === 'move') {
        const newPos = {
          x: pointerScene.x - dragState.offsetX,
          y: pointerScene.y - dragState.offsetY,
        };
        updateLayer(currentLayer.id, {
          transform: {
            ...currentLayer.transform,
            pos: newPos,
          },
        }, historyOptions());
        requestCurrentStreamFrame();
        return;
      }

      const { opposite, baseSize } = dragState;
      const minHalfWidth = Math.max(MIN_SIZE / 2, baseSize.width / 2 * 0.1);
      const minHalfHeight = Math.max(MIN_SIZE / 2, baseSize.height / 2 * 0.1);

      const newHalfWidth = Math.max(minHalfWidth, Math.abs(pointerScene.x - opposite.x) / 2);
      const newHalfHeight = Math.max(minHalfHeight, Math.abs(pointerScene.y - opposite.y) / 2);

      let newScaleX = baseSize.width > 0 ? (newHalfWidth * 2) / baseSize.width : currentLayer.transform.scale.x;
      let newScaleY = baseSize.height > 0 ? (newHalfHeight * 2) / baseSize.height : currentLayer.transform.scale.y;

      if (currentLayer.type === 'text') {
        const baseWidth = baseSize.width || 1;
        const baseHeight = baseSize.height || 1;
        const targetWidth = Math.max(MIN_SIZE, Math.abs(pointerScene.x - opposite.x));
        const targetHeight = Math.max(MIN_SIZE, Math.abs(pointerScene.y - opposite.y));
        const widthScale = targetWidth / baseWidth;
        const heightScale = targetHeight / baseHeight;
        const uniformScale = Math.max(0.1, Math.min(widthScale, heightScale));
        const initialFontSize = dragState.initialFontSize ?? currentLayer.fontSize;
        const nextFontSize = Math.max(10, Math.min(initialFontSize * uniformScale, 512));
        const metrics = measureTextBlock(
          currentLayer.content,
          nextFontSize,
          currentLayer.font,
          currentLayer.padding
        );
        const measuredWidth = Math.max(MIN_SIZE, metrics.width);
        const measuredHeight = Math.max(MIN_SIZE, metrics.height);

        let derivedCenter: { x: number; y: number };
        switch (dragState.handle) {
          case 'top-left':
            derivedCenter = {
              x: opposite.x - measuredWidth / 2,
              y: opposite.y - measuredHeight / 2,
            };
            break;
          case 'top-right':
            derivedCenter = {
              x: opposite.x + measuredWidth / 2,
              y: opposite.y - measuredHeight / 2,
            };
            break;
          case 'bottom-right':
            derivedCenter = {
              x: opposite.x + measuredWidth / 2,
              y: opposite.y + measuredHeight / 2,
            };
            break;
          case 'bottom-left':
            derivedCenter = {
              x: opposite.x - measuredWidth / 2,
              y: opposite.y + measuredHeight / 2,
            };
            break;
          default:
            derivedCenter = currentLayer.transform.pos;
        }

        updateLayer(currentLayer.id, {
          fontSize: nextFontSize,
          transform: {
            ...currentLayer.transform,
            pos: derivedCenter,
            scale: { x: 1, y: 1 },
          },
        }, historyOptions());
        requestCurrentStreamFrame();
        return;
      }

      if (currentLayer.type === 'image' || currentLayer.type === 'shape' || currentLayer.type === 'screen') {
        const locked = currentLayer.type === 'image' || currentLayer.type === 'shape' || currentLayer.type === 'screen'
          ? (currentLayer.scaleLocked ?? true)
          : true;
        const minScaleX = Math.max(MIN_SIZE / baseSize.width, IMAGE_SCALE_MIN);
        const minScaleY = Math.max(MIN_SIZE / baseSize.height, IMAGE_SCALE_MIN);
        newScaleX = Math.min(IMAGE_SCALE_MAX, Math.max(newScaleX, minScaleX));
        newScaleY = Math.min(IMAGE_SCALE_MAX, Math.max(newScaleY, minScaleY));
        if (locked) {
          // Maintain current aspect ratio instead of forcing uniform scale
          const currentRatio = currentLayer.transform.scale.x / currentLayer.transform.scale.y;
          // Use the dimension with larger scale as the driver
          if (Math.abs(newScaleX) >= Math.abs(newScaleY)) {
            newScaleY = newScaleX / currentRatio;
          } else {
            newScaleX = newScaleY * currentRatio;
          }
          // Re-clamp after ratio adjustment
          newScaleX = Math.min(IMAGE_SCALE_MAX, Math.max(newScaleX, minScaleX));
          newScaleY = Math.min(IMAGE_SCALE_MAX, Math.max(newScaleY, minScaleY));
        }
      }

      const scaledHalfWidth = (baseSize.width * Math.abs(newScaleX)) / 2;
      const scaledHalfHeight = (baseSize.height * Math.abs(newScaleY)) / 2;
      const newCenter = computeCenterFromHandle(dragState.handle, opposite, scaledHalfWidth, scaledHalfHeight);

      updateLayer(currentLayer.id, {
        transform: {
          ...currentLayer.transform,
          pos: newCenter,
          scale: {
            x: newScaleX,
            y: newScaleY,
          },
        },
      }, historyOptions());
      requestCurrentStreamFrame();
    },
    [computeCenterFromHandle, pointerToScene, updateLayer]
  );

  const endDrag = useCallback((event: PointerEvent) => {
    const dragState = dragStateRef.current;
    if (dragState && dragState.pointerId === event.pointerId) {
      dragStateRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      if (dragState.historyApplied) {
        void useAppStore.getState().saveScene();
      }
    }
  }, [handlePointerMove]);

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    },
    [handlePointerMove, endDrag]
  );

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (layerRef.current.type === 'text' && onRequestEdit) {
      event.stopPropagation();
      onRequestEdit();
    }
  };

  return (
    <div style={boxStyle} onPointerDown={startMove} onDoubleClick={handleDoubleClick}>
      {handles.map((handle) => (
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
            border: '1px solid rgba(255, 255, 255, 0.75)',
            background: 'rgba(0, 166, 255, 0.95)',
            cursor: 'nwse-resize',
            pointerEvents: 'auto',
            transform: 'translate(-50%, -50%)',
            padding: 0,
          }}
          aria-label={`Resize ${handle.key}`}
        />
      ))}
    </div>
  );
}
