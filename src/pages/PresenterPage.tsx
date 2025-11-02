/**
 * PresenterPage component - main editing interface with canvas and overlay panel.
 * 
 * Mounts the PresenterCanvas and provides space for the overlay panel with
 * visibility toggles and layer controls.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { PresenterCanvas, type CanvasLayout } from '../components/PresenterCanvas';
import {
  captureCanvasStream,
  sendStreamToViewer,
  notifyStreamEnded,
  setCurrentStream,
  DEFAULT_STREAM_FPS,
  requestCurrentStreamFrame,
  type ViewerMessage,
} from '../utils/viewerStream';
import { useAppStore } from '../app/store';
import { loadMostRecentScene } from '../app/persistence';
import { createId } from '../utils/id';
import {
  createScreenLayer,
  createCameraLayer,
  createTextLayer,
  createImageLayer,
  createShapeLayer,
} from '../layers/factory';
import {
  startScreenCapture,
  startCameraCapture,
  stopSource,
} from '../media/sourceManager';
import { FloatingPanel } from '../components/FloatingPanel';
import { LayersPanel } from '../components/LayersPanel';
import { TransformControls } from '../components/TransformControls';
import type { Layer, CameraLayer, Scene } from '../types/scene';
import { CameraOverlayControls } from '../components/CameraOverlayControls';

const EMPTY_LAYERS: Layer[] = [];

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);
    image.src = src;
  });
}

/**
 * Main presenter page component.
 * 
 * @returns Layout with canvas and overlay panel placeholder
 */
