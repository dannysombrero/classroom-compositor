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

function cloneLayer<T extends Layer>(layer: T, overrides: Partial<T>): T {
  return Object.assign({}, layer, overrides);
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

    // Ensure layer has an ID
    let workingLayer: Layer = layer;
    if (!workingLayer.id) {
      switch (workingLayer.type) {
        case 'camera':
          workingLayer = cloneLayer<CameraLayer>(workingLayer, { id: generateId() });
          break;
        case 'screen':
          workingLayer = cloneLayer<ScreenLayer>(workingLayer, { id: generateId() });
          break;
        case 'image':
          workingLayer = cloneLayer<ImageLayer>(workingLayer, { id: generateId() });
          break;
        case 'text':
          workingLayer = cloneLayer<TextLayer>(workingLayer, { id: generateId() });
          break;
        case 'shape':
          workingLayer = cloneLayer<ShapeLayer>(workingLayer, { id: generateId() });
          break;
        case 'group':
          workingLayer = cloneLayer<GroupLayer>(workingLayer, { id: generateId() });
          break;
      }
    }

    const maxZ = scene.layers.length > 0
      ? Math.max(...scene.layers.map((l) => l.z))
      : 0;
    const nextLayer: Layer = (() => {
      switch (workingLayer.type) {
        case 'camera':
          return cloneLayer<CameraLayer>(workingLayer, { z: maxZ + 1 });
        case 'screen':
          return cloneLayer<ScreenLayer>(workingLayer, { z: maxZ + 1 });
        case 'image':
          return cloneLayer<ImageLayer>(workingLayer, { z: maxZ + 1 });
        case 'text':
          return cloneLayer<TextLayer>(workingLayer, { z: maxZ + 1 });
        case 'shape':
          return cloneLayer<ShapeLayer>(workingLayer, { z: maxZ + 1 });
        case 'group':
          return cloneLayer<GroupLayer>(workingLayer, { z: maxZ + 1 });
      }
      const exhaustiveCheck: never = workingLayer as never;
      throw new Error(`Unhandled layer type ${(exhaustiveCheck as Layer).type}`);
    })();

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
        layer.id === layerId ? { ...layer, ...updates } : layer
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

    // Create a map for quick lookup
    const layerMap = new Map(scene.layers.map((layer) => [layer.id, layer]));

    // Build new layer array in the specified order, assigning z-order
    const total = layerIds.length;
    const reorderedLayers: Layer[] = [];

    layerIds.forEach((id, index) => {
      const layer = layerMap.get(id);
      if (!layer) return;
      const z = total - index;
      switch (layer.type) {
        case 'camera':
          reorderedLayers.push(cloneLayer<CameraLayer>(layer, { z }));
          break;
        case 'screen':
          reorderedLayers.push(cloneLayer<ScreenLayer>(layer, { z }));
          break;
        case 'image':
          reorderedLayers.push(cloneLayer<ImageLayer>(layer, { z }));
          break;
        case 'text':
          reorderedLayers.push(cloneLayer<TextLayer>(layer, { z }));
          break;
        case 'shape':
          reorderedLayers.push(cloneLayer<ShapeLayer>(layer, { z }));
          break;
        case 'group':
          reorderedLayers.push(cloneLayer<GroupLayer>(layer, { z }));
          break;
        default: {
          const exhaustiveCheck: never = layer as never;
          throw new Error(`Unhandled layer type ${(exhaustiveCheck as Layer).type}`);
        }
      }
    });

    // Add any layers not in the reorder list (shouldn't happen, but safety check)
    scene.layers.forEach((layer) => {
      if (!layerIds.includes(layer.id)) {
        const z = reorderedLayers.length;
        switch (layer.type) {
          case 'camera':
            reorderedLayers.push(cloneLayer<CameraLayer>(layer, { z }));
            break;
          case 'screen':
            reorderedLayers.push(cloneLayer<ScreenLayer>(layer, { z }));
            break;
          case 'image':
            reorderedLayers.push(cloneLayer<ImageLayer>(layer, { z }));
            break;
          case 'text':
            reorderedLayers.push(cloneLayer<TextLayer>(layer, { z }));
            break;
          case 'shape':
            reorderedLayers.push(cloneLayer<ShapeLayer>(layer, { z }));
            break;
          case 'group':
            reorderedLayers.push(cloneLayer<GroupLayer>(layer, { z }));
            break;
          default: {
            const exhaustiveCheck: never = layer as never;
            throw new Error(`Unhandled layer type ${(exhaustiveCheck as Layer).type}`);
          }
        }
      }
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
