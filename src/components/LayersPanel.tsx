import { useMemo, useState, type CSSProperties, type DragEvent } from 'react';
import type { Layer } from '../types/scene';
import { useAppStore } from '../app/store';
import { shallow } from 'zustand/shallow';
import { stopSource } from '../media/sourceManager';

interface LayersPanelProps {
  layers: Layer[];
  onAddScreen: () => Promise<void> | void;
  onAddCamera: () => Promise<void> | void;
}

/**
 * Layer list with quick visibility toggles and add-source menu.
 */
export function LayersPanel({ layers, onAddScreen, onAddCamera }: LayersPanelProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const updateLayer = useAppStore((state) => state.updateLayer);
  const removeLayer = useAppStore((state) => state.removeLayer);
  const reorderLayers = useAppStore((state) => state.reorderLayers);
  const setSelection = useAppStore((state) => state.setSelection);
  const selection = useAppStore((state) => state.selection, shallow);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const orderedLayers = useMemo(() => {
    // Highest z first for UI readability (top-most layer at top)
    return [...layers].sort((a, b) => b.z - a.z);
  }, [layers]);

  const toggleVisibility = (layerId: string, visible: boolean) => {
    updateLayer(layerId, { visible: !visible });
  };

  const isSelected = (layerId: string) => selection.includes(layerId);

  const handleRowClick = (layerId: string) => {
    setSelection([layerId]);
  };

  const handleReorder = (draggedId: string, targetId: string | null, placeBefore: boolean) => {
    const currentOrder = orderedLayers.map((layer) => layer.id);
    const draggedIndex = currentOrder.indexOf(draggedId);
    if (draggedIndex === -1) return;

    currentOrder.splice(draggedIndex, 1);

    let insertIndex: number;
    if (targetId && currentOrder.includes(targetId)) {
      insertIndex = currentOrder.indexOf(targetId);
      if (!placeBefore) {
        insertIndex += 1;
      }
    } else {
      insertIndex = placeBefore ? 0 : currentOrder.length;
    }

    currentOrder.splice(insertIndex, 0, draggedId);

    const ascendingOrder = [...currentOrder].reverse();
    reorderLayers(ascendingOrder);
    setSelection([draggedId]);
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, layerId: string) => {
    setDraggingId(layerId);
    setDragOverId(layerId);
    event.dataTransfer.effectAllowed = 'move';
    try {
      event.dataTransfer.setData('text/plain', layerId);
    } catch {
      // Some browsers may throw; ignore since we track in state.
    }
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>, layerId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragOverId !== layerId) {
      setDragOverId(layerId);
    }
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>, targetId: string) => {
    event.preventDefault();
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const placeBefore = event.clientY < rect.top + rect.height / 2;
    handleReorder(draggingId, targetId, placeBefore);
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '12px',
        gap: '12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          Layers
          <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto', position: 'relative' }}>
            <button
              onClick={() => setMenuOpen((open) => !open)}
              style={iconButtonStyle}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              +
            </button>
            <button
              onClick={() => {
                if (selection.length === 0) return;
                selection.forEach((id) => {
                  stopSource(id);
                  removeLayer(id);
                });
                setSelection([]);
              }}
              disabled={selection.length === 0}
              style={{
                ...iconButtonStyle,
                opacity: selection.length === 0 ? 0.35 : 1,
                cursor: selection.length === 0 ? 'not-allowed' : 'pointer',
              }}
              aria-label="Delete selected layers"
            >
              −
            </button>
            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '32px',
                  right: '0',
                  background: 'rgba(24, 24, 24, 0.95)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
                  minWidth: '180px',
                  overflow: 'hidden',
                  zIndex: 30,
                }}
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    void onAddScreen();
                  }}
                  style={menuItemStyle}
                >
                  Screen Capture…
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    void onAddCamera();
                  }}
                  style={menuItemStyle}
                >
                  Camera…
                </button>
                <button
                  disabled
                  style={{ ...menuItemStyle, opacity: 0.5, cursor: 'not-allowed' }}
                  title="Coming soon"
                >
                  Image Overlay
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(18, 18, 18, 0.6)',
        }}
      >
        {orderedLayers.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.55)',
            }}
          >
            No layers yet. Click + to add a source.
          </div>
        ) : (
          orderedLayers.map((layer) => {
            const isDragTarget = dragOverId === layer.id && draggingId !== null;
            const isDragging = draggingId === layer.id;
            return (
            <button
              key={layer.id}
              onClick={() => handleRowClick(layer.id)}
              draggable
              onDragStart={(event) => handleDragStart(event, layer.id)}
              onDragOver={(event) => handleDragOver(event, layer.id)}
              onDrop={(event) => handleDrop(event, layer.id)}
              onDragEnd={handleDragEnd}
              style={{
                width: '100%',
                border: 'none',
                background: isDragging
                  ? 'rgba(0, 102, 204, 0.45)'
                  : isSelected(layer.id)
                    ? 'rgba(0, 102, 204, 0.35)'
                    : isDragTarget
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'transparent',
                color: '#f5f5f5',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  gap: '2px',
                }}
              >
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {layer.name}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.6)',
                  }}
                >
                  {layer.type}
                </span>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleVisibility(layer.id, layer.visible);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={layer.visible ? 'rgba(255, 230, 125, 0.95)' : 'rgba(255, 255, 255, 0.3)'}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3v2" />
                  <path d="M17.657 6.343 16.243 7.757" />
                  <path d="M21 13h-2" />
                  <path d="M17.657 19.657 16.243 18.243" />
                  <path d="M12 19v2" />
                  <path d="M7.757 18.243 6.343 19.657" />
                  <path d="M5 13H3" />
                  <path d="M6.343 6.343 7.757 7.757" />
                  <circle
                    cx="12"
                    cy="13"
                    r="3.5"
                    fill={layer.visible ? 'rgba(255, 225, 110, 0.6)' : 'transparent'}
                  />
                </svg>
              </button>
            </button>
          );
          })
        )}
      </div>
    </div>
  );
}

const menuItemStyle: CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'transparent',
  border: 'none',
  color: '#f5f5f5',
  textAlign: 'left',
  fontSize: '13px',
  cursor: 'pointer',
};

const iconButtonStyle: CSSProperties = {
  width: '26px',
  height: '26px',
  borderRadius: '6px',
  background: 'rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  color: '#f5f5f5',
  fontSize: '18px',
  lineHeight: '1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
};
