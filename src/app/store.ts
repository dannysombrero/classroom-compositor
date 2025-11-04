/**
 * Zustand store for Classroom Compositor state management.
 * 
 * State is kept serializable for persistence and side effects are isolated
 * per AI_GUIDE.md guidelines.
 */

import { create } from 'zustand';
import type {
  Scene,
  Layer,
  CameraLayer,
  ScreenLayer,
  ImageLayer,
  TextLayer,
  ShapeLayer,
  GroupLayer,
} from '../types/scene';
import { saveScene as persistScene } from './persistence';
import { getLayerBoundingSize } from '../utils/layerGeometry';

/**
 * Application state interface.
 */
interface AppState {
  /** All saved scenes by ID */
  scenes: Record<string, Scene>;
  /** ID of the currently active scene */
  currentSceneId: string | null;
  /** Array of selected layer IDs */
  selection: string[];
  /** Undo stack for current scene */
  history: Scene[];
  /** Redo stack for current scene */
  future: Scene[];
}

/**
 * Store actions interface.
 */
export interface UpdateLayerOptions {
  recordHistory?: boolean;
  persist?: boolean;
  historySnapshot?: Scene | null;
}

interface AppActions {
  /**
   * Get the current scene being edited.
   */
  getCurrentScene: () => Scene | null;

  /**
   * Create a new scene with default settings.
   */
  createScene: (name?: string, width?: number, height?: number) => void;

  /**
   * Load a scene by ID.
   */
  loadScene: (id: string) => void;

  /**
   * Save the current scene (updates existing or creates new).
   */
  saveScene: () => Promise<void>;

  /**
   * Add a layer to the current scene.
   */
  addLayer: (layer: Layer) => void;

  /**
   * Remove a layer from the current scene.
   */
  removeLayer: (layerId: string) => void;

  /**
   * Update a layer with a partial update.
   */
  updateLayer: (layerId: string, updates: Partial<Layer>, options?: UpdateLayerOptions) => void;

  /**
   * Set the selected layer IDs.
   */
  setSelection: (layerIds: string[]) => void;

  /** Group the current selection into a group layer. */
  groupSelection: () => void;

  /** Ungroup a specific group layer back into its children. */
  ungroupLayer: (groupId: string) => void;

  /** Toggle visibility for a group and its children. */
  toggleGroupVisibility: (groupId: string) => void;

  /** Toggle lock state for a group and its children. */
  toggleGroupLock: (groupId: string) => void;

  /**
   * Reorder layers by their z-order.
   */
  reorderLayers: (layerIds: string[]) => void;
  undo: () => void;
  redo: () => void;
}

/**
 * Combined store type.
 */
type AppStore = AppState & AppActions;

/**
 * Generate a unique ID for layers and scenes.
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function ensureLayerId<T extends Layer>(layer: T): T {
  return layer.id ? layer : ({ ...layer, id: generateId() } as T);
}

function withLayerZ<T extends Layer>(layer: T, z: number): T {
  return { ...layer, z } as T;
}

function cloneLayerWithZ<T extends Layer>(layer: T, z: number): T {
  return { ...layer, z } as T;
}

function applyLayerUpdates(layer: Layer, updates: Partial<Layer>): Layer {
  const merged = { ...layer, ...updates, type: layer.type } as Layer;

  switch (layer.type) {
    case 'screen':
      return merged as ScreenLayer;
    case 'camera':
      return merged as CameraLayer;
    case 'image':
      return merged as ImageLayer;
    case 'text':
      return merged as TextLayer;
    case 'shape':
      return merged as ShapeLayer;
    case 'group':
      return merged as GroupLayer;
    default: {
      const exhaustiveCheck: never = layer;
      return exhaustiveCheck;
    }
  }
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function computeLayersBounds(layers: Layer[], scene: Scene): Bounds | null {
  if (layers.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const layer of layers) {
    const size = getLayerBoundingSize(layer, scene);
    const halfWidth = size.width / 2;
    const halfHeight = size.height / 2;
    const { x, y } = layer.transform.pos;

    minX = Math.min(minX, x - halfWidth);
    maxX = Math.max(maxX, x + halfWidth);
    minY = Math.min(minY, y - halfHeight);
    maxY = Math.max(maxY, y + halfHeight);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return null;
  }

  return { minX, maxX, minY, maxY };
}

function persistSceneImmediate(scene: Scene): void {
  void persistScene(scene).catch((error) => {
    console.error('Store: Failed to persist scene', error);
  });
}

function snapshotScene(scene: Scene | null): Scene | null {
  if (!scene) return null;
  if (typeof structuredClone === 'function') {
    return structuredClone(scene);
  }
  return JSON.parse(JSON.stringify(scene)) as Scene;
}

/**
 * Create and export the Zustand store hook.
 * 
 * @example
 * ```ts
 * const { scene, addLayer } = useAppStore();
 * ```
 */
