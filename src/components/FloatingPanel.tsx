import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface FloatingPanelProps {
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  minSize?: { width: number; height: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  children: ReactNode;
}

/**
 * Basic floating panel with draggable header and optional resize handle.
 * Designed for tool panels (layers, properties) that should float over the canvas.
 */
export function FloatingPanel({
  title,
  position,
  size,
  minSize = { width: 280, height: 380 },
  onPositionChange,
  onSizeChange,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  children,
}: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const resizeStartRef = useRef<{
    pointerId: number;
    startWidth: number;
    startHeight: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [edgeHover, setEdgeHover] = useState(false);

  const EDGE_TOLERANCE = 12;

  const isNearEdge = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!panel) return false;
    const rect = panel.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    return (
      offsetX <= EDGE_TOLERANCE ||
      rect.width - offsetX <= EDGE_TOLERANCE ||
      offsetY <= EDGE_TOLERANCE ||
      rect.height - offsetY <= EDGE_TOLERANCE
    );
  }, []);

  const clampPosition = useCallback(
    (nextX: number, nextY: number) => {
      const panel = panelRef.current;
      if (!panel) {
        onPositionChange({ x: nextX, y: nextY });
        return;
      }

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const { offsetWidth, offsetHeight } = panel;

      const visibleMargin = 80;
      const minX = Math.min(visibleMargin - offsetWidth, 0);
      const maxX = Math.max(viewportWidth - visibleMargin, 0);
      const minY = Math.min(visibleMargin - offsetHeight, 0);
      const maxY = Math.max(viewportHeight - visibleMargin, 0);
      const clampedX = Math.min(Math.max(minX, nextX), maxX);
      const clampedY = Math.min(Math.max(minY, nextY), maxY);
      onPositionChange({ x: clampedX, y: clampedY });
    },
    [onPositionChange]
  );

  const clampSize = useCallback(
    (nextWidth: number, nextHeight: number) => {
      if (!onSizeChange) return;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const minWidth = minSize.width;
      const minHeight = minSize.height;

      const clampedWidth = Math.min(Math.max(minWidth, nextWidth), viewportWidth);
      const clampedHeight = Math.min(Math.max(minHeight, nextHeight), viewportHeight);

      onSizeChange({ width: clampedWidth, height: clampedHeight });
    },
    [minSize.height, minSize.width, onSizeChange]
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (dragStartRef.current) {
        event.preventDefault();
        const { pointerId, offsetX, offsetY } = dragStartRef.current;
        if (event.pointerId !== pointerId) return;
        clampPosition(event.clientX - offsetX, event.clientY - offsetY);
      } else if (resizeStartRef.current) {
        event.preventDefault();
        const { pointerId, startWidth, startHeight, startX, startY } = resizeStartRef.current;
        if (event.pointerId !== pointerId) return;
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        clampSize(startWidth + deltaX, startHeight + deltaY);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (dragStartRef.current && event.pointerId === dragStartRef.current.pointerId) {
        dragStartRef.current = null;
        setIsDragging(false);
      }
      if (resizeStartRef.current && event.pointerId === resizeStartRef.current.pointerId) {
        resizeStartRef.current = null;
        setIsResizing(false);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [clampPosition, clampSize]);

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragStartRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    setIsDragging(true);
    setEdgeHover(false);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    beginDrag(event);
  };

  const handlePanelPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (isNearEdge(event)) {
      beginDrag(event);
    }
  };

  const handlePanelPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) return;
    setEdgeHover(isNearEdge(event));
  };

  const handlePanelPointerLeave = () => {
    setEdgeHover(false);
  };

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!onSizeChange || event.button !== 0) return;
    resizeStartRef.current = {
      pointerId: event.pointerId,
      startWidth: size.width,
      startHeight: size.height,
      startX: event.clientX,
      startY: event.clientY,
    };
    setIsResizing(true);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  return (
    <div
      ref={panelRef}
      onPointerDown={handlePanelPointerDown}
      onPointerMove={handlePanelPointerMove}
      onPointerLeave={handlePanelPointerLeave}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        backgroundColor: 'rgba(34, 34, 34, 0.95)',
        color: '#f5f5f5',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: isDragging ? 'none' : 'auto',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 20,
<<<<<<< HEAD
        cursor: isDragging ? 'grabbing' : edgeHover ? 'grab' : 'default',
=======
        overflow: 'hidden',
>>>>>>> main
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          cursor: isDragging ? 'grabbing' : 'grab',
          borderBottom: collapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
          fontSize: '13px',
          letterSpacing: '0.02em',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}
        onPointerDown={startDrag}
      >
        <span>{title}</span>
        {collapsible && onToggleCollapse && (
          <button
            type="button"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onToggleCollapse();
            }}
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
            aria-expanded={!collapsed}
            style={{
              border: 'none',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#f5f5f5',
              borderRadius: '6px',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '14px',
              lineHeight: 1,
            }}
          >
            {collapsed ? '▾' : '▴'}
          </button>
        )}
      </div>
      {!collapsed && (
        <div
          style={{
            flex: 1,
            overflow: 'visible',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </div>
      )}
      {onSizeChange && (
        <button
          onPointerDown={startResize}
          style={{
            position: 'absolute',
            right: '4px',
            bottom: '4px',
            width: '16px',
            height: '16px',
            background: 'transparent',
            border: 'none',
            cursor: isResizing ? 'se-resize' : 'nwse-resize',
            padding: 0,
          }}
          aria-label="Resize panel"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1.2"
          >
            <path d="M5 11h6v-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