export function PresenterPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerWindowRef = useRef<Window | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isAddingScreen, setIsAddingScreen] = useState(false);
  const [isAddingCamera, setIsAddingCamera] = useState(false);
  const layerIdsRef = useRef<string[]>([]);
  const [panelPosition, setPanelPosition] = useState({ x: 24, y: 24 });
  const [panelSize, setPanelSize] = useState({ width: 280, height: 360 });
  const [canvasLayout, setCanvasLayout] = useState<CanvasLayout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sceneLayers: Layer[] = useAppStore((state) => {
    if (!state.currentSceneId) return EMPTY_LAYERS;
    const scene = state.scenes[state.currentSceneId];
    return scene ? scene.layers : EMPTY_LAYERS;
  });
  const currentScene = useAppStore((state) => {
    if (!state.currentSceneId) return null;
    return state.scenes[state.currentSceneId] ?? null;
  }) as Scene | null;
  const selectedLayer = useAppStore((state) => {
    if (!state.currentSceneId || state.selection.length === 0) return null;
    const scene = state.scenes[state.currentSceneId];
    if (!scene) return null;
    const id = state.selection[0];
    return scene.layers.find((layer) => layer.id === id) ?? null;
  }) as Layer | null;
  const { getCurrentScene, createScene, saveScene, addLayer, removeLayer, updateLayer } = useAppStore();

  // Set up canvas ref callback
  const handleCanvasRef = (canvas: HTMLCanvasElement | null) => {
    if (canvas && canvasRef.current !== canvas) {
      canvasRef.current = canvas;
      
      // If viewer is already open, start streaming
      if (isViewerOpen && viewerWindowRef.current) {
        startStreaming(canvas);
      }
    }
  };

  const handleCanvasLayoutChange = useCallback((layout: CanvasLayout) => {
    setCanvasLayout(layout);
  }, []);

  const addScreenCaptureLayer = useCallback(async () => {
    if (isAddingScreen) return;

    const scene = getCurrentScene();
    if (!scene) {
      console.warn('Presenter: Cannot add screen capture without a scene');
      return;
    }

    const layerId = createId('layer');
    const layer = createScreenLayer(layerId, scene.width, scene.height);

    setIsAddingScreen(true);
    addLayer(layer);

    try {
      const result = await startScreenCapture(layerId);
      if (!result) {
        removeLayer(layerId);
        return;
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
    } finally {
      setIsAddingScreen(false);
    }
  }, [addLayer, getCurrentScene, isAddingScreen, removeLayer, updateLayer]);

  const addCameraLayer = useCallback(async () => {
    if (isAddingCamera) return;

    const scene = getCurrentScene();
    if (!scene) {
      console.warn('Presenter: Cannot add camera layer without a scene');
      return;
    }

    const layerId = createId('layer');
    const layer = createCameraLayer(layerId, scene.width, scene.height);

    setIsAddingCamera(true);
    addLayer(layer);

    try {
      const result = await startCameraCapture(layerId);
      if (!result) {
        removeLayer(layerId);
        return;
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
    } finally {
      setIsAddingCamera(false);
    }
  }, [addLayer, getCurrentScene, isAddingCamera, removeLayer, updateLayer]);

  const addTextLayer = useCallback(() => {
    const scene = getCurrentScene();
    if (!scene) {
      console.warn('Presenter: Cannot add text layer without a scene');
      return;
    }

    const layerId = createId('layer');
    const layer = createTextLayer(layerId, scene.width, scene.height);
    addLayer(layer);
    useAppStore.getState().setSelection([layerId]);
    requestCurrentStreamFrame();
  }, [addLayer, getCurrentScene]);

  const addShapeLayer = useCallback(() => {
    const scene = getCurrentScene();
    if (!scene) {
      console.warn('Presenter: Cannot add shape layer without a scene');
      return;
    }

    const layerId = createId('layer');
    const layer = createShapeLayer(layerId, scene.width, scene.height);
    addLayer(layer);
    useAppStore.getState().setSelection([layerId]);
    requestCurrentStreamFrame();
  }, [addLayer, getCurrentScene]);

  const addImageLayer = useCallback(() => {
    const scene = getCurrentScene();
    if (!scene) {
      console.warn('Presenter: Cannot add image layer without a scene');
      return;
    }

    const input = fileInputRef.current;
    if (!input) {
      console.warn('Presenter: Image input not available');
      return;
    }

    const handleChange = async (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0] ?? null;
      target.value = '';

      if (!file) {
        return;
      }

      try {
        const dataUri = await readFileAsDataURL(file);
        const image = await loadImage(dataUri);
        const layerId = createId('layer');
        const naturalWidth = image.naturalWidth || 640;
        const naturalHeight = image.naturalHeight || 360;
        const layer = createImageLayer(layerId, scene.width, scene.height, {
          width: naturalWidth,
          height: naturalHeight,
          dataUri,
        });
        layer.name = file.name ? file.name.replace(/\.[^/.]+$/, '') || 'Image' : 'Image';

        const maxWidth = scene.width * 0.6;
        const maxHeight = scene.height * 0.6;
        const scaleFactor = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
        if (scaleFactor < 1) {
          layer.transform = {
            ...layer.transform,
            scale: { x: scaleFactor, y: scaleFactor },
          };
        }
        addLayer(layer);
        useAppStore.getState().setSelection([layerId]);
        requestCurrentStreamFrame();
      } catch (error) {
        console.error('Presenter: Failed to load image layer', error);
      }
    };

    input.addEventListener('change', handleChange, { once: true });
    input.click();
  }, [addLayer, getCurrentScene]);

  useEffect(() => {
    if (sceneLayers === EMPTY_LAYERS) {
      if (layerIdsRef.current.length > 0) {
        layerIdsRef.current.forEach((id) => stopSource(id));
        layerIdsRef.current = [];
      }
      return;
    }

    const currentIds = sceneLayers.map((layer) => layer.id);
    const removed = layerIdsRef.current.filter((id) => !currentIds.includes(id));
    removed.forEach((id) => stopSource(id));
    layerIdsRef.current = currentIds;
  }, [sceneLayers]);

  const startStreaming = useCallback((canvas: HTMLCanvasElement) => {
    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Capture new stream
    const stream = captureCanvasStream(canvas, { fps: DEFAULT_STREAM_FPS });
    if (!stream) {
      console.error('Presenter: Failed to capture canvas stream');
      return;
    }

    console.log('Presenter: Captured stream with', stream.getVideoTracks().length, 'video tracks');
    streamRef.current = stream;

    const track = stream.getVideoTracks()[0];
    if (track) {
      console.log('Presenter: Stream track settings', {
        readyState: track.readyState,
        muted: track.muted,
        enabled: track.enabled,
        settings: track.getSettings?.() ?? null,
      });
    }

    // Store stream globally for viewer to access
    setCurrentStream(stream);

    // Send to viewer window if open
    if (viewerWindowRef.current && !viewerWindowRef.current.closed) {
      console.log('Presenter: Sending stream to viewer window');
      sendStreamToViewer(viewerWindowRef.current, stream);
    } else {
      console.warn('Presenter: No viewer window available to send stream');
    }

    // Handle stream ended
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      console.log('Presenter: Stream ended');
      if (viewerWindowRef.current && !viewerWindowRef.current.closed) {
        notifyStreamEnded(viewerWindowRef.current);
      }
      streamRef.current = null;
      setCurrentStream(null);
    });
  }, []);

  const openViewer = () => {
    if (viewerWindowRef.current && !viewerWindowRef.current.closed) {
      // Viewer already open, just focus it
      viewerWindowRef.current.focus();
      return;
    }

    // Open new viewer window
    const viewer = window.open('/viewer', 'classroom-compositor-viewer', 'width=1920,height=1080');
    if (!viewer) {
      console.error('Failed to open viewer window (popup blocked?)');
      return;
    }

    viewerWindowRef.current = viewer;
    setIsViewerOpen(true);

    // Wait for viewer to load, then send stream
    viewer.addEventListener('load', () => {
      if (canvasRef.current) {
        startStreaming(canvasRef.current);
      }
    });

    // Handle viewer window close
    const checkClosed = setInterval(() => {
      if (viewer.closed) {
        clearInterval(checkClosed);
        setIsViewerOpen(false);
        viewerWindowRef.current = null;
        
        // Stop stream when viewer closes
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      }
    }, 500);

    // Also try to send stream immediately (in case load event already fired)
    setTimeout(() => {
      if (canvasRef.current && !viewer.closed) {
        startStreaming(canvasRef.current);
      }
    }, 100);
  };

  // Listen for viewer-ready messages (when viewer window loads/reconnects)
  useEffect(() => {
    const handleMessage = (event: MessageEvent<ViewerMessage | { type: 'request-stream' }>) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === 'request-stream') {
        console.log('Presenter: Viewer requested stream');
        // Viewer is requesting the stream, notify that it's available
        // (we can't send MediaStream via postMessage, so viewer will get it from opener)
        if (streamRef.current) {
          console.log('Presenter: Notifying viewer that stream is available');
          // Just notify - viewer will get stream from opener.currentStream
          sendStreamToViewer(viewerWindowRef.current!, streamRef.current);
        } else if (canvasRef.current) {
          console.log('Presenter: Starting new stream for viewer');
          startStreaming(canvasRef.current);
        } else {
          console.warn('Presenter: No canvas available to create stream');
        }
      } else if (event.data?.type === 'viewer-ready') {
        console.log('Presenter: Received viewer-ready message');
        // Viewer is ready, start streaming if we don't have a stream yet
        // If stream exists, viewer will get it from opener.currentStream automatically
        if (streamRef.current) {
          console.log('Presenter: Stream already available, viewer will get it from opener');
          // Don't send notification - viewer already has access via opener.currentStream
        } else if (canvasRef.current) {
          // Start streaming to newly ready viewer
          console.log('Presenter: Starting new stream for viewer');
          startStreaming(canvasRef.current);
        } else {
          console.warn('Presenter: No canvas available to stream');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [startStreaming]);

  // Initialize scene on mount (load most recent or create new)
  useEffect(() => {
    const initializeScene = async () => {
      const currentScene = getCurrentScene();
      if (currentScene) {
        // Scene already loaded, nothing to do
        console.log('Scene already loaded:', currentScene.id);
        return;
      }

      console.log('Initializing scene...');
      // Try to load most recent scene
      const mostRecent = await loadMostRecentScene();
      if (mostRecent && mostRecent.id) {
        console.log('Loading most recent scene:', mostRecent.id);
        // Load the scene into store (we need to add it first, then load it)
        useAppStore.setState((state) => ({
          scenes: { ...state.scenes, [mostRecent.id!]: mostRecent },
          currentSceneId: mostRecent.id,
        }));
      } else {
        console.log('No saved scenes, creating new scene');
        // No saved scenes, create a new one
        createScene();
      }
    };

    initializeScene();
  }, [getCurrentScene, createScene]);

  // Auto-save scene periodically and on unmount
  useEffect(() => {
    const currentScene = getCurrentScene();
    if (!currentScene || !currentScene.id) return;

    const saveInterval = setInterval(() => {
      saveScene();
    }, 30000); // Auto-save every 30 seconds

    return () => {
      clearInterval(saveInterval);
      // Final save on unmount
      saveScene();
    };
  }, [getCurrentScene, saveScene]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
       layerIdsRef.current.forEach((id) => stopSource(id));
      if (viewerWindowRef.current && !viewerWindowRef.current.closed) {
        viewerWindowRef.current.close();
      }
    };
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        position: 'relative',
      }}
    >
      {/* Main canvas area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <PresenterCanvas
          ref={handleCanvasRef}
          fitToContainer
          onLayoutChange={handleCanvasLayoutChange}
        />
        
        {/* Open Viewer button */}
        <button
          onClick={openViewer}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            padding: '8px 16px',
            backgroundColor: isViewerOpen ? '#4a4a4a' : '#0066cc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          {isViewerOpen ? 'Viewer Open' : 'Open Viewer'}
        </button>
      </div>
      <FloatingPanel
        title="Objects & Layers"
        position={panelPosition}
        size={panelSize}
        onPositionChange={setPanelPosition}
        onSizeChange={setPanelSize}
      >
        <LayersPanel
          layers={sceneLayers}
          onAddScreen={addScreenCaptureLayer}
          onAddCamera={addCameraLayer}
          onAddText={addTextLayer}
          onAddImage={addImageLayer}
          onAddShape={addShapeLayer}
        />
      </FloatingPanel>
      {canvasLayout && currentScene && selectedLayer && !selectedLayer.locked && selectedLayer.type !== 'camera' && selectedLayer.type !== 'screen' && (
        <TransformControls layout={canvasLayout} layer={selectedLayer} scene={currentScene} />
      )}
      {canvasLayout && currentScene && selectedLayer?.type === 'camera' && !selectedLayer.locked && (
        <CameraOverlayControls
          layout={canvasLayout}
          layer={selectedLayer as CameraLayer}
          sceneWidth={currentScene.width}
          sceneHeight={currentScene.height}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
      />
    </div>
  );
}
