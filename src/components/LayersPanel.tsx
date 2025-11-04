import { useCallback, useMemo, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
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
  const groupSelection = useAppStore((state) => state.groupSelection);
  const ungroupLayer = useAppStore((state) => state.ungroupLayer);
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

  const layerMap = useMemo(() => new Map(layers.map((layer) => [layer.id, layer] as const)), [layers]);

  const selectedGroupChildren = useMemo(() => {
    const childSet = new Set<string>();
    for (const id of selection) {
      const layer = layerMap.get(id);
      if (layer && layer.type === 'group') {
        layer.children.forEach((childId) => childSet.add(childId));
      }
    }
    return childSet;
  }, [selection, layerMap]);

  const highlightSet = useMemo(() => {
    const set = new Set(selection);
    selectedGroupChildren.forEach((id) => set.add(id));
    return set;
  }, [selection, selectedGroupChildren]);

  const childMap = useMemo(() => {
    const map = new Map<string, Layer[]>();
    for (const layer of orderedLayers) {
      const parentId = layer.parentId ?? null;
      if (parentId) {
        const list = map.get(parentId) ?? [];
        list.push(layer);
        map.set(parentId, list);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.z - a.z);
    }
    return map;
  }, [orderedLayers]);

  const rootLayers = useMemo(
    () => orderedLayers.filter((layer) => layer.parentId === undefined || layer.parentId === null),
    [orderedLayers]
  );

  const primarySelectedLayer = selection.length === 1 ? layerMap.get(selection[0]) ?? null : null;

  const canUngroup = primarySelectedLayer?.type === 'group';

  const canGroup = useMemo(() => {
    if (selection.length < 2) return false;
    const selected = selection
      .map((id) => layerMap.get(id))
      .filter((layer): layer is Layer => !!layer);
    const groupable = selected.filter(
      (layer) => layer.type !== 'group' && !layer.locked && (layer.parentId === undefined || layer.parentId === null)
    );
    return groupable.length >= 2;
  }, [selection, layerMap]);

  const toggleVisibility = (layerId: string, visible: boolean) => {
    updateLayer(layerId, { visible: !visible });
  };

  const toggleLock = (layerId: string, locked: boolean) => {
    updateLayer(layerId, { locked: !locked });
    requestCurrentStreamFrame();
  };

  const isSelected = (layerId: string) => highlightSet.has(layerId);

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
    requestCurrentStreamFrame();
  };

  const canDragLayer = useCallback(
    (layerId: string) => {
      const layer = layerMap.get(layerId);
      if (!layer) return false;
      return (layer.parentId === undefined || layer.parentId === null) && layer.type !== 'group';
    },
    [layerMap]
  );

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, layerId: string) => {
    if (!canDragLayer(layerId)) {
      event.preventDefault();
      return;
    }
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
    if (!draggingId || !canDragLayer(draggingId) || !canDragLayer(layerId)) {
      return;
    }
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
    if (!canDragLayer(draggingId) || !canDragLayer(targetId)) {
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

  const renderLayerRow = (layer: Layer, depth = 0): ReactNode => {
    const isGroup = layer.type === 'group';
    const allowDrag = canDragLayer(layer.id);
    const isDragTarget = dragOverId === layer.id && draggingId !== null;
    const isDragging = draggingId === layer.id;
    const childLayers = isGroup ? childMap.get(layer.id) ?? [] : [];
    const paddingLeft = 12 + depth * 20;
    const displayName = layer.name;
    const typeLabel = isGroup ? `group · ${childLayers.length}` : layer.type;

    return (
      <div key={layer.id} style={{ width: '100%' }}>
        <button
          onClick={() => handleRowClick(layer.id)}
          draggable={allowDrag}
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
            paddingLeft: `${paddingLeft}px`,
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
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isGroup && '📁'}
              {displayName}
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
              {typeLabel}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            {!isGroup && (
              <>
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
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
                    <circle cx="12" cy="12" r="3" />
                    {!layer.visible && <line x1="2" y1="2" x2="22" y2="22" />}
                  </svg>
                </button>
              </>
            )}
          </div>
        </button>
        {isGroup && childLayers.map((child) => renderLayerRow(child, depth + 1))}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
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
                requestCurrentStreamFrame();
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
            <button
              onClick={() => {
                groupSelection();
                requestCurrentStreamFrame();
              }}
              disabled={!canGroup}
              style={{
                ...iconButtonStyle,
                opacity: canGroup ? 1 : 0.35,
                cursor: canGroup ? 'pointer' : 'not-allowed',
              }}
              aria-label="Group selected layers"
            >
              Group
            </button>
            <button
              onClick={() => {
                if (primarySelectedLayer?.type === 'group') {
                  ungroupLayer(primarySelectedLayer.id);
                  requestCurrentStreamFrame();
                }
              }}
              disabled={!canUngroup}
              style={{
                ...iconButtonStyle,
                opacity: canUngroup ? 1 : 0.35,
                cursor: canUngroup ? 'pointer' : 'not-allowed',
              }}
              aria-label="Ungroup selected group"
            >
              Ungroup
            </button>
            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '32px',
                  left: '0',
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
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }} />
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    void onAddText();
                  }}
                  style={menuItemStyle}
                >
                  Text Overlay
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    void onAddImage();
                  }}
                  style={menuItemStyle}
                >
                  Image Overlay…
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    void onAddShape();
                  }}
                  style={menuItemStyle}
                >
                  Shape Overlay
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={layersListStyle}>
        {rootLayers.length === 0 ? (
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
          rootLayers.map((layer) => renderLayerRow(layer))
        )}
      </div>
      <div style={propertiesContainerStyle}>
        <LayerPropertiesPanel layer={selectedLayer ?? null} />
      </div>
    </div>
  );
}

const LAYERS_LIST_HEIGHT = 240;

const layersListStyle: CSSProperties = {
  height: `${LAYERS_LIST_HEIGHT}px`,
  maxHeight: `${LAYERS_LIST_HEIGHT}px`,
  overflowY: 'auto',
  borderRadius: '6px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'rgba(18, 18, 18, 0.6)',
  width: '100%',
};

const propertiesContainerStyle: CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  paddingTop: '12px',
  width: '100%',
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
