import { useMemo, useState, type CSSProperties, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type { Layer } from '../types/scene';
import { useAppStore } from '../app/store';
import { stopSource } from '../media/sourceManager';
import { requestCurrentStreamFrame } from '../utils/viewerStream';
import { LayerPropertiesPanel } from './LayerPropertiesPanel';

interface LayersPanelProps {
  layers: Layer[];
  onAddScreen: () => Promise<void> | void;
  onAddCamera: () => Promise<void> | void;
  onAddText: () => Promise<void> | void;
  onAddImage: () => Promise<void> | void;
  onAddShape: () => Promise<void> | void;
}

/**
 * Layer list with quick visibility toggles and add-source menu.
 */
export function LayersPanel({ layers, onAddScreen, onAddCamera, onAddText, onAddImage, onAddShape }: LayersPanelProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const updateLayer = useAppStore((state) => state.updateLayer);
  const removeLayer = useAppStore((state) => state.removeLayer);
  const reorderLayers = useAppStore((state) => state.reorderLayers);
  const setSelection = useAppStore((state) => state.setSelection);
  const selection = useAppStore((state) => state.selection);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const selectedLayer = useMemo(() => {
    if (selection.length === 0) return null;
    return layers.find((layer) => layer.id === selection[0]) ?? null;
  }, [layers, selection]);

  const orderedLayers = useMemo(() => {
    // Highest z first for UI readability (top-most layer at top)
    return [...layers].sort((a, b) => b.z - a.z);
  }, [layers]);

  const toggleVisibility = (layerId: string, visible: boolean) => {
    updateLayer(
      layerId,
      { visible: !visible },
      { recordHistory: true, persist: true }
    );
  };

  const toggleLock = (layerId: string, locked: boolean) => {
    updateLayer(
      layerId,
      { locked: !locked },
      { recordHistory: true, persist: true }
    );
    requestCurrentStreamFrame();
  };

  const isSelected = (layerId: string) => selection.includes(layerId);

  const handleRowClick = (event: ReactMouseEvent<HTMLElement>, layerId: string) => {
    const multi = event.shiftKey || event.metaKey || event.ctrlKey;
    if (multi) {
      if (isSelected(layerId)) {
        setSelection(selection.filter((id) => id !== layerId));
      } else {
        setSelection([...selection, layerId]);
      }
    } else {
      setSelection([layerId]);
    }
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
    requestCurrentStreamFrame();
  };

  const handleDragStart = (event: DragEvent<HTMLElement>, layerId: string) => {
    setDraggingId(layerId);
    setDragOverId(layerId);
    event.dataTransfer.effectAllowed = 'move';
    try {
      event.dataTransfer.setData('text/plain', layerId);
    } catch {
      // Some browsers may throw; ignore since we track in state.
    }
  };

  const handleDragOver = (event: DragEvent<HTMLElement>, layerId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragOverId !== layerId) {
      setDragOverId(layerId);
    }
  };

  const handleDrop = (event: DragEvent<HTMLElement>, targetId: string) => {
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

  const handleDeleteSelection = () => {
    if (selection.length === 0) return;
    selection.forEach((id) => {
      stopSource(id);
      removeLayer(id);
    });
    setSelection([]);
    requestCurrentStreamFrame();
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div style={containerStyle}>
      <div style={panelShellStyle}>
        <section style={layersSectionStyle}>
          <div style={layersHeaderStyle}>
            <div style={menuTriggerWrapperStyle}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                style={iconButtonStyle}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                +
              </button>
              <button
                type="button"
                onClick={handleDeleteSelection}
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
            </div>
            {menuOpen && (
              <div style={menuPopoverStyle}>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    void onAddScreen();
                  }}
                  style={menuItemStyle}
                >
                  Screen Capture…
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    void onAddCamera();
                  }}
                  style={menuItemStyle}
                >
                  Camera…
                </button>
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }} />
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    void onAddText();
                  }}
                  style={menuItemStyle}
                >
                  Text Overlay
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    void onAddImage();
                  }}
                  style={menuItemStyle}
                >
                  Image Overlay…
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    void onAddShape();
                  }}
                  style={menuItemStyle}
                >
                  Shape Overlay
                </button>
              </div>
            )}
          </div>
          <div style={layersScrollStyle} className="invisible-scrollbar">
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
              const background = isDragging
                ? 'rgba(0, 102, 204, 0.45)'
                : isSelected(layer.id)
                ? 'rgba(0, 102, 204, 0.35)'
                : isDragTarget
                ? 'rgba(255, 255, 255, 0.08)'
                : 'transparent';

              return (
                <div
                  key={layer.id}
                  draggable
                  onDragStart={(event) => handleDragStart(event, layer.id)}
                  onDragOver={(event) => handleDragOver(event, layer.id)}
                  onDrop={(event) => handleDrop(event, layer.id)}
                  onDragEnd={handleDragEnd}
                  style={{
                    width: '100%',
                    border: 'none',
                    background,
                    color: '#f5f5f5',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                  onClick={(event) => handleRowClick(event, layer.id)}
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
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {layer.name}
                      {layer.locked && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.12)',
                          }}
                          title="Layer locked"
                        >
                          🔒
                        </span>
                      )}
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
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleLock(layer.id, layer.locked);
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: layer.locked ? 1 : 0.65,
                      }}
                      aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.85)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {layer.locked ? (
                          <>
                            <rect x="5" y="10" width="14" height="11" rx="2" />
                            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                          </>
                        ) : (
                          <>
                            <rect x="5" y="11" width="14" height="10" rx="2" />
                            <path d="M7 11V7a5 5 0 0 1 9-3" />
                            <path d="m15.5 11.5 3.5 3.5" />
                          </>
                        )}
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleVisibility(layer.id, layer.visible);
                        requestCurrentStreamFrame();
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
                  </div>
                </div>
              );
            })
          )}
        </div>
        </section>
        <section style={propertiesSectionOuterStyle}>
          <div style={propertiesHeaderStyle}>Properties</div>
          <div style={propertiesContentStyle} className="invisible-scrollbar">
            <LayerPropertiesPanel layer={selectedLayer ?? null} />
          </div>
        </section>
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  padding: '12px',
};

const panelShellStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'rgba(18, 18, 18, 0.88)',
  overflow: 'visible',
  minHeight: 0,
};

const layersSectionStyle: CSSProperties = {
  flex: '0 0 65%',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  borderBottom: '2px solid rgba(255, 255, 255, 0.12)', // Stronger visual separation
};

const layersHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  position: 'relative',
};

const layersScrollStyle: CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
};

// Removed - no longer needed with border on layersSection

const menuTriggerWrapperStyle: CSSProperties = {
  display: 'flex',
  gap: '6px',
};

const menuPopoverStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  left: '14px',
  right: '14px',
  background: 'rgba(24, 24, 24, 0.95)',
  borderRadius: '8px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  boxShadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
  minWidth: '180px',
  overflow: 'hidden',
  zIndex: 30,
};

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


const propertiesSectionOuterStyle: CSSProperties = {
  flex: '0 0 35%',
  display: 'flex',
  flexDirection: 'column',
  padding: '14px 16px 16px',
  gap: '12px',
  minHeight: 0,
};

const propertiesHeaderStyle: CSSProperties = {
  fontSize: '11px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'rgba(255, 255, 255, 0.65)',
  fontWeight: 700,
  paddingBottom: '8px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
};

const propertiesContentStyle: CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  paddingRight: '2px',
};
