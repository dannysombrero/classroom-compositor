/**
 * PresenterPage component - main editing interface with canvas and overlay panel.
 * Mounts the PresenterCanvas and provides space for the overlay panel with
 * visibility toggles and layer controls.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { activateJoinCode } from "../utils/joinCodes";
import { startHost, type HostHandle } from "../utils/webrtc";
import {
  startPhoneCameraHost,
  stopPhoneCameraHost,
  setPhoneCameraStreamCallback,
  setPhoneCameraDisconnectCallback,
} from "../utils/phoneCameraWebRTC";


import { PresenterCanvas, type CanvasLayout } from "../components/PresenterCanvas";
import {
  captureCanvasStream,
  sendStreamToViewer,
  notifyStreamEnded,
  setCurrentStream,
  stopCurrentStream,
  DEFAULT_STREAM_FPS,
  requestCurrentStreamFrame,
  type ViewerMessage,
} from "../utils/viewerStream";
import { useAppStore } from "../app/store";
import { loadMostRecentScene } from "../app/persistence";
import { createId } from "../utils/id";
import {
  createScreenLayer,
  createCameraLayer,
  createTextLayer,
  createImageLayer,
  createShapeLayer,
  createChatLayer,
} from "../layers/factory";
import {
  startScreenCapture,
  startCameraCapture,
  stopSource,
  replaceVideoTrack,
  getActiveVideoTrack,
  registerPhoneCameraSource,
} from "../media/sourceManager";
import { FloatingPanel } from "../components/FloatingPanel";
import { LayersPanel } from "../components/LayersPanel";
import { TransformControls } from "../components/TransformControls";
import type { Layer, CameraLayer, ScreenLayer, TextLayer, ChatLayer, Scene } from "../types/scene";
import { CameraOverlayControls } from "../components/CameraOverlayControls";
import { TextEditOverlay } from "../components/TextEditOverlay";
import { ControlStrip } from "../components/ControlStrip";
import { ConfidencePreview } from "../components/ConfidencePreview";
import { PresentationOverlay } from "../components/PresentationOverlay";
import { CanvasSelectionOverlay } from "../components/CanvasSelectionOverlay";
import { GroupTransformControls } from "../components/GroupTransformControls";
import { tinykeys } from "tinykeys";
import type { KeyBindingMap } from "tinykeys";
import { useBackgroundEffectTrack } from "../hooks/useBackgroundEffectTrack";
import { replaceHostVideoTrack } from "../utils/webrtc";
import { LiveControlPanel } from "../components/LiveControlPanel";
import { detectMonitors, onScreenChange } from "../utils/monitorDetection";
import { MonitorDetectionToast } from "../components/MonitorDetectionToast";
import { MonitorDetectionTestPanel } from "../components/MonitorDetectionTestPanel";
import type { MonitorDetectionResult } from "../utils/monitorDetection";
import { ChatPanel, initializeChat, sendMessageAsCurrentUser, resumeAllBots } from "../ai";
import { ChatLayerOverlay } from "../components/ChatLayerOverlay";
import { BotControlPanel } from "../components/BotControlPanel";

// Set to true to show the monitor detection test panel (development tool)
const SHOW_MONITOR_TEST_PANEL = false; // Changed to false for cleaner UI
const SHOW_BOT_CONTROL_PANEL = true;
import { PhoneCameraModal } from "../components/PhoneCameraModal";

const EMPTY_LAYERS: Layer[] = [];
const LAYERS_PANEL_WIDTH = 280;
const LAYERS_PANEL_EXPANDED_HEIGHT = 760;
const LAYERS_PANEL_COLLAPSED_HEIGHT = 64;

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
 */
function PresenterPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerWindowRef = useRef<Window | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hostRef = useRef<{ stop: () => void } | null>(null);

  const [sessionId, setSessionId] = useState<string>("");

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isAddingScreen, setIsAddingScreen] = useState(false);
  const [isAddingCamera, setIsAddingCamera] = useState(false);
  const [isPhoneCameraModalOpen, setIsPhoneCameraModalOpen] = useState(false);
  const [phoneCameraId, setPhoneCameraId] = useState<string>("");
  const layerIdsRef = useRef<string[]>([]);
  const [panelPosition, setPanelPosition] = useState({ x: 24, y: 24 });
  const [isLayersPanelCollapsed, setLayersPanelCollapsed] = useState(false);
  const [canvasLayout, setCanvasLayout] = useState<CanvasLayout | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isConfidencePreviewVisible, setIsConfidencePreviewVisible] = useState(false);
  const [controlStripVisible, setControlStripVisible] = useState(true);
  const [isSceneLoading, setIsSceneLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const controlStripTimerRef = useRef<number | null>(null);
  const clipboardRef = useRef<Layer[] | null>(null);
  const [detectionToastResult, setDetectionToastResult] = useState<MonitorDetectionResult | null>(null);
  const chatUnsubscribeRef = useRef<(() => void) | null>(null);

  const [cameraTrackForEffects, setCameraTrackForEffects] = useState<MediaStreamTrack | null>(null);
  const [cameraLayerForEffects, setCameraLayerForEffects] = useState<string | null>(null);
  const processedCameraTrack = useBackgroundEffectTrack(cameraTrackForEffects);

  const sceneLayers: Layer[] = useAppStore((state) => {
    if (!state.currentSceneId) return EMPTY_LAYERS;
    const scene = state.scenes[state.currentSceneId];
    return scene ? scene.layers : EMPTY_LAYERS;
  });
  const currentScene = useAppStore((state) => {
    if (!state.currentSceneId) return null;
    return state.scenes[state.currentSceneId] ?? null;
  }) as Scene | null;

  const selectionIds = useAppStore((state) => state.selection);
  const selectedLayer = useAppStore((state) => {
    if (!state.currentSceneId || state.selection.length === 0) return null;
    const scene = state.scenes[state.currentSceneId];
    if (!scene) return null;
    const id = state.selection[0];
    return scene.layers.find((layer) => layer.id === id) ?? null;
  }) as Layer | null;

  const selectedCameraLayer =
    selectedLayer && selectedLayer.type === "camera" ? (selectedLayer as CameraLayer) : null;

  const compactPresenter = useAppStore((state) => state.compactPresenter);
  const streamingStatus = useAppStore((state) => state.streamingStatus);

  const selectionLength = selectionIds.length;
  const selectedGroup = selectedLayer && selectedLayer.type === "group" ? selectedLayer : null;
  const activeGroupChildIds = selectedGroup ? selectedGroup.children : [];
  const groupTransformIds =
    selectedGroup && activeGroupChildIds.length > 0
      ? activeGroupChildIds
      : selectionLength > 1
      ? selectionIds
      : [];

  const { getCurrentScene, createScene, saveScene, addLayer, removeLayer, updateLayer, undo, redo, setStreamingStatus, setCompactPresenter } = useAppStore();

  // Copy link UX
  const [copied, setCopied] = useState(false);
  const copyJoinInfo = useCallback(async () => {
    try {
      const code = useSessionStore.getState().joinCode;
      const url = code ? `${window.location.origin}/join?code=${code}` : "";
      if (!url) return;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.warn("Failed to copy join info", e);
    }
  }, []);

  // Basic session id seed
  useEffect(() => {
    if (!sessionId) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setSessionId(id);
    }
  }, [sessionId]);

  // Phone camera stream handler
  useEffect(() => {
    // Set up callback for when phone camera connects
    setPhoneCameraStreamCallback(async (cameraId: string, stream: MediaStream) => {
      console.log("📱 [PresenterPage] Phone camera connected:", cameraId);

      const scene = getCurrentScene();
      if (!scene) {
        console.warn("📱 [PresenterPage] No scene available for phone camera");
        return;
      }

      // Find existing layer with matching phoneCameraId
      let layerId: string | null = null;
      for (const layer of scene.layers) {
        if ((layer as any).phoneCameraId === cameraId) {
          layerId = layer.id;
          console.log("📱 [PresenterPage] Found existing layer for phone camera:", layerId);
          break;
        }
      }

      // If no existing layer found, create one (fallback)
      if (!layerId) {
        console.log("📱 [PresenterPage] No existing layer found, creating new one");
        const newLayerId = createId("layer");
        const layer = createCameraLayer(newLayerId, scene.width, scene.height);
        layer.name = `Phone Camera (${cameraId.substring(0, 8)})`;
        (layer as any).phoneCameraId = cameraId;
        addLayer(layer);
        layerId = newLayerId;
      }

      // Register the stream with the layer
      const result = await registerPhoneCameraSource(layerId, stream);
      if (!result) {
        console.error("📱 [PresenterPage] Failed to register phone camera source");
        return;
      }

      // Update layer with stream ID
      const track = stream.getVideoTracks()[0];
      if (track) {
        updateLayer(layerId, { streamId: track.id });

        // Add track ended listener to handle disconnection (but don't remove layer)
        track.addEventListener("ended", () => {
          console.log("📱 [PresenterPage] Phone camera track ended:", layerId);
          stopSource(layerId!);
          // Don't remove layer - just clear the stream so placeholder shows again
          updateLayer(layerId!, { streamId: undefined });
        });

        console.log("✅ [PresenterPage] Phone camera stream attached to layer:", layerId);
      }

      requestCurrentStreamFrame();
    });

    // Set up disconnect callback
    setPhoneCameraDisconnectCallback((cameraId: string) => {
      console.log("📱 [PresenterPage] Phone camera disconnected:", cameraId);
      // Note: The layer will be cleaned up automatically via track ended event
    });

    return () => {
      // FIX: Clear callbacks before stopping host to prevent stale closures
      setPhoneCameraStreamCallback(() => {});
      setPhoneCameraDisconnectCallback(() => {});

      // Clean up phone camera host on unmount
      stopPhoneCameraHost();
    };
  }, [getCurrentScene, addLayer, removeLayer, updateLayer]);

  // Floating controls auto-hide
  const showControlStrip = useCallback(() => {
    setControlStripVisible(true);
    if (controlStripTimerRef.current !== null) {
      window.clearTimeout(controlStripTimerRef.current);
    }
    controlStripTimerRef.current = window.setTimeout(() => {
      setControlStripVisible(false);
    }, 4000);
  }, []);
  useEffect(() => {
    showControlStrip();
    const handlePointer = () => showControlStrip();
    window.addEventListener("pointermove", handlePointer);
    window.addEventListener("keydown", handlePointer);
    return () => {
      window.removeEventListener("pointermove", handlePointer);
      window.removeEventListener("keydown", handlePointer);
    };
  }, [showControlStrip]);
  useEffect(() => {
    return () => {
      if (controlStripTimerRef.current !== null) {
        window.clearTimeout(controlStripTimerRef.current);
      }
    };
  }, []);

  // Chat cleanup
  useEffect(() => {
    return () => {
      if (chatUnsubscribeRef.current) {
        chatUnsubscribeRef.current();
        console.log("💬 [Chat] Unsubscribed from chat messages");
      }
    };
  }, []);

  // Canvas ref
  const handleCanvasRef = (canvas: HTMLCanvasElement | null) => {
    if (canvas && canvasRef.current !== canvas) {
      canvasRef.current = canvas;
      if (isViewerOpen && viewerWindowRef.current) {
        startStreaming(canvas);
      }
    }
  };
  const handleCanvasLayoutChange = useCallback((layout: CanvasLayout) => setCanvasLayout(layout), []);

  useEffect(() => {
    if (!selectedLayer || selectedLayer.type !== "text") {
      if (editingTextId !== null) setEditingTextId(null);
      return;
    }
    if (editingTextId && editingTextId !== selectedLayer.id) {
      setEditingTextId(null);
    }
  }, [editingTextId, selectedLayer]);

  useEffect(() => {
    if (editingTextId) requestCurrentStreamFrame();
  }, [editingTextId]);

  // Add layers
  const addScreenCaptureLayer = useCallback(async () => {
    if (isAddingScreen) return;
    const scene = getCurrentScene();
    if (!scene) return;

    const layerId = createId("layer");
    const layer = createScreenLayer(layerId, scene.width, scene.height);

    setIsAddingScreen(true);
    addLayer(layer);
    useAppStore.getState().setSelection([layerId]);

    // Check if we should use delayed activation based on monitor count
    const shouldDelay = useAppStore.getState().shouldUseDelayedScreenShare();

    if (shouldDelay) {
      // 1-2 monitors: Add placeholder layer without activating screen share
      // Screen share will activate when "Go Live" is pressed (after compact controls appear)
      setIsAddingScreen(false);
      console.log("📺 [Screen Layer] Added placeholder - will activate on Go Live (1-2 monitor mode)");
    } else {
      // 3+ monitors: Activate screen share immediately
      try {
        const result = await startScreenCapture(layerId);
        if (!result) {
          removeLayer(layerId);
          setIsAddingScreen(false);
          return;
        }
        const track = result.stream.getVideoTracks()[0];
        if (track) {
          updateLayer(layerId, { streamId: track.id });
          track.addEventListener("ended", () => {
            stopSource(layerId);
            useAppStore.getState().removeLayer(layerId);
          });
          console.log("📺 [Screen Layer] Activated immediately (3+ monitor mode)");
        }
        requestCurrentStreamFrame();
      } catch (error) {
        console.error("❌ [Screen Layer] Failed to activate:", error);
        removeLayer(layerId);
      } finally {
        setIsAddingScreen(false);
      }
    }
  }, [addLayer, getCurrentScene, isAddingScreen, removeLayer, updateLayer]);

  const addCameraLayer = useCallback(async () => {
    if (isAddingCamera) return;
    const scene = getCurrentScene();
    if (!scene) return;

    const layerId = createId("layer");
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
        track.addEventListener("ended", () => {
          stopSource(layerId);
          useAppStore.getState().removeLayer(layerId);
          setCameraTrackForEffects(null);
          setCameraLayerForEffects(null);
        });
        setCameraTrackForEffects(track);
        setCameraLayerForEffects(layerId);
      }
      requestCurrentStreamFrame();
    } finally {
      setIsAddingCamera(false);
    }
  }, [addLayer, getCurrentScene, isAddingCamera, removeLayer, updateLayer]);

  useEffect(() => {
    if (!selectedCameraLayer) return;
    const track = getActiveVideoTrack(selectedCameraLayer.id);
    if (!track) return;
    setCameraLayerForEffects(selectedCameraLayer.id);
    setCameraTrackForEffects((prev) => (prev?.id === track.id ? prev : track));
  }, [selectedCameraLayer]);

  // Swap processed track into layer when ready
  useEffect(() => {
    if (!processedCameraTrack || !cameraLayerForEffects) return;
    try {
      const ok = replaceVideoTrack(cameraLayerForEffects, processedCameraTrack);
      console.log("Effects: replaceVideoTrack", {
        layerId: cameraLayerForEffects,
        ok,
        rawId: cameraTrackForEffects?.id,
        processedId: processedCameraTrack.id,
      });
      updateLayer(
        cameraLayerForEffects,
        { streamId: processedCameraTrack.id },
        { recordHistory: false }
      );
      requestCurrentStreamFrame();
    } catch (e) {
      console.warn("Effects: failed to replace track", e);
    }
    const onEnded = () => {
      if (cameraLayerForEffects) {
        console.log("Effects: processed track ended for layer", cameraLayerForEffects);
      }
    };
    (processedCameraTrack as any).addEventListener?.("ended", onEnded);
    return () => {
      (processedCameraTrack as any).removeEventListener?.("ended", onEnded);
    };
  }, [processedCameraTrack, cameraLayerForEffects, cameraTrackForEffects, updateLayer]);

  const addTextLayer = useCallback(() => {
    const scene = getCurrentScene();
    if (!scene) return;
    const layerId = createId("layer");
    const layer = createTextLayer(layerId, scene.width, scene.height);
    addLayer(layer);
    useAppStore.getState().setSelection([layerId]);
    requestCurrentStreamFrame();
  }, [addLayer, getCurrentScene]);

  const addShapeLayer = useCallback(() => {
    const scene = getCurrentScene();
    if (!scene) return;
    const layerId = createId("layer");
    const layer = createShapeLayer(layerId, scene.width, scene.height);
    addLayer(layer);
    useAppStore.getState().setSelection([layerId]);
    requestCurrentStreamFrame();
  }, [addLayer, getCurrentScene]);

  const addChatLayer = useCallback(() => {
    const scene = getCurrentScene();
    if (!scene) return;
    const layerId = createId("layer");
    const layer = createChatLayer(layerId, scene.width, scene.height);
    addLayer(layer);
    useAppStore.getState().setSelection([layerId]);
    requestCurrentStreamFrame();
    console.log("💬 [Chat Layer] Added to canvas");
  }, [addLayer, getCurrentScene]);

  const addPhoneCameraLayer = useCallback(() => {
    const scene = getCurrentScene();
    if (!scene) return;

    // Create the phone camera layer immediately (placeholder shows until session starts)
    const layerId = createId("layer");
    const layer = createCameraLayer(layerId, scene.width, scene.height);

    // Mark as phone camera but don't assign cameraId yet - that happens in Start Session
    layer.name = `Phone Camera`;
    (layer as any).isPhoneCamera = true;
    (layer as any).phoneCameraId = null; // Will be assigned when Start Session is clicked

    addLayer(layer);
    useAppStore.getState().setSelection([layerId]);
    requestCurrentStreamFrame();

    console.log("📱 [Phone Camera] Layer created (pending activation):", layerId);
  }, [getCurrentScene, addLayer]);

  const addImageLayer = useCallback(() => {
    const scene = getCurrentScene();
    if (!scene) return;
    const input = fileInputRef.current;
    if (!input) return;

    const handleChange = async (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0] ?? null;
      target.value = "";
      if (!file) return;

      try {
        const dataUri = await readFileAsDataURL(file);
        const image = await loadImage(dataUri);
        const layerId = createId("layer");
        const naturalWidth = image.naturalWidth || 640;
        const naturalHeight = image.naturalHeight || 360;
        const layer = createImageLayer(layerId, scene.width, scene.height, {
          width: naturalWidth,
          height: naturalHeight,
          dataUri,
        });
        layer.name = file.name ? file.name.replace(/\.[^/.]+$/, "") || "Image" : "Image";

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
        console.error("Presenter: Failed to load image layer", error);
      }
    };

    input.addEventListener("change", handleChange, { once: true });
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

  /**
   * Ensures a canvas stream exists, creating one if needed or reusing existing live stream.
   * This prevents multiple stream creations that would break active viewers.
   */
  const ensureCanvasStreamExists = useCallback((): MediaStream | null => {
    // Check if we already have a live stream - REUSE IT!
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track && track.readyState === 'live') {
        console.log("✅ [STREAM-1] Reusing existing live canvas stream", { streamId: streamRef.current.id, trackId: track.id });
        return streamRef.current;
      }
      // Stream is dead, clean it up
      console.log("⚠️ [STREAM-2] Existing stream is dead, cleaning up", { streamId: streamRef.current.id });
      streamRef.current.getTracks().forEach((t) => {
        console.log("🗑️ [STREAM-2a] Stopping track:", t.id);
        t.stop();
      });
      streamRef.current = null;
      setCurrentStream(null);
    }

    // Need to create new stream
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn("❌ [STREAM-3] Cannot create stream without canvas");
      return null;
    }

    const stream = captureCanvasStream(canvas, { fps: DEFAULT_STREAM_FPS });
    if (!stream) {
      console.error("❌ [STREAM-4] Failed to capture canvas stream");
      return null;
    }

    const track = stream.getVideoTracks()[0];
    console.log("🎬 [STREAM-5] Created NEW canvas stream", {
      streamId: stream.id,
      trackId: track?.id,
      trackType: track?.constructor?.name
    });
    streamRef.current = stream;
    setCurrentStream(stream);

    // Set up ended handler ONCE when stream is created
    if (track) {
      const handleEnded = () => {
        console.log("🛑 [STREAM-6] Canvas track ended", { trackId: track.id });
        if (viewerWindowRef.current && !viewerWindowRef.current.closed) {
          notifyStreamEnded(viewerWindowRef.current);
        }
        streamRef.current = null;
        setCurrentStream(null);
        setIsPresentationMode(false);
        setIsConfidencePreviewVisible(false);
        setControlStripVisible(true);
        showControlStrip();
      };
      track.addEventListener("ended", handleEnded, { once: true });
    }

    return stream;
  }, [showControlStrip]);

  const startStreaming = useCallback((canvas: HTMLCanvasElement) => {
    // Get or create the stream (will reuse if already live!)
    const stream = ensureCanvasStreamExists();
    if (!stream) return;

    const track = stream.getVideoTracks()[0];
    if (track) {
      console.log("📹 [startStreaming] Stream track settings", track.getSettings());
      try {
        replaceHostVideoTrack(track);
        console.log("✅ [startStreaming] Canvas track sent to WebRTC");
      } catch (err) {
        console.warn("⚠️ [startStreaming] replaceHostVideoTrack failed", err);
      }
    }

    // Send to local viewer window if open
    if (viewerWindowRef.current && !viewerWindowRef.current.closed) {
      console.log("📤 [startStreaming] Sending stream to viewer window");
      sendStreamToViewer(viewerWindowRef.current, stream);
    }
  }, [ensureCanvasStreamExists]);

  const openViewer = () => {
    console.log("📺 [VIEWER-1] openViewer called", { hasExisting: !!viewerWindowRef.current });
    if (viewerWindowRef.current && !viewerWindowRef.current.closed) {
      console.log("📺 [VIEWER-1a] Reusing existing viewer window");
      viewerWindowRef.current.focus();
      ensureCanvasStream();
      showControlStrip();
      return;
    }
    console.log("📺 [VIEWER-2] Opening new viewer window");
    const viewer = window.open("/viewer", "classroom-compositor-viewer", "width=1920,height=1080");
    if (!viewer) {
      console.error("Failed to open viewer window (popup blocked?)");
      return;
    }
    viewerWindowRef.current = viewer;
    setIsViewerOpen(true);
    showControlStrip();

    viewer.addEventListener("load", () => {
      console.log("📺 [VIEWER-3] Viewer window loaded, starting stream");
      if (canvasRef.current) startStreaming(canvasRef.current);
    });
    const checkClosed = setInterval(() => {
      if (viewer.closed) {
        console.log("📺 [VIEWER-4] Viewer window closed, cleaning up");
        clearInterval(checkClosed);
        setIsViewerOpen(false);
        viewerWindowRef.current = null;
        // DON'T stop the stream if we're still live streaming to remote viewers!
        // Only stop if we're not hosting
        if (streamRef.current && !hostRef.current) {
          console.log("🛑 [VIEWER-5] Stopping stream (not live)", {
            streamId: streamRef.current.id,
            tracks: streamRef.current.getTracks().map(t => ({ id: t.id, type: t.constructor.name }))
          });
          streamRef.current.getTracks().forEach((track) => {
            console.log("🗑️ [VIEWER-5a] Stopping track:", track.id);
            track.stop();
          });
          streamRef.current = null;
          setCurrentStream(null);
        } else if (streamRef.current && hostRef.current) {
          console.log("✅ [VIEWER-6] Keeping stream alive (still live to remote viewers)");
        } else {
          console.log("📺 [VIEWER-7] No stream to cleanup");
        }
      }
    }, 500);
    setTimeout(() => {
      console.log("📺 [VIEWER-8] Timeout: ensuring stream started");
      if (canvasRef.current && !viewer.closed) startStreaming(canvasRef.current);
    }, 100);
  };

  // Messages from viewer
  useEffect(() => {
    const handleMessage = (event: MessageEvent<ViewerMessage | { type: "request-stream" }>) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "request-stream") {
        if (streamRef.current) {
          sendStreamToViewer(viewerWindowRef.current!, streamRef.current);
        } else if (canvasRef.current) {
          startStreaming(canvasRef.current);
        }
      } else if (event.data?.type === "viewer-ready") {
        if (streamRef.current) {
          // viewer will access opener.currentStream
        } else if (canvasRef.current) {
          startStreaming(canvasRef.current);
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [startStreaming]);

  const ensureCanvasStream = useCallback((): MediaStream | null => {
    // Just delegate to the main helper function
    return ensureCanvasStreamExists();
  }, [ensureCanvasStreamExists]);

  const isTextInputTarget = (event: KeyboardEvent): boolean => {
    const target = event.target as HTMLElement | null;
    if (!target) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return true;
    return Boolean(editingTextId);
  };

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

  const togglePresentationMode = useCallback(() => {
    if (!isPresentationMode) {
      const stream = ensureCanvasStream();
      if (!stream) {
        console.warn("Presenter: Cannot enter presentation mode without a stream");
        return;
      }
    }
    setIsPresentationMode((prev) => !prev);
    showControlStrip();
  }, [ensureCanvasStream, isPresentationMode, showControlStrip]);

  const exitPresentationMode = useCallback(() => {
    if (isPresentationMode) {
      setIsPresentationMode(false);
      showControlStrip();
    }
  }, [isPresentationMode, showControlStrip]);

  const toggleConfidencePreview = useCallback(() => {
    if (!isConfidencePreviewVisible) {
      const stream = ensureCanvasStream();
      if (!stream) {
        console.warn("Presenter: Cannot show confidence preview without a stream");
        return;
      }
    }
    setIsConfidencePreviewVisible((prev) => !prev);
    showControlStrip();
  }, [ensureCanvasStream, isConfidencePreviewVisible, showControlStrip]);

  useEffect(() => {
    const hotkeys: KeyBindingMap = {
      f: (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); togglePresentationMode(); },
      Escape: (e: KeyboardEvent) => { if (!isPresentationMode) return; e.preventDefault(); exitPresentationMode(); },
      p: (e: KeyboardEvent) => { if (isTextInputTarget(e)) return; e.preventDefault(); toggleConfidencePreview(); },
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
    exitPresentationMode,
    isPresentationMode,
    nudgeSelection,
    pasteClipboardLayers,
    toggleConfidencePreview,
    toggleLockForSelection,
    togglePresentationMode,
    toggleVisibilityForSelection,
    undo,
    redo,
  ]);

  const isEditingSelectedText = selectedLayer?.type === "text" && editingTextId === selectedLayer.id;
  const controlStripShouldBeVisible = isPresentationMode ? true : controlStripVisible;

  // Initialize / load scene
  useEffect(() => {
    const initializeScene = async () => {
      const current = getCurrentScene();
      if (current) {
        setIsSceneLoading(false);
        return;
      }
      try {
        const mostRecent = await loadMostRecentScene();
        if (mostRecent && mostRecent.id) {
          useAppStore.setState((state) => ({
            scenes: { ...state.scenes, [mostRecent.id!]: mostRecent },
            currentSceneId: mostRecent.id,
          }));
        } else {
          createScene();
        }
      } catch (error) {
        console.error("Failed to load most recent scene", error);
        createScene();
      } finally {
        setIsSceneLoading(false);
      }
    };
    initializeScene();
  }, [getCurrentScene, createScene]);

  // Auto-save
  useEffect(() => {
    const current = getCurrentScene();
    if (!current || !current.id) return;
    const saveInterval = setInterval(() => saveScene(), 30000);
    return () => {
      clearInterval(saveInterval);
      saveScene();
    };
  }, [getCurrentScene, saveScene]);

  // Cleanup
  useEffect(() => {
    return () => {
      // Stop all stream tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      // Clear global stream reference
      stopCurrentStream();
      // Stop all layer sources
      layerIdsRef.current.forEach((id) => stopSource(id));
      // Close viewer window
      if (viewerWindowRef.current && !viewerWindowRef.current.closed) viewerWindowRef.current.close();
      // Clear camera track for effects (will trigger useBackgroundEffectTrack cleanup)
      setCameraTrackForEffects(null);
      setCameraLayerForEffects(null);
    };
  }, []);

  // === Go Live ===
  const HOST_ID = "host-123";

  const hostingRef = useRef(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  // pull the actions/state from the zustand store
  const { goLive, joinCode, isJoinCodeActive, session } = useSessionStore();

  /**
   * Detect monitors and update store with results.
   * Called when user starts a session (requires user gesture for permission).
   */
  const detectAndUpdateMonitors = useCallback(async () => {
    const result = await detectMonitors();
    if (result) {
      useAppStore.getState().updateMonitorDetection(result);
      console.log("🖥️ [Monitor Detection] Detected", result.screenCount, "screen(s)");
      console.log("🖥️ [Monitor Detection] Mode:", result.supported ? "Window Management API" : "Fallback");
      if (result.screens.length > 0) {
        result.screens.forEach((screen, idx) => {
          console.log(`  Screen ${idx + 1}: ${screen.label} (${screen.width}x${screen.height})`);
        });
      }

      // Show toast notification with detection results
      setDetectionToastResult(result);
    }
  }, []);

  /**
   * Activate pending screen share layers (those without streamId).
   * Called after compact controls appear to prevent feedback loop.
   */
  const activatePendingScreenShares = useCallback(async () => {
    const scene = getCurrentScene();
    if (!scene) {
      console.log("📺 [Screen Share] No current scene");
      return;
    }

    console.log("📺 [Screen Share] Checking for pending screen shares in scene:", scene);
    console.log("📺 [Screen Share] Total layers:", scene.layers.length);

    // Debug: log all layers with their types and streamId status
    scene.layers.forEach((layer, idx) => {
      console.log(`📺 [Screen Share] Layer ${idx}:`, {
        id: layer.id,
        type: layer.type,
        name: layer.name,
        streamId: (layer as any).streamId,
      });
    });

    // Find all screen layers without streamId (pending activation)
    const pendingScreenLayers = scene.layers.filter(
      (layer): layer is ScreenLayer => layer.type === 'screen' && !layer.streamId
    );

    console.log("📺 [Screen Share] Found pending layers:", pendingScreenLayers);

    if (pendingScreenLayers.length === 0) {
      console.log("📺 [Screen Share] No pending screen shares to activate");
      return;
    }

    console.log(`📺 [Screen Share] Activating ${pendingScreenLayers.length} pending screen share(s)...`);

    // Activate each pending screen share
    for (const layer of pendingScreenLayers) {
      console.log(`📺 [Screen Share] Calling startScreenCapture for layer ${layer.id}...`);
      try {
        const result = await startScreenCapture(layer.id);
        console.log(`📺 [Screen Share] startScreenCapture returned:`, result);

        if (!result) {
          console.warn(`⚠️ [Screen Share] User cancelled screen share for layer ${layer.id}`);
          // Don't remove the layer - let them try again later
          continue;
        }

        const track = result.stream.getVideoTracks()[0];
        if (track) {
          updateLayer(layer.id, { streamId: track.id }, { recordHistory: false });
          track.addEventListener("ended", () => {
            stopSource(layer.id);
            // Reset to pending state instead of removing
            updateLayer(layer.id, { streamId: undefined }, { recordHistory: false });
            console.log(`📺 [Screen Share] Track ended for layer ${layer.id} - reset to pending`);
          });
          console.log(`✅ [Screen Share] Activated screen share for layer ${layer.id}`);
        }
      } catch (error) {
        console.error(`❌ [Screen Share] Failed to activate layer ${layer.id}:`, error);
      }
    }

    requestCurrentStreamFrame();
  }, [getCurrentScene, updateLayer]);

  const handleGoLive = useCallback(async () => {
    if (hostingRef.current) return; // de-dupe rapid clicks
    setLiveError(null);
    setStreamingStatus('connecting');

    try {
      // 1) Ensure a session exists in Firestore (should already exist from Start Session)
      await goLive(HOST_ID);
      const s = useSessionStore.getState().session;
      if (!s?.id) {
        setStreamingStatus('error');
        setLiveError("Couldn't create a session. Check Firestore rules/connection.");
        return;
      }

      // 3) Get or create canvas stream (will reuse if already exists!)
      const displayStream = ensureCanvasStreamExists() || undefined;

      // 4) Attach the track to WebRTC BEFORE creating the offer
      if (displayStream) {
        const track = displayStream.getVideoTracks()[0];
        if (track) {
          try {
            // Request an initial frame to ensure track has data before viewers join
            if ('requestFrame' in track && typeof (track as any).requestFrame === 'function') {
              try {
                (track as any).requestFrame();
                console.log("🎬 [handleGoLive] Requested initial frame from canvas track");
              } catch (err) {
                console.warn("⚠️ [handleGoLive] requestFrame failed", err);
              }
            }

            replaceHostVideoTrack(track);
            console.log("📹 [handleGoLive] Canvas track pre-attached to sender", {
              trackId: track.id,
              readyState: track.readyState,
            });
          } catch (err) {
            console.warn("⚠️ [handleGoLive] replaceHostVideoTrack failed pre-offer", err);
          }
        }
        console.log("✅ [handleGoLive] Canvas stream ready for WebRTC");
      }

      // 5) Start WebRTC host with the canvas stream
      hostingRef.current = true;
      hostRef.current = await startHost(s.id, {
        displayStream,
        requireDisplay: false,   // do NOT prompt; we'll capture only from the ScreenShare control
        sendAudio: false,        // optional: change to true if you want mic on at Go Live
        loadingText: "Waiting for presenter…",
      });
      console.log("✅ [handleGoLive] WebRTC host started");

      // 6) Activate join code and reflect it in UI
      // Note: Phone camera host is already started in handleStartSession
      const { codePretty } = await activateJoinCode(s.id);
      useSessionStore.setState({ joinCode: codePretty, isJoinCodeActive: true });

      // 7) Update UI state to show compact control panel
      setStreamingStatus('live');
      setCompactPresenter(true);
      console.log("✅ [handleGoLive] Now live with compact presenter mode");

      // 8) Activate pending screen shares AFTER compact controls appear (prevents feedback loop)
      await activatePendingScreenShares();

    } catch (e: any) {
      console.error("❌ [handleGoLive] Failed to start:", e);
      setStreamingStatus('error');
      setLiveError(
        e?.name === "NotAllowedError"
          ? 'Go Live was blocked by the browser. Click again and press "Allow".'
          : 'Go Live failed. If your browser is still sharing, click its "Stop sharing", then try again.'
      );
    } finally {
      hostingRef.current = false;
    }
  }, [goLive, ensureCanvasStreamExists, setStreamingStatus, setCompactPresenter, activatePendingScreenShares]);

  const handleResumeStream = useCallback(() => {
    // Resume: go back to compact mode, stream continues
    setStreamingStatus('live');
    setCompactPresenter(true);

    // Resume all paused bots with grace period + randomized buffer
    resumeAllBots();

    console.log("▶️ Stream resumed - showing compact controls");
  }, [setStreamingStatus, setCompactPresenter]);

  const handleStartSession = useCallback(async () => {
    console.log("🎬 [START SESSION] Creating room and preparing session...");

    try {
      // 1) Detect monitors (requires user gesture, so do it here when user clicks button)
      await detectAndUpdateMonitors();

      // 2) Create Firestore session and activate join code
      await goLive(HOST_ID);
      const s = useSessionStore.getState().session;
      if (!s?.id) {
        console.error("❌ [START SESSION] Couldn't create a session");
        return;
      }

      const { codePretty } = await activateJoinCode(s.id);
      useSessionStore.setState({ joinCode: codePretty, isJoinCodeActive: true });
      console.log("✅ [START SESSION] Session created with join code:", codePretty);

      // 3) Start phone camera host to listen for phone connections
      await startPhoneCameraHost(s.id);
      console.log("✅ [START SESSION] Phone camera host started");

      // 3.5) Activate any pending phone camera layers by assigning cameraIds
      const currentScene = getCurrentScene();
      if (currentScene) {
        let phoneCameraCount = 0;
        for (const layer of currentScene.layers) {
          if ((layer as any).isPhoneCamera && !(layer as any).phoneCameraId) {
            const newCameraId = crypto.randomUUID?.() || `camera_${Date.now()}_${phoneCameraCount}`;
            (layer as any).phoneCameraId = newCameraId;
            updateLayer(layer.id, { name: `Phone Camera (${newCameraId.substring(0, 8)})` });
            console.log("📱 [START SESSION] Activated phone camera layer:", layer.id, "cameraId:", newCameraId);
            phoneCameraCount++;

            // Store the last cameraId for the modal (if user wants to see QR code)
            setPhoneCameraId(newCameraId);
          }
        }
        if (phoneCameraCount > 0) {
          console.log(`✅ [START SESSION] Activated ${phoneCameraCount} phone camera(s)`);
          // Open modal to show QR code for the last phone camera
          setIsPhoneCameraModalOpen(true);
        }
      }

      // 4) Open viewer window for local preview (if not already open)
      openViewer();
      console.log("✅ [START SESSION] Viewer window opened");

      // 4) Initialize chat for this session
      setSessionId(s.id);
      if (chatUnsubscribeRef.current) {
        chatUnsubscribeRef.current();
      }
      chatUnsubscribeRef.current = initializeChat(s.id, HOST_ID, 'Teacher', 'teacher');
      console.log("✅ [START SESSION] Chat initialized");

      console.log("✅ [START SESSION] Ready to start streaming");

    } catch (error) {
      console.error("❌ [START SESSION] Failed to create session:", error);
    }
  }, [detectAndUpdateMonitors, goLive]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        backgroundColor: "#1a1a1a",
        position: "relative",
      }}
    >
      {/* Floating live pill at top-center - only shown in Console View */}
      {compactPresenter && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10001,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(20,20,20,0.85)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "6px 10px",
            color: "#eaeaea",
            fontSize: 12,
            boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
            backdropFilter: "blur(4px)",
          }}
        >
        {streamingStatus === 'paused' ? (
          <>
            <span
              style={{
                display: "inline-flex",
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#f59e0b",
                boxShadow: "0 0 0 6px rgba(245,158,11,0.2)",
                marginRight: 2,
              }}
              title="Paused"
            />
            <span style={{ opacity: 0.85, marginRight: 6 }}>PAUSED</span>
            <button
              onClick={handleResumeStream}
              style={{
                marginLeft: 8,
                background: "#10b981",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "4px 12px",
                cursor: "pointer",
                fontWeight: 700,
              }}
              title="Resume streaming"
            >
              Resume Stream
            </button>
          </>
        ) : !isJoinCodeActive ? (
          <button
            onClick={handleGoLive}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#e11d48",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
              fontWeight: 700,
            }}
            title="Start a live session and generate a join code"
          >
            <span
              style={{
                display: "inline-flex",
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "white",
              }}
            />
            Go Live
          </button>
        ) : (
          <>
            <span
              style={{
                display: "inline-flex",
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#ef4444",
                boxShadow: "0 0 0 6px rgba(239,68,68,0.2)",
                marginRight: 2,
              }}
              title="Live"
            />
            <span style={{ opacity: 0.85, marginRight: 6 }}>Live</span>
            <code
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontWeight: 700,
              }}
              title="Join code"
            >
              {joinCode ?? "— — —"}
            </code>

            <button
              onClick={copyJoinInfo}
              style={{
                marginLeft: 8,
                background: "transparent",
                color: "#eaeaea",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 6,
                padding: "4px 8px",
                cursor: "pointer",
              }}
              title="Copy /join link"
            >
              Copy link
            </button>

            {copied && (
              <span
                style={{
                  marginLeft: 8,
                  padding: "2px 6px",
                  borderRadius: 6,
                  background: "rgba(34,197,94,0.15)",
                  border: "1px solid rgba(34,197,94,0.35)",
                  color: "#86efac",
                  fontSize: 11,
                }}
              >
                Copied!
              </span>
            )}

            {liveError && (
              <span
                style={{
                  marginLeft: 8,
                  padding: "2px 6px",
                  borderRadius: 6,
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.35)",
                  color: "#fecaca",
                  fontSize: 11,
                }}
              >
                {liveError}
              </span>
            )}
          </>
        )}
        </div>
      )}

      {/* Top toolbar with buttons */}
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 10001,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* PREVIEW button - opens viewer window */}
        {!compactPresenter && (
          <button
            onClick={openViewer}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(59, 130, 246, 0.2)",
              color: "#60a5fa",
              border: "1px solid rgba(59, 130, 246, 0.4)",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
              fontWeight: 600,
              marginLeft: 12,
            }}
            title="Open viewer window for preview"
          >
            👁️ Preview
          </button>
        )}

        {/* START SESSION / GO LIVE / RESUME button */}
        {!compactPresenter && (
          <button
            onClick={
              streamingStatus === 'paused'
                ? handleResumeStream
                : isJoinCodeActive
                  ? handleGoLive
                  : handleStartSession
            }
            disabled={streamingStatus === 'connecting'}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background:
                streamingStatus === 'paused'
                  ? "#10b981"
                  : isJoinCodeActive
                    ? "#10b981"
                    : "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: streamingStatus === 'connecting' ? "wait" : "pointer",
              fontWeight: 700,
              marginLeft: 8,
              opacity: streamingStatus === 'connecting' ? 0.6 : 1,
            }}
            title={
              streamingStatus === 'paused'
                ? "Resume streaming"
                : isJoinCodeActive
                  ? "Start streaming to viewers"
                  : "Create room and generate join code"
            }
          >
            {streamingStatus === 'connecting'
              ? '⏳ Connecting...'
              : streamingStatus === 'paused'
                ? '▶️ Resume Stream'
                : isJoinCodeActive
                  ? '🔴 Go Live'
                  : '▶️ Start Session'}
          </button>
        )}

        {/* TEST: Manual monitor detection button (dev mode only) */}
        {SHOW_MONITOR_TEST_PANEL && !compactPresenter && (
          <button
            onClick={detectAndUpdateMonitors}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(147, 51, 234, 0.2)",
              color: "#c084fc",
              border: "1px solid rgba(147, 51, 234, 0.4)",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
              fontWeight: 600,
              marginLeft: 8,
              fontSize: 11,
            }}
            title="Test monitor detection"
          >
            🖥️ Test Detection
          </button>
        )}

        {/* 👇 New: inline error feedback */}
      </div>

      {/* Main canvas area - hidden when in Console View but still renders for stream */}
      <div
        style={{
          flex: 1,
          display: compactPresenter ? "none" : "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <PresenterCanvas
          ref={handleCanvasRef}
          fitToContainer
          onLayoutChange={handleCanvasLayoutChange}
          skipLayerIds={editingTextId ? [editingTextId] : undefined}
        />
        {!compactPresenter && canvasLayout && (
          <CanvasSelectionOverlay
            layout={canvasLayout}
            scene={currentScene}
            skipLayerIds={editingTextId ? [editingTextId] : undefined}
          />
        )}
        {!compactPresenter && canvasLayout && currentScene && groupTransformIds.length > 0 && (
          <GroupTransformControls layout={canvasLayout} scene={currentScene} layerIds={groupTransformIds} />
        )}
      </div>

      {isSceneLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(10, 10, 10, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 80,
            pointerEvents: "none",
            color: "#f5f5f5",
            fontSize: "14px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Loading your scene…
        </div>
      )}

      {!compactPresenter && (
        <FloatingPanel
          title="Objects & Layers"
          position={panelPosition}
          size={{
            width: LAYERS_PANEL_WIDTH,
            height: isLayersPanelCollapsed ? LAYERS_PANEL_COLLAPSED_HEIGHT : LAYERS_PANEL_EXPANDED_HEIGHT,
          }}
          onPositionChange={setPanelPosition}
        >
          <LayersPanel
            layers={sceneLayers}
            onAddScreen={addScreenCaptureLayer}
            onAddCamera={addCameraLayer}
            onAddText={addTextLayer}
            onAddImage={addImageLayer}
            onAddShape={addShapeLayer}
            onAddChat={addChatLayer}
            onAddPhoneCamera={addPhoneCameraLayer}
          />
        </FloatingPanel>
      )}

      <PhoneCameraModal
        isOpen={isPhoneCameraModalOpen}
        onClose={() => setIsPhoneCameraModalOpen(false)}
        sessionId={session?.id ?? ""}
        cameraId={phoneCameraId}
      />

      {/* Canvas editing overlays - only shown when not in Console View */}
      {!compactPresenter && canvasLayout &&
        currentScene &&
        selectedLayer &&
        selectionLength === 1 &&
        selectedLayer.type !== "group" &&
        !selectedLayer.locked &&
        selectedLayer.type !== "camera" &&
        selectedLayer.type !== "screen" &&
        !isEditingSelectedText && (
          <TransformControls
            layout={canvasLayout}
            layer={selectedLayer}
            scene={currentScene}
            onRequestEdit={selectedLayer.type === "text" ? () => setEditingTextId(selectedLayer.id) : undefined}
          />
        )}

      {!compactPresenter && canvasLayout &&
        currentScene &&
        selectedLayer?.type === "camera" &&
        selectionLength === 1 &&
        !selectedLayer.locked && (
          <CameraOverlayControls
            layout={canvasLayout}
            layer={selectedLayer as CameraLayer}
            sceneWidth={currentScene.width}
            sceneHeight={currentScene.height}
          />
        )}

      {!compactPresenter && canvasLayout &&
        currentScene &&
        selectedLayer?.type === "text" &&
        selectionLength === 1 &&
        !selectedLayer.locked &&
        isEditingSelectedText && (
          <TextEditOverlay
            layout={canvasLayout}
            layer={selectedLayer as TextLayer}
            onFinish={(cancelled) => {
              setEditingTextId(null);
              if (!cancelled) requestCurrentStreamFrame();
            }}
          />
        )}

      {/* Chat Layer Overlays */}
      {!compactPresenter && canvasLayout && currentScene && (
        <ChatLayerOverlay
          layers={currentScene.layers.filter((l) => l.type === 'chat')}
          canvasLayout={canvasLayout}
        />
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} />

      {!compactPresenter && (
        <ControlStrip
          visible={controlStripShouldBeVisible}
          onTogglePresentation={togglePresentationMode}
          presentationActive={isPresentationMode}
          onToggleConfidence={toggleConfidencePreview}
          confidenceActive={isConfidencePreviewVisible}
          onOpenViewer={openViewer}
          viewerOpen={isViewerOpen}
        />
      )}

      <ConfidencePreview
        stream={streamRef.current}
        visible={isConfidencePreviewVisible}
        onClose={() => {
          setIsConfidencePreviewVisible(false);
          showControlStrip();
        }}
      />

      <PresentationOverlay
        stream={streamRef.current}
        active={isPresentationMode}
        onExit={exitPresentationMode}
      />

      <LiveControlPanel />

      <MonitorDetectionToast
        result={detectionToastResult}
        onClose={() => setDetectionToastResult(null)}
      />

      {SHOW_MONITOR_TEST_PANEL && <MonitorDetectionTestPanel />}

      {SHOW_BOT_CONTROL_PANEL && <BotControlPanel />}

      {sessionId && (
        <ChatPanel
          sessionId={sessionId}
          onSendMessage={(text) => sendMessageAsCurrentUser(sessionId, text)}
        />
      )}
    </div>
  );
}

export default PresenterPage;
export { PresenterPage };