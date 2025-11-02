/**
 * Persistence abstraction layer for scenes and assets.
 * 
 * Currently implemented with localStorage, but designed to be swappable
 * with Dexie (IndexedDB) later without changing the API.
 */

import type { Scene } from '../types/scene';

/**
 * Storage key prefix for scenes.
 */
const SCENES_KEY_PREFIX = 'classroom-compositor:scenes:';
const SCENES_METADATA_KEY = 'classroom-compositor:scenes-metadata';

/**
 * Metadata about saved scenes (for listing/loading most recent).
 */
interface SceneMetadata {
  id: string;
  name: string;
  updatedAt: number;
}

/**
 * Persistence interface that can be swapped with Dexie later.
 */
export interface PersistenceAdapter {
  /**
   * Load all scene metadata.
   */
  loadScenesMetadata: () => Promise<SceneMetadata[]>;

  /**
   * Load a specific scene by ID.
   */
  loadScene: (id: string) => Promise<Scene | null>;

  /**
   * Save a scene.
   */
  saveScene: (scene: Scene) => Promise<void>;

  /**
   * Delete a scene.
   */
  deleteScene: (id: string) => Promise<void>;
}

/**
 * localStorage implementation of the persistence adapter.
 */
class LocalStorageAdapter implements PersistenceAdapter {
  async loadScenesMetadata(): Promise<SceneMetadata[]> {
    try {
      const data = localStorage.getItem(SCENES_METADATA_KEY);
      if (!data) return [];
      return JSON.parse(data) as SceneMetadata[];
    } catch (error) {
      console.error('Failed to load scenes metadata:', error);
      return [];
    }
  }

  async loadScene(id: string): Promise<Scene | null> {
    try {
      const data = localStorage.getItem(`${SCENES_KEY_PREFIX}${id}`);
      if (!data) return null;
      return JSON.parse(data) as Scene;
    } catch (error) {
      console.error(`Failed to load scene ${id}:`, error);
      return null;
    }
  }

  async saveScene(scene: Scene): Promise<void> {
    if (!scene.id) {
      throw new Error('Scene must have an ID to save');
    }

    try {
      // Save the scene data
      localStorage.setItem(
        `${SCENES_KEY_PREFIX}${scene.id}`,
        JSON.stringify(scene)
      );

      // Update metadata
      const metadata = await this.loadScenesMetadata();
      const existingIndex = metadata.findIndex((m) => m.id === scene.id);
      const entry: SceneMetadata = {
        id: scene.id,
        name: scene.name || 'Untitled Scene',
        updatedAt: Date.now(),
      };

      if (existingIndex >= 0) {
        metadata[existingIndex] = entry;
      } else {
        metadata.push(entry);
      }

      // Sort by updatedAt descending (most recent first)
      metadata.sort((a, b) => b.updatedAt - a.updatedAt);

      localStorage.setItem(SCENES_METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error(`Failed to save scene ${scene.id}:`, error);
      throw error;
    }
  }

  async deleteScene(id: string): Promise<void> {
    try {
      // Remove scene data
      localStorage.removeItem(`${SCENES_KEY_PREFIX}${id}`);

      // Update metadata
      const metadata = await this.loadScenesMetadata();
      const filtered = metadata.filter((m) => m.id !== id);
      localStorage.setItem(SCENES_METADATA_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error(`Failed to delete scene ${id}:`, error);
      throw error;
    }
  }
}

/**
 * Default persistence adapter instance.
 * Can be swapped with a Dexie adapter later.
 */
export const persistence: PersistenceAdapter = new LocalStorageAdapter();

/**
 * Load all scenes metadata.
 */
export async function loadScenesMetadata(): Promise<SceneMetadata[]> {
  return persistence.loadScenesMetadata();
}

/**
 * Load a specific scene by ID.
 */
export async function loadScene(id: string): Promise<Scene | null> {
  return persistence.loadScene(id);
}

/**
 * Save a scene.
 */
export async function saveScene(scene: Scene): Promise<void> {
  return persistence.saveScene(scene);
}

/**
 * Delete a scene.
 */
export async function deleteScene(id: string): Promise<void> {
  return persistence.deleteScene(id);
}

/**
 * Load the most recent scene, or return null if none exist.
 */
export async function loadMostRecentScene(): Promise<Scene | null> {
  const metadata = await loadScenesMetadata();
  if (metadata.length === 0) {
    return null;
  }

  const mostRecent = metadata[0];
  return loadScene(mostRecent.id);
}

