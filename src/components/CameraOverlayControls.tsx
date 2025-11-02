import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { CameraLayer } from '../types/scene';
import type { CanvasLayout } from './PresenterCanvas';
import { useAppStore } from '../app/store';

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
    }
  | {
      type: 'resize';
      pointerId: number;
    };

const MIN_DIAMETER = 120;

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
      updateLayer(currentLayer.id, {
        transform: {
          ...currentLayer.transform,
          pos: { x, y },
        },
      });
    } else {
      const center = currentLayer.transform.pos;
      const dx = pointerScene.x - center.x;
      const dy = pointerScene.y - center.y;
      let radius = Math.sqrt(dx * dx + dy * dy);
      const { sceneWidth: width, sceneHeight: height } = sceneSizeRef.current;
      const maxRadius = Math.min(center.x, center.y, width - center.x, height - center.y);
      radius = Math.min(Math.max(radius, MIN_DIAMETER / 2), Math.max(maxRadius, MIN_DIAMETER / 2));
      const diameter = Math.round(radius * 2);
      updateLayer(currentLayer.id, {
        diameter,
      });
    }
  }, [updateLayer]);

  const endDrag = useCallback((event: PointerEvent) => {
    const dragState = dragStateRef.current;
    if (dragState && dragState.pointerId === event.pointerId) {
      dragStateRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    }
  }, [handlePointerMove]);

  const startDrag = (event: ReactPointerEvent, type: DragState['type']) => {
    event.preventDefault();
    event.stopPropagation();
    const currentLayer = layerRef.current;
    if (!currentLayer) return;

    const pointerScene = pointerToScene(event.clientX, event.clientY);
    const dragState: DragState =
      type === 'move'
        ? {
            type: 'move',
            pointerId: event.pointerId,
            offsetX: pointerScene.x - currentLayer.transform.pos.x,
            offsetY: pointerScene.y - currentLayer.transform.pos.y,
          }
        : {
            type: 'resize',
            pointerId: event.pointerId,
          };

    dragStateRef.current = dragState;
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
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
  };

  return (
    <div style={overlayStyle}>
      <div
        onPointerDown={(event) => startDrag(event, 'move')}
        style={circleStyle}
      >
        <div
          onPointerDown={(event) => startDrag(event, 'resize')}
          style={handleStyle}
        >
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
