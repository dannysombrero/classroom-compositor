/**
 * Hook for managing keyboard shortcuts in the presenter view.
 * Handles layer manipulation, navigation, and mode switching via hotkeys.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../app/store';
import { tinykeys } from 'tinykeys';
import type { KeyBindingMap } from 'tinykeys';
import { stopSource } from '../media/sourceManager';
import { requestCurrentStreamFrame } from '../utils/viewerStream';
import { createId } from '../utils/id';
import type { Layer } from '../types/scene';

interface UsePresenterHotkeysProps {
  editingTextId: string | null;
  isPresentationMode: boolean;
  onTogglePresentationMode: () => void;
  onExitPresentationMode: () => void;
  onToggleConfidencePreview: () => void;
}

export function usePresenterHotkeys({
  editingTextId,
  isPresentationMode,
  onTogglePresentationMode,
  onExitPresentationMode,
  onToggleConfidencePreview,
}: UsePresenterHotkeysProps) {
  const { undo, redo } = useAppStore();
  const clipboardRef = useRef<Layer[] | null>(null);

  const isTextInputTarget = useCallback((event: KeyboardEvent): boolean => {
    const target = event.target as HTMLElement | null;
    if (!target) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return true;
    return Boolean(editingTextId);
  }, [editingTextId]);

  const getSelectedLayers = useCallback((): Layer[] => {
    const state = useAppStore.getState();
    const scene = state.getCurrentScene();
    if (!scene) return [];
    return state.selection
      .map((id) => scene.layers.find((layer) => layer.id === id))
      .filter((layer): layer is Layer => Boolean(layer));
  }, []);

  const nudgeSelection = useCallback((dx: number, dy: number) => {
    const state = useAppStore.getState();
    const scene = state.getCurrentScene();
    if (!scene) return;
    const selection = state.selection;
    if (selection.length === 0) return;
    selection.forEach((id) => {
      const layer = scene.layers.find((entry) => entry.id === id);
      if (!layer || layer.locked) return;
      state.updateLayer(id, {
        transform: {
          ...layer.transform,
          pos: { x: layer.transform.pos.x + dx, y: layer.transform.pos.y + dy },
        },
      });
    });
    requestCurrentStreamFrame();
  }, []);

  const duplicateLayers = useCallback(() => {
    const layers = getSelectedLayers();
    if (layers.length === 0) return;
    const state = useAppStore.getState();
    const newIds: string[] = [];
    layers.forEach((layer, index) => {
      const clone: Layer = JSON.parse(JSON.stringify(layer));
      clone.id = createId("layer");
      clone.name = `${layer.name || "Layer"} Copy`;
      clone.transform = {
        ...layer.transform,
        pos: { x: layer.transform.pos.x + 24 + index * 12, y: layer.transform.pos.y + 24 + index * 12 },
      };
      newIds.push(clone.id);
      state.addLayer(clone);
    });
    state.setSelection(newIds);
    requestCurrentStreamFrame();
  }, [getSelectedLayers]);

  const copyLayersToClipboard = useCallback(() => {
    const layers = getSelectedLayers();
    if (layers.length === 0) return;
    clipboardRef.current = layers.map((layer) => JSON.parse(JSON.stringify(layer)));
  }, [getSelectedLayers]);

  const pasteClipboardLayers = useCallback(() => {
    const clipboard = clipboardRef.current;
    if (!clipboard || clipboard.length === 0) return;
    const state = useAppStore.getState();
    const newIds: string[] = [];
    clipboard.forEach((layer, index) => {
      const clone: Layer = JSON.parse(JSON.stringify(layer));
      clone.id = createId("layer");
      clone.name = `${layer.name || "Layer"} Paste`;
      clone.transform = {
        ...layer.transform,
        pos: { x: layer.transform.pos.x + 32 + index * 12, y: layer.transform.pos.y + 32 + index * 12 },
      };
      newIds.push(clone.id);
      state.addLayer(clone);
    });
    state.setSelection(newIds);
    requestCurrentStreamFrame();
  }, []);

  const toggleVisibilityForSelection = useCallback(() => {
    const layers = getSelectedLayers();
    if (layers.length === 0) return;
    const state = useAppStore.getState();
    layers.forEach((layer) => state.updateLayer(layer.id, { visible: !layer.visible }));
    requestCurrentStreamFrame();
  }, [getSelectedLayers]);

  const toggleLockForSelection = useCallback(() => {
    const layers = getSelectedLayers();
    if (layers.length === 0) return;
    const state = useAppStore.getState();
    layers.forEach((layer) => state.updateLayer(layer.id, { locked: !layer.locked }));
    requestCurrentStreamFrame();
  }, [getSelectedLayers]);

  const deleteSelection = useCallback(() => {
    const state = useAppStore.getState();
    const ids = state.selection;
    if (ids.length === 0) return;
    ids.forEach((id) => {
      stopSource(id);
      state.removeLayer(id);
    });
    state.setSelection([]);
    requestCurrentStreamFrame();
  }, []);

  useEffect(() => {
    const hotkeys: KeyBindingMap = {
      f: (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); onTogglePresentationMode(); },
      Escape: (e: KeyboardEvent) => { if (!isPresentationMode) return; e.preventDefault(); onExitPresentationMode(); },
      p: (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); onToggleConfidencePreview(); },
      ArrowLeft: (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); nudgeSelection(-1, 0); },
      ArrowRight: (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); nudgeSelection(1, 0); },
      ArrowUp: (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); nudgeSelection(0, -1); },
      ArrowDown: (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); nudgeSelection(0, 1); },
      "Shift+ArrowLeft": (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); nudgeSelection(-10, 0); },
      "Shift+ArrowRight": (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); nudgeSelection(10, 0); },
      "Shift+ArrowUp": (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); nudgeSelection(0, -10); },
      "Shift+ArrowDown": (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); nudgeSelection(0, 10); },
      "$mod+d": (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); duplicateLayers(); },
      "$mod+c": (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); copyLayersToClipboard(); },
      "$mod+v": (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); pasteClipboardLayers(); },
      "$mod+z": (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); undo(); },
      "$mod+Shift+z": (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); redo(); },
      "$mod+y": (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); redo(); },
      v: (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); toggleVisibilityForSelection(); },
      l: (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); toggleLockForSelection(); },
      Delete: (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); deleteSelection(); },
      Backspace: (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); deleteSelection(); },
    };
    const unsubscribe = tinykeys(window, hotkeys);
    return () => unsubscribe();
  }, [
    deleteSelection,
    duplicateLayers,
    onExitPresentationMode,
    isPresentationMode,
    nudgeSelection,
    pasteClipboardLayers,
    onToggleConfidencePreview,
    toggleLockForSelection,
    onTogglePresentationMode,
    toggleVisibilityForSelection,
    undo,
    redo,
    isTextInputTarget,
    copyLayersToClipboard,
  ]);
}
