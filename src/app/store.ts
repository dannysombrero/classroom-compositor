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
}

/**
 * Store actions interface.
 */
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
  updateLayer: (layerId: string, updates: Partial<Layer>) => void;

  /**
   * Set the selected layer IDs.
   */
  setSelection: (layerIds: string[]) => void;

  /**
   * Reorder layers by their z-order.
   */
  reorderLayers: (layerIds: string[]) => void;
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
    }));
  },

  loadScene: (id: string) => {
    const { scenes } = get();
    if (scenes[id]) {
      set({ currentSceneId: id, selection: [] });
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
    const updatedScene: Scene = {
      ...scene,
      layers: [...scene.layers, nextLayer],
    };

    set((state) => ({
      scenes: { ...state.scenes, [state.currentSceneId!]: updatedScene },
    }));
  },

  removeLayer: (layerId: string) => {
    const { getCurrentScene } = get();
    const scene = getCurrentScene();
    if (!scene) return;

    const updatedScene: Scene = {
      ...scene,
      layers: scene.layers.filter((layer) => layer.id !== layerId),
    };

    set((state) => ({
      scenes: { ...state.scenes, [state.currentSceneId!]: updatedScene },
      selection: state.selection.filter((id) => id !== layerId),
    }));
  },

  updateLayer: (layerId: string, updates: Partial<Layer>) => {
    const { getCurrentScene } = get();
    const scene = getCurrentScene();
    if (!scene) return;

    const updatedScene: Scene = {
      ...scene,
      layers: scene.layers.map((layer) =>
        layer.id === layerId ? applyLayerUpdates(layer, updates) : layer
      ),
    };

    set((state) => ({
      scenes: { ...state.scenes, [state.currentSceneId!]: updatedScene },
    }));
  },

  setSelection: (layerIds: string[]) => {
    set({ selection: layerIds });
  },

  reorderLayers: (layerIds: string[]) => {
    const { getCurrentScene } = get();
    const scene = getCurrentScene();
    if (!scene) return;

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
    }));
  },
}));
