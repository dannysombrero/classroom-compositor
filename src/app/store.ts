/**
 * Zustand store for Classroom Compositor state management.
 * 
 * State is kept serializable for persistence and side effects are isolated
 * per AI_GUIDE.md guidelines.
 */

import { create } from 'zustand';
import type { Scene } from '../types/scene';

/**
 * Application state interface.
 */
interface AppState {
  /** Current scene being edited */
  scene: Scene | null;
}

/**
 * Store actions interface.
 */
interface AppActions {
  // Actions will be added here as features are implemented
}

/**
 * Combined store type.
 */
type AppStore = AppState & AppActions;

/**
 * Create and export the Zustand store hook.
 * 
 * @example
 * ```ts
 * const { scene } = useAppStore();
 * ```
 */
export const useAppStore = create<AppStore>((set, get) => ({
  // State
  scene: null,

  // Actions (empty for now, will be implemented later)
}));

