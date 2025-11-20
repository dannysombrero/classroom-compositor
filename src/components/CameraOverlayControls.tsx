import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { CameraLayer, Scene } from '../types/scene';
import type { CanvasLayout } from './PresenterCanvas';
import { useAppStore, type UpdateLayerOptions } from '../app/store';
import { requestCurrentStreamFrame } from '../utils/viewerStream';
import { getVideoForLayer } from '../media/sourceManager';

interface CameraOverlayControlsProps {
  layout: CanvasLayout;
  layer: CameraLayer;
  sceneWidth: number;
  sceneHeight: number;
}

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
      historySnapshot?: Scene | null;
      historyApplied?: boolean;
    }
  | {
      type: 'offset';
      pointerId: number;
      startPointer: { x: number; y: number };
      initialOffset: { x: number; y: number };
      historySnapshot?: Scene | null;
      historyApplied?: boolean;
    }
  | {
      type: 'content-scale';
      pointerId: number;
      initialScale: number;
      startDistance: number;
      historySnapshot?: Scene | null;
      historyApplied?: boolean;
    };

type ResizeHandle = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

const CONTENT_HANDLES: ResizeHandle[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

function getVideoBaseDimensions(layer: CameraLayer): { width: number; height: number } {
  const video = getVideoForLayer(layer.id);
  if (video && video.videoWidth > 0 && video.videoHeight > 0) {
    return { width: video.videoWidth, height: video.videoHeight };
  }
  // Default 16:9 camera dimensions
  return { width: 1280, height: 720 };
}

/**
 * Interaction overlay for camera layers – supports drag position and resize crop.
 */
export function CameraOverlayControls({
  layout,
  layer,
  sceneWidth,
  sceneHeight,
}: CameraOverlayControlsProps) {
  const updateLayer = useAppStore((state) => state.updateLayer);
  const layerRef = useRef(layer);
  const layoutRef = useRef(layout);
  const sceneSizeRef = useRef({ sceneWidth, sceneHeight });
  const dragStateRef = useRef<DragState | null>(null);

  const cloneScene = useCallback((scene: Scene | null): Scene | null => {
    if (!scene) return null;
    return JSON.parse(JSON.stringify(scene)) as Scene;
  }, []);

  useEffect(() => {
    layerRef.current = layer;
  }, [layer]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    sceneSizeRef.current = { sceneWidth, sceneHeight };
  }, [sceneWidth, sceneHeight]);

  const pointerToScene = (clientX: number, clientY: number) => {
    const currentLayout = layoutRef.current;
    return {
      x: (clientX - currentLayout.x) / currentLayout.scaleX,
      y: (clientY - currentLayout.y) / currentLayout.scaleY,
    };
  };

  const clampPosition = (x: number, y: number, radius: number) => {
    const { sceneWidth: width, sceneHeight: height } = sceneSizeRef.current;
    const clampedX = Math.min(Math.max(radius, x), width - radius);
    const clampedY = Math.min(Math.max(radius, y), height - radius);
    return { x: clampedX, y: clampedY };
  };

  const historyOptions = (dragState: DragState | null) => {
    if (!dragState || !dragState.historySnapshot) {
      return { recordHistory: false, persist: false } as UpdateLayerOptions;
    }
    if (!dragState.historyApplied) {
      dragState.historyApplied = true;
      return {
        recordHistory: false,
        persist: false,
        historySnapshot: dragState.historySnapshot,
      } as UpdateLayerOptions;
    }
    return { recordHistory: false, persist: false } as UpdateLayerOptions;
  };

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const currentLayer = layerRef.current;
    if (!currentLayer) return;

    const pointerScene = pointerToScene(event.clientX, event.clientY);
    event.preventDefault();

    if (dragState.type === 'move') {
      const radius = (currentLayer.diameter ?? MIN_DIAMETER) / 2;
      const targetX = pointerScene.x - dragState.offsetX;
      const targetY = pointerScene.y - dragState.offsetY;
      const { x, y } = clampPosition(targetX, targetY, radius);
      updateLayer(
        currentLayer.id,
        {
          transform: {
            ...currentLayer.transform,
            pos: { x, y },
          },
        },
        historyOptions(dragState)
      );
      requestCurrentStreamFrame();
    } else if (dragState.type === 'resize') {
      const center = currentLayer.transform.pos;
      const dx = pointerScene.x - center.x;
      const dy = pointerScene.y - center.y;
      let radius = Math.sqrt(dx * dx + dy * dy);
      const { sceneWidth: width, sceneHeight: height } = sceneSizeRef.current;
      const maxRadius = Math.min(center.x, center.y, width - center.x, height - center.y);
      radius = Math.min(Math.max(radius, MIN_DIAMETER / 2), Math.max(maxRadius, MIN_DIAMETER / 2));
      const diameter = Math.round(radius * 2);
      updateLayer(currentLayer.id, { diameter }, historyOptions(dragState));
      requestCurrentStreamFrame();
    } else if (dragState.type === 'offset') {
      const delta = {
        x: pointerScene.x - dragState.startPointer.x,
        y: pointerScene.y - dragState.startPointer.y,
      };
      const nextOffset = {
        x: dragState.initialOffset.x + delta.x,
        y: dragState.initialOffset.y + delta.y,
      };

      const baseDimensions = getVideoBaseDimensions(currentLayer);
      const scale = currentLayer.videoScale ?? 1;
      const maskDiameter = currentLayer.diameter ?? MIN_DIAMETER;
      const viewWidth = baseDimensions.width * scale;
      const viewHeight = baseDimensions.height * scale;
      const maxOffsetX = Math.max(0, (viewWidth - maskDiameter) / 2);
      const maxOffsetY = Math.max(0, (viewHeight - maskDiameter) / 2);
      const clampX = Math.max(-maxOffsetX, Math.min(maxOffsetX, nextOffset.x));
      const clampY = Math.max(-maxOffsetY, Math.min(maxOffsetY, nextOffset.y));

      updateLayer(
        currentLayer.id,
        {
          videoOffset: {
            x: clampX,
            y: clampY,
          },
        },
        historyOptions(dragState)
      );
      requestCurrentStreamFrame();
    } else if (dragState.type === 'content-scale') {
      const center = currentLayer.transform.pos;
      const dx = pointerScene.x - center.x;
      const dy = pointerScene.y - center.y;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const rawScale = (distance / dragState.startDistance) * dragState.initialScale;
      const nextScale = Math.max(0.5, Math.min(3, rawScale));
      const baseDimensions = getVideoBaseDimensions(currentLayer);
      const maskDiameter = currentLayer.diameter ?? MIN_DIAMETER;
      const viewWidth = baseDimensions.width * nextScale;
      const viewHeight = baseDimensions.height * nextScale;
      const maxOffsetX = Math.max(0, (viewWidth - maskDiameter) / 2);
      const maxOffsetY = Math.max(0, (viewHeight - maskDiameter) / 2);
      const currentOffset = currentLayer.videoOffset ?? { x: 0, y: 0 };
      const clampX = Math.max(-maxOffsetX, Math.min(maxOffsetX, currentOffset.x));
      const clampY = Math.max(-maxOffsetY, Math.min(maxOffsetY, currentOffset.y));

      updateLayer(
        currentLayer.id,
        {
          videoScale: nextScale,
          videoOffset: {
            x: clampX,
            y: clampY,
          },
        },
        historyOptions(dragState)
      );
      requestCurrentStreamFrame();
    }
  }, [updateLayer]);

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

  const startDrag = (event: ReactPointerEvent, type: DragState['type'] | ResizeHandle) => {
    event.preventDefault();
    event.stopPropagation();
    const currentLayer = layerRef.current;
    if (!currentLayer) return;

    const pointerScene = pointerToScene(event.clientX, event.clientY);
    const snapshot = cloneScene(useAppStore.getState().getCurrentScene());
    const baseState = {
      pointerId: event.pointerId,
      historySnapshot: snapshot,
      historyApplied: false,
    } as const;

    let dragState: DragState;

    if (type === 'move') {
      dragState = {
        type: 'move',
        offsetX: pointerScene.x - currentLayer.transform.pos.x,
        offsetY: pointerScene.y - currentLayer.transform.pos.y,
        ...baseState,
      };
    } else if (type === 'resize') {
      dragState = {
        type: 'resize',
        ...baseState,
      };
    } else if (type === 'offset') {
      dragState = {
        type: 'offset',
        startPointer: pointerScene,
        initialOffset: currentLayer.videoOffset ?? { x: 0, y: 0 },
        ...baseState,
      };
    } else {
      const center = currentLayer.transform.pos;
      const dx = pointerScene.x - center.x;
      const dy = pointerScene.y - center.y;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      dragState = {
        type: 'content-scale',
        initialScale: currentLayer.videoScale ?? 1,
        startDistance: distance,
        ...baseState,
      };
    }

    dragStateRef.current = dragState;

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    },
    [handlePointerMove, endDrag]
  );

  const radiusPx = ((layer.diameter ?? MIN_DIAMETER) / 2) * layout.scaleX;
  const centerX = layer.transform.pos.x * layout.scaleX;
  const centerY = layer.transform.pos.y * layout.scaleY;
  const baseVideo = getVideoBaseDimensions(layer);
  const contentScale = layer.videoScale ?? 1;
  const contentWidth = baseVideo.width * contentScale * layout.scaleX;
  const contentHeight = baseVideo.height * contentScale * layout.scaleY;
  const offset = layer.videoOffset ?? { x: 0, y: 0 };
  const offsetPx = {
    x: offset.x * layout.scaleX,
    y: offset.y * layout.scaleY,
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${layout.x}px`,
    top: `${layout.y}px`,
    width: `${layout.width}px`,
    height: `${layout.height}px`,
    pointerEvents: 'none',
    zIndex: 15,
  };

  const circleStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${centerX - radiusPx}px`,
    top: `${centerY - radiusPx}px`,
    width: `${radiusPx * 2}px`,
    height: `${radiusPx * 2}px`,
    borderRadius: '50%',
    border: '2px solid rgba(0, 166, 255, 0.85)',
    background: 'rgba(0, 166, 255, 0.12)',
    boxShadow: '0 0 0 1px rgba(0, 166, 255, 0.45)',
    cursor: 'move',
    pointerEvents: 'auto',
  };

  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    right: '-8px',
    bottom: '-8px',
    width: '16px',
    height: '16px',
    borderRadius: '4px',
    background: 'rgba(0, 166, 255, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.75)',
    cursor: 'nwse-resize',
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  };

  const moveHandleStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    bottom: `-${Math.max(24, radiusPx * 0.25)}px`,
    transform: 'translateX(-50%)',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '1px solid rgba(255, 255, 255, 0.75)',
    background: 'rgba(0, 166, 255, 0.95)',
    cursor: 'grab',
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div style={overlayStyle}>
      <div onPointerDown={(event) => startDrag(event, 'move')} style={circleStyle}>
        <div
          style={{
            position: 'absolute',
            left: `${radiusPx - contentWidth / 2 + offsetPx.x}px`,
            top: `${radiusPx - contentHeight / 2 + offsetPx.y}px`,
            width: `${contentWidth}px`,
            height: `${contentHeight}px`,
            border: '1px dashed rgba(255, 255, 255, 0.6)',
            borderRadius: '8px',
            pointerEvents: 'auto',
            cursor: 'grab',
            zIndex: 1,
          }}
          onPointerDown={(event) => startDrag(event, 'offset')}
        >
          {CONTENT_HANDLES.map((handleKey) => (
            <button
              key={handleKey}
              onPointerDown={(event) => startDrag(event, handleKey)}
              style={{
                position: 'absolute',
                left: handleKey.includes('left') ? '-6px' : 'calc(100% - 2px)',
                top: handleKey.includes('top') ? '-6px' : 'calc(100% - 2px)',
                width: '12px',
                height: '12px',
                borderRadius: '3px',
                border: '1px solid rgba(255,255,255,0.9)',
                background: 'rgba(0,166,255,0.9)',
                padding: 0,
                cursor:
                  handleKey === 'top-left' || handleKey === 'bottom-right'
                    ? 'nwse-resize'
                    : 'nesw-resize',
              }}
              aria-label={`Resize camera source ${handleKey}`}
            />
          ))}
        </div>
        <button
          onPointerDown={(event) => startDrag(event, 'move')}
          style={{ ...moveHandleStyle, zIndex: 2 }}
          aria-label="Move camera bubble"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="1.2"
          >
            <path d="M7 1v12" />
            <path d="M1 7h12" />
          </svg>
        </button>
        <div onPointerDown={(event) => startDrag(event, 'resize')} style={handleStyle}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="1.2"
          >
            <path d="M1 11 L11 1" />
          </svg>
        </div>
      </div>
    </div>
  );
}
