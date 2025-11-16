/**
 * PresenterPage component - main editing interface with canvas and overlay panel.
 * Mounts the PresenterCanvas and provides space for the overlay panel with
 * visibility toggles and layer controls.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { activateJoinCode } from "../utils/joinCodes";
import { startHost, type HostHandle } from "../utils/webrtc";


import { PresenterCanvas, type CanvasLayout } from "../components/PresenterCanvas";
import {
  captureCanvasStream,
  sendStreamToViewer,
  notifyStreamEnded,
  setCurrentStream,
  DEFAULT_STREAM_FPS,
  requestCurrentStreamFrame,
  type ViewerMessage,
} from "../utils/viewerStream";
import { addSessionMessageListener } from "../utils/sessionMessaging";
import { useAppStore } from "../app/store";
import { loadMostRecentScene } from "../app/persistence";
import { createId } from "../utils/id";
import { calculateOptimalSceneDimensions, calculateViewerWindowDimensions } from "../utils/sceneResolution";
import {
  createScreenLayer,
  createCameraLayer,
  createTextLayer,
  createImageLayer,
  createShapeLayer,
} from "../layers/factory";
import {
  startScreenCapture,
  startCameraCapture,
  stopSource,
  replaceVideoTrack,
  getActiveVideoTrack,
} from "../media/sourceManager";
import { FloatingPanel } from "../components/FloatingPanel";
import { LayersPanel } from "../components/LayersPanel";
import { TransformControls } from "../components/TransformControls";
import type { Layer, CameraLayer, TextLayer, Scene } from "../types/scene";
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

const EMPTY_LAYERS: Layer[] = [];
const LAYERS_PANEL_WIDTH = 280;
const LAYERS_PANEL_EXPANDED_HEIGHT = 760;
const LAYERS_PANEL_COLLAPSED_HEIGHT = 64;
type CanvasStreamConsumer = "viewer" | "presentation" | "host";

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
  const hostRef = useRef<HostHandle | null>(null);
  const viewerCheckIntervalRef = useRef<number | null>(null);

  const [sessionId, setSessionId] = useState<string>("");

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isAddingScreen, setIsAddingScreen] = useState(false);
  const [isAddingCamera, setIsAddingCamera] = useState(false);
  const layerIdsRef = useRef<string[]>([]);
  const [panelPosition, setPanelPosition] = useState({ x: 24, y: 24 });
  const [panelSize, setPanelSize] = useState({
    width: LAYERS_PANEL_WIDTH,
    height: LAYERS_PANEL_EXPANDED_HEIGHT
  });
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [canvasLayout, setCanvasLayout] = useState<CanvasLayout | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isConfidencePreviewVisible, setIsConfidencePreviewVisible] = useState(false);
  const [controlStripVisible, setControlStripVisible] = useState(true);
  const [isSceneLoading, setIsSceneLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const controlStripTimerRef = useRef<number | null>(null);
  const clipboardRef = useRef<Layer[] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [canvasBackgroundType, setCanvasBackgroundType] = useState<'color' | 'image'>('color');
  const [canvasBackgroundValue, setCanvasBackgroundValue] = useState<string>('#ffffff');

  const [cameraTrackForEffects, setCameraTrackForEffects] = useState<MediaStreamTrack | null>(null);
  const [cameraLayerForEffects, setCameraLayerForEffects] = useState<string | null>(null);
  const processedCameraTrack = useBackgroundEffectTrack(cameraTrackForEffects);

  const activeCanvasConsumersRef = useRef<Set<CanvasStreamConsumer>>(new Set());

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

  const selectionLength = selectionIds.length;
  const selectedGroup = selectedLayer && selectedLayer.type === "group" ? selectedLayer : null;

  // Recursively collect all descendants of a group (including nested groups' children)
  const getAllDescendants = useCallback((groupId: string, layers: Layer[]): string[] => {
    const group = layers.find((l) => l.id === groupId && l.type === 'group');
    if (!group || group.type !== 'group') return [];

    const result: string[] = [];
    for (const childId of group.children) {
      result.push(childId);
      const child = layers.find((l) => l.id === childId);
      if (child && child.type === 'group') {
        result.push(...getAllDescendants(childId, layers));
      }
    }
    return result;
  }, []);

  const activeGroupChildIds = selectedGroup && currentScene
    ? getAllDescendants(selectedGroup.id, currentScene.layers)
    : [];

  const groupTransformIds =
    selectedGroup && activeGroupChildIds.length > 0
      ? activeGroupChildIds
      : selectionLength > 1
      ? selectionIds
      : [];

  const { getCurrentScene, createScene, saveScene, addLayer, removeLayer, updateLayer, undo, redo } = useAppStore();

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

  // Cleanup viewer check interval on unmount
  useEffect(() => {
    return () => {
      if (viewerCheckIntervalRef.current !== null) {
        clearInterval(viewerCheckIntervalRef.current);
        viewerCheckIntervalRef.current = null;
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
        track.addEventListener("ended", () => {
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
    console.log("🔍 [ensureStream] Checking for existing stream...", {
      hasRef: !!streamRef.current,
      trackCount: streamRef.current?.getTracks().length ?? 0,
      trackState: streamRef.current?.getVideoTracks()[0]?.readyState ?? 'none'
    });

    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track && track.readyState === 'live') {
        console.log("✅ [ensureStream] Reusing existing live canvas stream");

        // Request a frame to ensure viewer gets immediate content (not black screen)
        if (typeof (track as any).requestFrame === 'function') {
          try {
            (track as any).requestFrame();
            console.log("✅ [ensureStream] Requested frame on reused stream");
          } catch (error) {
            console.warn("⚠️ [ensureStream] Failed to request frame on reuse:", error);
          }
        }

        return streamRef.current;
      }
      // Stream is dead, clean it up aggressively
      console.log("⚠️ [ensureStream] Existing stream is dead, cleaning up", {
        hasTrack: !!track,
        readyState: track?.readyState
      });
      const deadStream = streamRef.current;
      const deadTracks = deadStream.getTracks();
      deadTracks.forEach((t) => {
        try {
          t.stop();
          deadStream.removeTrack(t);
          // @ts-ignore - Disable track to help GC
          t.enabled = false;
        } catch (err) {
          console.warn("Failed to cleanup dead track", err);
        }
      });
      streamRef.current = null;
      setCurrentStream(null);
    } else {
      console.log("⚠️ [ensureStream] No existing stream ref");
    }

    // Need to create new stream
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn("❌ [ensureStream] Cannot create stream without canvas");
      return null;
    }

    const stream = captureCanvasStream(canvas, { fps: DEFAULT_STREAM_FPS });
    if (!stream) {
      console.error("❌ [ensureStream] Failed to capture canvas stream");
      return null;
    }

    console.log("🎬 [ensureStream] Created NEW canvas stream with", stream.getVideoTracks().length, "tracks");
    streamRef.current = stream;
    setCurrentStream(stream);

    // Set up ended handler ONCE when stream is created
    const track = stream.getVideoTracks()[0];

    // Request initial frame to kickstart the stream
    if (track && typeof (track as any).requestFrame === 'function') {
      try {
        (track as any).requestFrame();
        console.log("✅ [ensureStream] Requested initial frame to kickstart stream");
      } catch (error) {
        console.warn("⚠️ [ensureStream] Failed to request initial frame:", error);
      }
    }
    if (track) {
      const handleEnded = () => {
        console.log("🛑 [ensureStream] Canvas track ended");
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

  const stopCanvasStream = useCallback((reason?: string) => {
    if (!streamRef.current) return;
    const streamToClean = streamRef.current;
    console.log("🧹 [canvasStream] Stopping canvas stream", reason ?? "");

    const tracks = streamToClean.getTracks();
    tracks.forEach((track) => {
      try {
        track.stop();
      } catch (err) {
        console.warn("Failed to stop canvas track", err);
      }
      try {
        streamToClean.removeTrack(track);
      } catch (err) {
        console.warn("Failed to remove canvas track", err);
      }
      try {
        (track as any).enabled = false;
      } catch {
        // noop - best effort to help GC
      }
    });

    streamRef.current = null;
    setCurrentStream(null);
  }, []);

  const addCanvasConsumer = useCallback((consumer: CanvasStreamConsumer) => {
    const consumers = activeCanvasConsumersRef.current;
    if (consumers.has(consumer)) return;
    consumers.add(consumer);
    console.log("👥 [canvasStream] consumer added:", consumer, "→", Array.from(consumers));
  }, []);

  const removeCanvasConsumer = useCallback(
    (consumer: CanvasStreamConsumer, reason?: string) => {
      const consumers = activeCanvasConsumersRef.current;
      if (!consumers.has(consumer)) return;
      consumers.delete(consumer);
      console.log("👥 [canvasStream] consumer removed:", consumer, "→", Array.from(consumers));
      if (consumers.size === 0) {
        stopCanvasStream(reason);
      } else {
        console.log("♻️ [canvasStream] keeping stream for consumers:", Array.from(consumers));
      }
    },
    [stopCanvasStream],
  );


  const startStreaming = useCallback((canvas: HTMLCanvasElement) => {
    // Get or create the stream (will reuse if already live!)
    const stream = ensureCanvasStreamExists();
    if (!stream) {
      console.log("⚠️ [startStreaming] No stream available");
      return;
    }

    console.log("📡 [startStreaming] Starting stream delivery");

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

      // Force a frame update to ensure viewer gets initial content
      setTimeout(() => {
        requestCurrentStreamFrame();
        console.log("🎬 [startStreaming] Requested frame update for viewer");
      }, 50);
    }
  }, [ensureCanvasStreamExists]);

  const openViewer = () => {
    if (viewerWindowRef.current && !viewerWindowRef.current.closed) {
      viewerWindowRef.current.focus();
      ensureCanvasStream();
      showControlStrip();
      return;
    }

    // Clear any existing interval from previous viewer instances
    if (viewerCheckIntervalRef.current !== null) {
      clearInterval(viewerCheckIntervalRef.current);
      viewerCheckIntervalRef.current = null;
    }

    // Calculate viewer window dimensions based on current scene size
    const currentScene = getCurrentScene();
    const windowDimensions = currentScene
      ? calculateViewerWindowDimensions({ width: currentScene.width, height: currentScene.height })
      : "width=1920,height=1080";
    const viewer = window.open("/viewer", "classroom-compositor-viewer", windowDimensions);
    if (!viewer) {
      console.error("Failed to open viewer window (popup blocked?)");
      return;
    }
    const finalizeViewerCleanup = (reason: string) => {
      if (!viewerWindowRef.current || viewerWindowRef.current !== viewer) return;
      viewer.removeEventListener("beforeunload", handleViewerUnload);
      setIsViewerOpen(false);
      viewerWindowRef.current = null;
      removeCanvasConsumer("viewer", reason);
    };

    const handleViewerUnload = () => {
      finalizeViewerCleanup("viewer window unloaded");
      if (viewerCheckIntervalRef.current !== null) {
        clearInterval(viewerCheckIntervalRef.current);
        viewerCheckIntervalRef.current = null;
      }
    };

    viewerWindowRef.current = viewer;
    setIsViewerOpen(true);
    addCanvasConsumer("viewer");
    showControlStrip();
    viewer.addEventListener("beforeunload", handleViewerUnload, { once: true });

    viewer.addEventListener("load", () => {
      console.log("🪟 [openViewer] Viewer window loaded");
      // NOTE: Don't call startStreaming here - the viewer will send viewer-ready
      // message immediately after load, and the session handler will respond.
      // Calling startStreaming here causes redundant stream delivery.
    });

    // Store interval ref for cleanup
    const checkClosed = setInterval(() => {
      if (viewer.closed) {
        clearInterval(checkClosed);
        viewerCheckIntervalRef.current = null;
        console.log("✅ [openViewer] Viewer closed");
        finalizeViewerCleanup("viewer window closed");
      }
    }, 500);
    viewerCheckIntervalRef.current = checkClosed as unknown as number;

    // Removed redundant setTimeout - we already handle stream delivery on load event
    // and in response to viewer-ready/request-stream messages
  };

  // Debug helper: Expose stream count checker globally
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__debugStreamCount = () => {
        const registry = (window as any).__classroomCompositorStreams__;
        const count = registry?.size ?? 0;
        console.log('📊 Stream Registry:', {
          totalStreams: count,
          streamIds: registry ? Array.from(registry.keys()) : [],
          currentStreamActive: !!streamRef.current,
          viewerOpen: !!(viewerWindowRef.current && !viewerWindowRef.current.closed),
        });
        return count;
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__debugStreamCount;
      }
    };
  }, []);

  // Session-based message handler for viewer communication
  // Note: Legacy handler removed to prevent duplicate message handling.
  // The viewer (useViewerOrchestration) sends BOTH session and legacy messages,
  // but we only need to handle them once. The session handler is sufficient.
  useEffect(() => {
    const removeSessionListener = addSessionMessageListener((payload, event) => {
      const sourceWindow = event.source as (Window | null);
      if (!sourceWindow || sourceWindow !== viewerWindowRef.current) {
        return;
      }
      if (payload.type === "viewer-ready") {
        console.log("📨 [session] Received viewer-ready (deduped handler)");
        if (streamRef.current && viewerWindowRef.current) {
          console.log("📤 [session] Sending existing stream to viewer");
          sendStreamToViewer(viewerWindowRef.current, streamRef.current);
        } else if (canvasRef.current) {
          console.log("🎬 [session] Starting new stream for viewer");
          startStreaming(canvasRef.current);
        }
      } else if (payload.type === "request-stream") {
        console.log("📨 [session] Received request-stream (deduped handler)");
        if (payload.streamId && streamRef.current && viewerWindowRef.current) {
          console.log("📤 [session] Re-sending stream to viewer");
          sendStreamToViewer(viewerWindowRef.current, streamRef.current);
        } else if (canvasRef.current) {
          console.log("🎬 [session] Starting stream after request");
          startStreaming(canvasRef.current);
        }
      }
    });
    return () => removeSessionListener();
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

  // Helper function to generate copy name with proper numbering
  const generateCopyName = useCallback((originalName: string, existingNames: string[]): string => {
    const baseName = originalName || "Layer";

    // Try "Copy" first
    const copyName = `${baseName} Copy`;
    if (!existingNames.includes(copyName)) {
      return copyName;
    }

    // Try "Copy 1", "Copy 2", etc.
    let counter = 1;
    while (true) {
      const numberedName = `${baseName} Copy ${counter}`;
      if (!existingNames.includes(numberedName)) {
        return numberedName;
      }
      counter++;
      // Safety limit to prevent infinite loop
      if (counter > 1000) {
        return `${baseName} Copy ${Date.now()}`;
      }
    }
  }, []);

  const duplicateLayers = useCallback(() => {
    const layers = getSelectedLayers();
    if (layers.length === 0) return;
    const state = useAppStore.getState();
    const scene = state.getCurrentScene();
    if (!scene) return;
    const existingNames = scene.layers.map(l => l.name);
    const newIds: string[] = [];
    layers.forEach((layer, index) => {
      const clone: Layer = JSON.parse(JSON.stringify(layer));
      clone.id = createId("layer");
      clone.name = generateCopyName(layer.name, existingNames);
      // Add the new name to existing names for next iteration
      existingNames.push(clone.name);
      clone.transform = {
        ...layer.transform,
        pos: { x: layer.transform.pos.x + 24 + index * 12, y: layer.transform.pos.y + 24 + index * 12 },
      };
      newIds.push(clone.id);
      state.addLayer(clone);
    });
    state.setSelection(newIds);
    requestCurrentStreamFrame();
  }, [getSelectedLayers, generateCopyName]);

  const copyLayersToClipboard = useCallback(() => {
    const layers = getSelectedLayers();
    if (layers.length === 0) return;
    clipboardRef.current = layers.map((layer) => JSON.parse(JSON.stringify(layer)));
  }, [getSelectedLayers]);

  const pasteClipboardLayers = useCallback(() => {
    const clipboard = clipboardRef.current;
    if (!clipboard || clipboard.length === 0) return;
    const state = useAppStore.getState();
    const scene = state.getCurrentScene();
    if (!scene) return;
    const existingNames = scene.layers.map(l => l.name);
    const newIds: string[] = [];
    clipboard.forEach((layer, index) => {
      const clone: Layer = JSON.parse(JSON.stringify(layer));
      clone.id = createId("layer");
      clone.name = generateCopyName(layer.name, existingNames);
      // Add the new name to existing names for next iteration
      existingNames.push(clone.name);
      clone.transform = {
        ...layer.transform,
        pos: { x: layer.transform.pos.x + 32 + index * 12, y: layer.transform.pos.y + 32 + index * 12 },
      };
      newIds.push(clone.id);
      state.addLayer(clone);
    });
    state.setSelection(newIds);
    requestCurrentStreamFrame();
  }, [generateCopyName]);

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
    // ConfidencePreview doesn't need a stream - it renders directly to canvas
    setIsConfidencePreviewVisible((prev) => !prev);
    showControlStrip();
  }, [showControlStrip]);

  useEffect(() => {
    if (isPresentationMode) {
      addCanvasConsumer("presentation");
    } else {
      removeCanvasConsumer("presentation", "presentation mode inactive");
    }
  }, [isPresentationMode, addCanvasConsumer, removeCanvasConsumer]);

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
          // Create new scene with optimal dimensions for presenter's display
          const { width, height } = calculateOptimalSceneDimensions();
          createScene('Untitled Scene', width, height);
        }
      } catch (error) {
        console.error("Failed to load most recent scene", error);
        // Create new scene with optimal dimensions for presenter's display
        const { width, height } = calculateOptimalSceneDimensions();
        createScene('Untitled Scene', width, height);
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
      activeCanvasConsumersRef.current.clear();
      stopCanvasStream("component unmount");
      layerIdsRef.current.forEach((id) => stopSource(id));
      if (viewerWindowRef.current && !viewerWindowRef.current.closed) viewerWindowRef.current.close();
      const hostHandle = hostRef.current;
      if (hostHandle) {
        hostRef.current = null;
        removeCanvasConsumer("host", "component unmount");
        hostHandle.stop().catch((err) => console.warn("Failed to stop host on unmount", err));
      }
    };
  }, [stopCanvasStream, removeCanvasConsumer]);

  // === Go Live ===
  const HOST_ID = "host-123";

  const hostingRef = useRef(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  // pull the actions/state from the zustand store
  const { goLive, joinCode, isJoinCodeActive } = useSessionStore();

  const handleGoLive = useCallback(async () => {
    if (hostingRef.current) return; // de-dupe rapid clicks
    setLiveError(null);

    try {
      // 1) Ensure a session exists in Firestore
      await goLive(HOST_ID);
      const s = useSessionStore.getState().session;
      if (!s?.id) {
        setLiveError("Couldn't create a session. Check Firestore rules/connection.");
        return;
      }

      // 2) Get or create canvas stream (will reuse if already exists!)
      const displayStream = ensureCanvasStreamExists() || undefined;

      // 3) Wait a brief moment to ensure canvas has rendered at least one frame
      // This prevents the track from starting muted with no video data
      await new Promise(resolve => setTimeout(resolve, 100));

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
              muted: track.muted,
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
      addCanvasConsumer("host");
      console.log("✅ [handleGoLive] WebRTC host started");

      // 5) Activate join code and reflect it in UI
      const { codePretty } = await activateJoinCode(s.id);
      useSessionStore.setState({ joinCode: codePretty, isJoinCodeActive: true });

    } catch (e: any) {
      console.error("❌ [handleGoLive] Failed to start:", e);
      setLiveError(
        e?.name === "NotAllowedError"
          ? 'Go Live was blocked by the browser. Click again and press "Allow".'
          : 'Go Live failed. If your browser is still sharing, click its "Stop sharing", then try again.'
      );
    } finally {
      hostingRef.current = false;
    }
  }, [goLive, ensureCanvasStreamExists, addCanvasConsumer]);

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
      {/* Floating live pill at top-center */}
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
        {!isJoinCodeActive ? (
          <button
            onClick={handleGoLive}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 'clamp(6px, 1vw, 12px)',
              background: "#e11d48",
              color: "white",
              border: "none",
              borderRadius: 'clamp(6px, 1vw, 10px)',
              padding: 'clamp(8px, 1.2vh, 12px) clamp(16px, 2vw, 24px)',
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 'clamp(13px, 1.5vw, 16px)',
            }}
            title="Start a live session and generate a join code"
          >
            <span
              style={{
                display: "inline-flex",
                width: 'clamp(8px, 1vw, 12px)',
                height: 'clamp(8px, 1vw, 12px)',
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
                width: 'clamp(8px, 1vw, 12px)',
                height: 'clamp(8px, 1vw, 12px)',
                borderRadius: 999,
                background: "#ef4444",
                boxShadow: "0 0 0 6px rgba(239,68,68,0.2)",
                marginRight: 'clamp(2px, 0.5vw, 4px)',
              }}
              title="Live"
            />
            <span style={{ opacity: 0.85, marginRight: 'clamp(6px, 1vw, 10px)', fontSize: 'clamp(13px, 1.5vw, 16px)' }}>Live</span>
            <code
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontWeight: 700,
                fontSize: 'clamp(13px, 1.5vw, 16px)',
              }}
              title="Join code"
            >
              {joinCode ?? "— — —"}
            </code>

            <button
              onClick={copyJoinInfo}
              style={{
                marginLeft: 'clamp(8px, 1.2vw, 12px)',
                background: "transparent",
                color: "#eaeaea",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 'clamp(4px, 0.8vw, 8px)',
                padding: 'clamp(6px, 1vh, 10px) clamp(10px, 1.5vw, 16px)',
                cursor: "pointer",
                fontSize: 'clamp(12px, 1.4vw, 15px)',
              }}
              title="Copy /join link"
            >
              Copy link
            </button>

            {copied && (
              <span
                style={{
                  marginLeft: 'clamp(8px, 1.2vw, 12px)',
                  padding: 'clamp(4px, 0.8vh, 8px) clamp(8px, 1.2vw, 12px)',
                  borderRadius: 'clamp(4px, 0.8vw, 8px)',
                  background: "rgba(34,197,94,0.15)",
                  border: "1px solid rgba(34,197,94,0.35)",
                  color: "#86efac",
                  fontSize: 'clamp(11px, 1.3vw, 14px)',
                }}
              >
                Copied!
              </span>
            )}

            {liveError && (
              <span
                style={{
                  marginLeft: 'clamp(8px, 1.2vw, 12px)',
                  padding: 'clamp(4px, 0.8vh, 8px) clamp(8px, 1.2vw, 12px)',
                  borderRadius: 'clamp(4px, 0.8vw, 8px)',
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.35)",
                  color: "#fecaca",
                  fontSize: 'clamp(11px, 1.3vw, 14px)',
                }}
              >
                {liveError}
              </span>
            )}
          </>
        )}

        {/* 👇 New: inline error feedback */}
      </div>

      {/* Settings button in top right */}
      <button
        onClick={() => setSettingsOpen(!settingsOpen)}
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 10001,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'rgba(20,20,20,0.85)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#eaeaea',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          backdropFilter: 'blur(4px)',
          boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
        }}
        title="Settings"
      >
        ⚙️
      </button>

      {/* Settings Panel */}
      {settingsOpen && (
        <div
          style={{
            position: 'fixed',
            top: 70,
            right: 16,
            zIndex: 10001,
            width: 320,
            background: 'rgba(20,20,20,0.95)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 12,
            padding: 20,
            boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <h3 style={{ margin: '0 0 16px 0', color: '#eaeaea', fontSize: 16, fontWeight: 600 }}>
            Canvas Settings
          </h3>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#aaa', fontSize: 13 }}>
              Background Type
            </label>
            <select
              value={canvasBackgroundType}
              onChange={(e) => setCanvasBackgroundType(e.target.value as 'color' | 'image')}
              style={{
                width: '100%',
                padding: 8,
                borderRadius: 6,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#eaeaea',
                fontSize: 13,
              }}
            >
              <option value="color">Solid Color</option>
              <option value="image">Image Upload</option>
            </select>
          </div>

          {canvasBackgroundType === 'color' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, color: '#aaa', fontSize: 13 }}>
                Color
              </label>
              <input
                type="color"
                value={canvasBackgroundValue}
                onChange={(e) => setCanvasBackgroundValue(e.target.value)}
                style={{
                  width: '100%',
                  height: 40,
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                }}
              />
            </div>
          )}

          {canvasBackgroundType === 'image' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, color: '#aaa', fontSize: 13 }}>
                Upload Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => {
                      setCanvasBackgroundValue(reader.result as string);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#eaeaea',
                  fontSize: 13,
                }}
              />
            </div>
          )}

          <button
            onClick={() => setSettingsOpen(false)}
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 6,
              background: 'rgba(0, 166, 255, 0.25)',
              border: '1px solid rgba(0, 166, 255, 0.8)',
              color: '#eaeaea',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* Main canvas area */}
      <div
        style={{
          flex: 1,
          display: "flex",
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
          backgroundType={canvasBackgroundType}
          backgroundValue={canvasBackgroundValue}
        />
        {canvasLayout && (
          <CanvasSelectionOverlay
            layout={canvasLayout}
            scene={currentScene}
            skipLayerIds={editingTextId ? [editingTextId] : undefined}
          />
        )}
        {canvasLayout && currentScene && groupTransformIds.length > 0 && (
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

      <FloatingPanel
        title="Objects & Layers"
        position={panelPosition}
        size={isPanelMinimized ? { width: panelSize.width, height: 44 } : panelSize}
        minSize={{ width: 280, height: 200 }}
        onPositionChange={setPanelPosition}
        onSizeChange={(newSize) => {
          if (!isPanelMinimized) {
            setPanelSize(newSize);
          }
        }}
        minimizable
        minimized={isPanelMinimized}
        onToggleMinimize={() => setIsPanelMinimized(!isPanelMinimized)}
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

      {canvasLayout &&
        currentScene &&
        selectedLayer &&
        selectionLength === 1 &&
        selectedLayer.type !== "group" &&
        !selectedLayer.locked &&
        selectedLayer.type !== "camera" &&
        !isEditingSelectedText && (
          <TransformControls
            layout={canvasLayout}
            layer={selectedLayer}
            scene={currentScene}
            onRequestEdit={selectedLayer.type === "text" ? () => setEditingTextId(selectedLayer.id) : undefined}
          />
        )}

      {canvasLayout &&
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

      {canvasLayout &&
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

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} />

      <ControlStrip
        visible={controlStripShouldBeVisible}
        onTogglePresentation={togglePresentationMode}
        presentationActive={isPresentationMode}
        onToggleConfidence={toggleConfidencePreview}
        confidenceActive={isConfidencePreviewVisible}
        onOpenViewer={openViewer}
        viewerOpen={isViewerOpen}
      />

      <ConfidencePreview
        
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
    </div>
  );
}

export default PresenterPage;
export { PresenterPage };
