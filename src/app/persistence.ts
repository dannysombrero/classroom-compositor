/**
 * Persistence abstraction layer for scenes and assets.
 * 
 * Dexie (IndexedDB) is the primary backing store with a localStorage
 * fallback for environments where IndexedDB is not available (tests,
 * legacy browsers).
 */

import Dexie, { type Table } from 'dexie';
import type { Scene } from '../types/scene';

/**
 * Storage key prefix for scenes.
 */
const SCENES_KEY_PREFIX = 'classroom-compositor:scenes:';
const SCENES_METADATA_KEY = 'classroom-compositor:scenes-metadata';
const LEGACY_MIGRATION_FLAG = 'classroom-compositor:migrated-v1';

/**
 * Metadata about saved scenes (for listing/loading most recent).
 */
export interface SceneMetadata {
  id: string;
  name: string;
  updatedAt: number;
}

interface SceneRecord extends SceneMetadata {
  data: Scene;
}

/**
 * Dexie database schema.
 */
class ClassroomCompositorDB extends Dexie {
  scenes!: Table<SceneRecord, string>;

  constructor() {
    super('classroom-compositor');
    this.version(1).stores({
      scenes: '&id, updatedAt, name',
    });
  }
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
 * Dexie implementation of the persistence adapter.
 */
class DexieAdapter implements PersistenceAdapter {
  private db: ClassroomCompositorDB;
  private ready: Promise<ClassroomCompositorDB>;
  private legacy = new LocalStorageAdapter();

  constructor() {
    this.db = new ClassroomCompositorDB();
    this.ready = this.db.open().then(async () => {
      await this.migrateLegacyData(this.db);
      return this.db;
    });
  }

  private async getDB(): Promise<ClassroomCompositorDB> {
    return this.ready.catch((error) => {
      console.error('Dexie initialization failed:', error);
      throw error;
    });
  }

  private async migrateLegacyData(db: ClassroomCompositorDB): Promise<void> {
    let migrationAlreadyRun = false;
    try {
      if (typeof localStorage !== 'undefined') {
        migrationAlreadyRun = localStorage.getItem(LEGACY_MIGRATION_FLAG) === 'true';
      }
    } catch (error) {
      console.warn('DexieAdapter: unable to read migration flag', error);
    }

    if (migrationAlreadyRun) {
      return;
    }

    const markMigrated = () => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LEGACY_MIGRATION_FLAG, 'true');
        }
      } catch (error) {
        console.warn('DexieAdapter: unable to set migration flag', error);
      }
    };

    const existingCount = await db.scenes.count();
    if (existingCount > 0) {
      markMigrated();
      return;
    }

    const metadata = await this.legacy.loadScenesMetadata();
    if (metadata.length === 0) {
      markMigrated();
      return;
    }

    const records: SceneRecord[] = [];
    for (const item of metadata) {
      const scene = await this.legacy.loadScene(item.id);
      if (!scene) continue;
      records.push({
        id: item.id,
        name: scene.name || item.name || 'Untitled Scene',
        updatedAt: item.updatedAt ?? Date.now(),
        data: cloneScene(scene),
      });
    }

    if (records.length > 0) {
      await db.scenes.bulkPut(records);
    }
    markMigrated();
  }

  async loadScenesMetadata(): Promise<SceneMetadata[]> {
    const db = await this.getDB();
    const rows = await db.scenes.orderBy('updatedAt').reverse().toArray();
    return rows.map(({ id, name, updatedAt }) => ({ id, name, updatedAt }));
  }

  async loadScene(id: string): Promise<Scene | null> {
    const db = await this.getDB();
    const record = await db.scenes.get(id);
    return record ? cloneScene(record.data) : null;
  }

  async saveScene(scene: Scene): Promise<void> {
    if (!scene.id) {
      throw new Error('Scene must have an ID to save');
    }
    const db = await this.getDB();
    const name = scene.name || 'Untitled Scene';
    const entry: SceneRecord = {
      id: scene.id,
      name,
      updatedAt: Date.now(),
      data: cloneScene(scene),
    };
    await db.scenes.put(entry);
  }

  async deleteScene(id: string): Promise<void> {
    const db = await this.getDB();
    await db.scenes.delete(id);
  }
}

function cloneScene(scene: Scene): Scene {
  if (typeof structuredClone === 'function') {
    return structuredClone(scene);
  }
  return JSON.parse(JSON.stringify(scene)) as Scene;
}

function canUseIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function createPersistenceAdapter(): PersistenceAdapter {
  if (canUseIndexedDB()) {
    try {
      return new DexieAdapter();
    } catch (error) {
      console.warn('Falling back to localStorage persistence:', error);
    }
  }
  return new LocalStorageAdapter();
}

/**
 * Default persistence adapter instance.
 */
export const persistence: PersistenceAdapter = createPersistenceAdapter();

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