export const useAppStore = create<AppStore>((set, get) => ({
  // State
  scenes: {},
  currentSceneId: null,
  selection: [],
  history: [],
  future: [],

  // Actions
  getCurrentScene: () => {
    const { scenes, currentSceneId } = get();
    return currentSceneId ? scenes[currentSceneId] || null : null;
  },

  createScene: (name = 'Untitled Scene', width = 1920, height = 1080) => {
    const id = generateId();
    const scene: Scene = {
      id,
      name,
      width,
      height,
      layers: [],
    };

    set((state) => ({
      scenes: { ...state.scenes, [id]: scene },
      currentSceneId: id,
      selection: [],
      history: [],
      future: [],
    }));
    persistSceneImmediate(scene);
  },

  loadScene: (id: string) => {
    const { scenes } = get();
    if (scenes[id]) {
      set({ currentSceneId: id, selection: [], history: [], future: [] });
    }
  },

  saveScene: async () => {
    const { scenes, currentSceneId, getCurrentScene } = get();
    const scene = getCurrentScene();
    if (scene && currentSceneId) {
      // Update in-memory store
      set({
        scenes: { ...scenes, [currentSceneId]: { ...scene } },
      });

      // Persist to storage
      try {
        await persistScene(scene);
      } catch (error) {
        console.error('Failed to persist scene:', error);
      }
    }
  },

  addLayer: (layer: Layer) => {
    const { getCurrentScene } = get();
    const scene = getCurrentScene();
    if (!scene) return;

    const workingLayer = ensureLayerId(layer);
    const maxZ = scene.layers.length > 0
      ? Math.max(...scene.layers.map((l) => l.z))
      : 0;
    const nextLayer = withLayerZ(workingLayer, maxZ + 1);
    const snapshot = snapshotScene(scene);
    const updatedScene: Scene = {
      ...scene,
      layers: [...scene.layers, nextLayer],
    };

    set((state) => ({
      scenes: { ...state.scenes, [state.currentSceneId!]: updatedScene },
      history: snapshot ? [...state.history, snapshot] : state.history,
      future: [],
    }));
    persistSceneImmediate(updatedScene);
  },

  removeLayer: (layerId: string) => {
    const { getCurrentScene } = get();
    const scene = getCurrentScene();
    if (!scene) return;

    const layerToRemove = scene.layers.find((layer) => layer.id === layerId);
    if (!layerToRemove) return;

    const snapshot = snapshotScene(scene);
    let updatedLayers: Layer[];

    if (layerToRemove.type === 'group') {
      const childSet = new Set(layerToRemove.children);
      updatedLayers = scene.layers
        .filter((layer) => layer.id !== layerId)
        .map((layer) => {
          if (childSet.has(layer.id)) {
            return { ...layer, parentId: null } as Layer;
          }
          return layer;
        });
    } else {
      const parentId = layerToRemove.parentId ?? null;
      updatedLayers = scene.layers
        .filter((layer) => layer.id !== layerId)
        .map((layer) => {
          if (layer.type === 'group' && layer.children.includes(layerId)) {
            const filteredChildren = layer.children.filter((id) => id !== layerId);
            const visibility = layer.childVisibility ? { ...layer.childVisibility } : undefined;
            if (visibility && layerId in visibility) {
              delete visibility[layerId];
            }
            return {
              ...layer,
              children: filteredChildren,
              childVisibility: visibility,
            } as GroupLayer;
          }
          if (parentId && layer.id === parentId) {
            return layer;
          }
          return layer;
        });
    }

    const updatedScene: Scene = {
      ...scene,
      layers: updatedLayers,
    };

    const removedIds = new Set<string>(
      layerToRemove.type === 'group' ? [layerId, ...layerToRemove.children] : [layerId]
    );

    set((state) => ({
      scenes: { ...state.scenes, [state.currentSceneId!]: updatedScene },
      selection: state.selection.filter((id) => !removedIds.has(id)),
      history: snapshot ? [...state.history, snapshot] : state.history,
      future: [],
    }));
    persistSceneImmediate(updatedScene);
  },

  updateLayer: (layerId: string, updates: Partial<Layer>, options: UpdateLayerOptions = {}) => {
    const { recordHistory = true, persist = true, historySnapshot } = options;
    const { getCurrentScene } = get();
    const scene = getCurrentScene();
    if (!scene) return;

    const snapshotSource = historySnapshot ?? (recordHistory ? snapshotScene(scene) : null);
    const snapshotClone = snapshotSource ? snapshotScene(snapshotSource) : null;
    const updatedScene: Scene = {
      ...scene,
      layers: scene.layers.map((layer) =>
        layer.id === layerId ? applyLayerUpdates(layer, updates) : layer
      ),
    };

    set((state) => ({
      scenes: { ...state.scenes, [state.currentSceneId!]: updatedScene },
      history: snapshotClone ? [...state.history, snapshotClone] : state.history,
      future: snapshotClone ? [] : state.future,
    }));
    if (persist) {
      persistSceneImmediate(updatedScene);
    }
  },

  setSelection: (layerIds: string[]) => {
    set({ selection: layerIds });
  },

  toggleGroupVisibility: (groupId: string) => {
    const { getCurrentScene } = get();
    const scene = getCurrentScene();
    if (!scene) return;

    const targetGroup = scene.layers.find((l) => l.id === groupId);
    if (!targetGroup || targetGroup.type !== 'group') return;

    const snapshot = snapshotScene(scene);
    const newVisible = !targetGroup.visible;
    const childSet = new Set(targetGroup.children);

    // Update child's visibility map on the group
    const updatedChildVis: Record<string, boolean> = { ...(targetGroup.childVisibility ?? {}) };
    for (const id of childSet) updatedChildVis[id] = newVisible;

    const updatedLayers: Layer[] = scene.layers.map((layer) => {
      if (layer.id === groupId && layer.type === 'group') {
        return {
          ...layer,
          visible: newVisible,
          childVisibility: updatedChildVis,
        } as GroupLayer;
      }
      if (childSet.has(layer.id)) {
        return {
          ...layer,
          visible: newVisible,
        } as Layer;
      }
      return layer;
    });

    const updatedScene: Scene = { ...scene, layers: updatedLayers };

    set((state) => ({
      scenes: { ...state.scenes, [state.currentSceneId!]: updatedScene },
      history: snapshot ? [...state.history, snapshot] : state.history,
      future: [],
    }));
    persistSceneImmediate(updatedScene);
  },

  toggleGroupLock: (groupId: string) => {
    const { getCurrentScene } = get();
    const scene = getCurrentScene();
    if (!scene) return;

    const targetGroup = scene.layers.find((l) => l.id === groupId);
    if (!targetGroup || targetGroup.type !== 'group') return;

    const snapshot = snapshotScene(scene);
    const newLocked = !targetGroup.locked;
    const childSet = new Set(targetGroup.children);

    const updatedLayers: Layer[] = scene.layers.map((layer) => {
      if (layer.id === groupId && layer.type === 'group') {
        return {
          ...layer,
          locked: newLocked,
        } as GroupLayer;
      }
      if (childSet.has(layer.id)) {
        return {
          ...layer,
          locked: newLocked,
        } as Layer;
      }
      return layer;
    });

    const updatedScene: Scene = { ...scene, layers: updatedLayers };

    set((state) => ({
      scenes: { ...state.scenes, [state.currentSceneId!]: updatedScene },
      history: snapshot ? [...state.history, snapshot] : state.history,
      future: [],
    }));
    persistSceneImmediate(updatedScene);
  },

  groupSelection: () => {
    const { getCurrentScene } = get();
    const scene = getCurrentScene();
    if (!scene) return;

    const selection = get().selection;
    if (selection.length < 2) {
      return;
    }

    const layerMap = new Map(scene.layers.map((layer) => [layer.id, layer] as const));
    const selectedLayers: Layer[] = selection
      .map((id) => layerMap.get(id))
      .filter((layer): layer is Layer => !!layer);

    const groupable = selectedLayers.filter(
      (layer) => layer.type !== 'group' && !layer.locked && (layer.parentId === undefined || layer.parentId === null)
    );

    if (groupable.length < 2) {
      return;
    }

    const bounds = computeLayersBounds(groupable, scene);
    if (!bounds) {
      return;
    }

    const groupId = generateId();
    const groupCount = scene.layers.filter((layer) => layer.type === 'group').length;
    const groupName = `Group ${groupCount + 1}`;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const maxZ = Math.max(...groupable.map((layer) => layer.z));
    const childIds = groupable.map((layer) => layer.id);
    const childVisibility: Record<string, boolean> = {};
    for (const layer of groupable) {
      childVisibility[layer.id] = layer.visible;
    }

    const groupLayer: GroupLayer = {
      id: groupId,
      type: 'group',
      name: groupName,
      visible: true,
      locked: false,
      parentId: null,
      z: maxZ + 1,
      transform: {
        pos: { x: centerX, y: centerY },
        scale: { x: 1, y: 1 },
        rot: 0,
        opacity: 1,
      },
      children: childIds,
      childVisibility,
    };

    const snapshot = snapshotScene(scene);

    const updatedLayers: Layer[] = [
      ...scene.layers.map((layer) => {
        if (childIds.includes(layer.id)) {
          return { ...layer, parentId: groupId } as Layer;
        }
        return layer;
      }),
      groupLayer,
    ];

    const updatedScene: Scene = {
      ...scene,
      layers: updatedLayers,
    };

    set((state) => ({
      scenes: { ...state.scenes, [state.currentSceneId!]: updatedScene },
      selection: [groupId],
      history: snapshot ? [...state.history, snapshot] : state.history,
      future: [],
    }));
    persistSceneImmediate(updatedScene);
  },

  ungroupLayer: (groupId: string) => {
    const { getCurrentScene } = get();
    const scene = getCurrentScene();
    if (!scene) return;

    const targetGroup = scene.layers.find((layer) => layer.id === groupId);
    if (!targetGroup || targetGroup.type !== 'group') {
      return;
    }

    const childSet = new Set(targetGroup.children);
    const snapshot = snapshotScene(scene);

    const updatedLayers: Layer[] = scene.layers
      .filter((layer) => layer.id !== groupId)
      .map((layer) => {
        if (childSet.has(layer.id)) {
          const visibility = targetGroup.childVisibility?.[layer.id];
          return {
            ...layer,
            parentId: null,
            visible: visibility ?? layer.visible,
          } as Layer;
        }
        return layer;
      });

    const updatedScene: Scene = {
      ...scene,
      layers: updatedLayers,
    };

    set((state) => ({
      scenes: { ...state.scenes, [state.currentSceneId!]: updatedScene },
      selection: targetGroup.children,
      history: snapshot ? [...state.history, snapshot] : state.history,
      future: [],
    }));
    persistSceneImmediate(updatedScene);
  },

  reorderLayers: (layerIds: string[]) => {
    const { getCurrentScene } = get();
    const scene = getCurrentScene();
    if (!scene) return;

    const snapshot = snapshotScene(scene);
    const layerMap = new Map(scene.layers.map((layer) => [layer.id, layer] as const));
    const seen = new Set<string>();
    const orderedIds: string[] = [];

    for (const id of layerIds) {
      if (!seen.has(id) && layerMap.has(id)) {
        orderedIds.push(id);
        seen.add(id);
      }
    }

    for (const layer of scene.layers) {
      if (!seen.has(layer.id)) {
        orderedIds.push(layer.id);
        seen.add(layer.id);
      }
    }

    const total = orderedIds.length;
    const reorderedLayers: Layer[] = orderedIds.map((id, index) => {
      const layer = layerMap.get(id);
      if (!layer) {
        throw new Error(`Layer ${id} not found during reorder`);
      }
      return cloneLayerWithZ(layer, total - index);
    });

    const updatedScene: Scene = {
      ...scene,
      layers: reorderedLayers,
    };

    set((state) => ({
      scenes: { ...state.scenes, [state.currentSceneId!]: updatedScene },
      history: snapshot ? [...state.history, snapshot] : state.history,
      future: [],
    }));
    persistSceneImmediate(updatedScene);
  },

  undo: () => {
    const state = get();
    const { history, currentSceneId } = state;
    if (!currentSceneId || history.length === 0) return;
    const scenes = state.scenes;
    const current = scenes[currentSceneId];
    const previous = history[history.length - 1];
    if (!current || !previous) return;
    set({
      scenes: { ...scenes, [currentSceneId]: previous },
      history: history.slice(0, -1),
      future: [snapshotScene(current)!, ...state.future],
    });
    persistSceneImmediate(previous);
  },

  redo: () => {
    const state = get();
    const { future, currentSceneId } = state;
    if (!currentSceneId || future.length === 0) return;
    const scenes = state.scenes;
    const current = scenes[currentSceneId];
    const nextScene = future[0];
    if (!current || !nextScene) return;
    set({
      scenes: { ...scenes, [currentSceneId]: nextScene },
      history: [...state.history, snapshotScene(current)!],
      future: future.slice(1),
    });
    persistSceneImmediate(nextScene);
  },
}));
