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
interface UpdateLayerOptions {
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
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

    const snapshot = snapshotScene(scene);
    const updatedScene: Scene = {
      ...scene,
      layers: scene.layers.filter((layer) => layer.id !== layerId),
    };

    set((state) => ({
      scenes: { ...state.scenes, [state.currentSceneId!]: updatedScene },
      selection: state.selection.filter((id) => id !== layerId),
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
