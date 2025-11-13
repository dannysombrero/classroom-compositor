/**
 * Hook for managing media capture (screen and camera) for presenter layers.
 * Extracts capture logic from PresenterPage for better separation of concerns.
 */

import { useCallback } from 'react';
import { useAppStore } from '../app/store';
import { startScreenCapture, startCameraCapture, stopSource } from '../media/sourceManager';
import { createScreenLayer, createCameraLayer } from '../layers/factory';
import { createId } from '../utils/id';
import { requestCurrentStreamFrame } from '../utils/viewerStream';

export function usePresenterCapture() {
  const { getCurrentScene, addLayer, updateLayer, removeLayer } = useAppStore();

  const startScreen = useCallback(async () => {
    const scene = getCurrentScene();
    if (!scene) return null;

    const layerId = createId('layer');
    const layer = createScreenLayer(layerId, scene.width, scene.height);

    addLayer(layer);

    try {
      const result = await startScreenCapture(layerId);
      if (!result) {
        removeLayer(layerId);
        return null;
      }

      useAppStore.getState().setSelection([layerId]);
      const track = result.stream.getVideoTracks()[0];
      if (track) {
        updateLayer(layerId, { streamId: track.id });
        track.addEventListener('ended', () => {
          stopSource(layerId);
          useAppStore.getState().removeLayer(layerId);
        });
      }
      requestCurrentStreamFrame();
      return layerId;
    } catch (err) {
      console.error('Failed to start screen capture:', err);
      removeLayer(layerId);
      return null;
    }
  }, [addLayer, getCurrentScene, removeLayer, updateLayer]);

  const startCamera = useCallback(async (deviceId?: string) => {
    const scene = getCurrentScene();
    if (!scene) return null;

    const layerId = createId('layer');
    const layer = createCameraLayer(layerId, scene.width, scene.height);

    addLayer(layer);

    try {
      const result = await startCameraCapture(layerId);
      if (!result) {
        removeLayer(layerId);
        return null;
      }

      useAppStore.getState().setSelection([layerId]);
      const track = result.stream.getVideoTracks()[0];
      if (track) {
        updateLayer(layerId, { streamId: track.id });
        track.addEventListener('ended', () => {
          stopSource(layerId);
          useAppStore.getState().removeLayer(layerId);
        });
      }
      requestCurrentStreamFrame();
      return { layerId, track };
    } catch (err) {
      console.error('Failed to start camera capture:', err);
      removeLayer(layerId);
      return null;
    }
  }, [addLayer, getCurrentScene, removeLayer, updateLayer]);

  const stopMediaSource = useCallback((layerId: string) => {
    stopSource(layerId);
  }, []);

  return {
    startScreen,
    startCamera,
    stopSource: stopMediaSource,
  };
}
