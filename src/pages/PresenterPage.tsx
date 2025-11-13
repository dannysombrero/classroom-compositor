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
import { useAppStore } from "../app/store";
import { loadMostRecentScene } from "../app/persistence";
import { createId } from "../utils/id";
import {
  createTextLayer,
  createImageLayer,
  createShapeLayer,
} from "../layers/factory";
import {
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
import { useBackgroundEffectTrack } from "../hooks/useBackgroundEffectTrack";
import { replaceHostVideoTrack } from "../utils/webrtc";
import { usePresenterCapture } from "../hooks/usePresenterCapture";
import { onTrackCleanup } from "../utils/trackReferenceCounter";
import { usePresenterHotkeys } from "../hooks/usePresenterHotkeys";
import { usePresenterLayout } from "../hooks/usePresenterLayout";

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
  const layerIdsRef = useRef<string[]>([]);
  const [canvasLayout, setCanvasLayout] = useState<CanvasLayout | null>(null);
  const [isSceneLoading, setIsSceneLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Use layout hook for UI state
  const layout = usePresenterLayout();

  const [cameraTrackForEffects, setCameraTrackForEffects] = useState<MediaStreamTrack | null>(null);
  const [cameraLayerForEffects, setCameraLayerForEffects] = useState<string | null>(null);
  const processedCameraTrack = useBackgroundEffectTrack(cameraTrackForEffects);

  const capture = usePresenterCapture();

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
  const activeGroupChildIds = selectedGroup ? selectedGroup.children : [];
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

  // Control strip auto-hide is now handled by usePresenterLayout hook

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
      if (layout.editingTextId !== null) layout.stopEditingText();
      return;
    }
    if (layout.editingTextId && layout.editingTextId !== selectedLayer.id) {
      layout.stopEditingText();
    }
  }, [layout, selectedLayer]);

  useEffect(() => {
    if (layout.editingTextId) requestCurrentStreamFrame();
  }, [layout.editingTextId]);

  // Add layers
  const addScreenCaptureLayer = useCallback(async () => {
    if (isAddingScreen) return;
    setIsAddingScreen(true);
    try {
      await capture.startScreen();
    } finally {
      setIsAddingScreen(false);
    }
  }, [capture, isAddingScreen]);

  const addCameraLayer = useCallback(async () => {
    if (isAddingCamera) return;
    setIsAddingCamera(true);
    try {
      const result = await capture.startCamera();
      if (result) {
        setCameraTrackForEffects(result.track);
        setCameraLayerForEffects(result.layerId);

        // Clear effects state when track ends
        const handleEffectsEnded = () => {
          setCameraTrackForEffects(null);
          setCameraLayerForEffects(null);
        };
        result.track.addEventListener('ended', handleEffectsEnded);

        // Register cleanup to remove event listener
        onTrackCleanup(result.track, () => {
          result.track.removeEventListener('ended', handleEffectsEnded);
        });
      }
    } finally {
      setIsAddingCamera(false);
    }
  }, [capture, isAddingCamera]);

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
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track && track.readyState === 'live') {
        console.log("✅ [ensureStream] Reusing existing live canvas stream");
        return streamRef.current;
      }
      // Stream is dead, clean it up
      console.log("⚠️ [ensureStream] Existing stream is dead, cleaning up");
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCurrentStream(null);
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
    if (track) {
      const handleEnded = () => {
        console.log("🛑 [ensureStream] Canvas track ended");
        if (viewerWindowRef.current && !viewerWindowRef.current.closed) {
          notifyStreamEnded(viewerWindowRef.current);
        }
        streamRef.current = null;
        setCurrentStream(null);
        layout.exitPresentationMode();
        layout.hideConfidencePreview();
        layout.showControlStrip();
      };
      track.addEventListener("ended", handleEnded, { once: true });
    }

    return stream;
  }, [layout]);

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
    if (viewerWindowRef.current && !viewerWindowRef.current.closed) {
      viewerWindowRef.current.focus();
      ensureCanvasStream();
      layout.showControlStrip();
      return;
    }
    const viewer = window.open("/viewer", "classroom-compositor-viewer", "width=1920,height=1080");
    if (!viewer) {
      console.error("Failed to open viewer window (popup blocked?)");
      return;
    }
    viewerWindowRef.current = viewer;
    setIsViewerOpen(true);
    layout.showControlStrip();

    viewer.addEventListener("load", () => {
      if (canvasRef.current) startStreaming(canvasRef.current);
    });
    const checkClosed = setInterval(() => {
      if (viewer.closed) {
        clearInterval(checkClosed);
        setIsViewerOpen(false);
        viewerWindowRef.current = null;
        // DON'T stop the stream if we're still live streaming to remote viewers!
        // Only stop if we're not hosting
        if (streamRef.current && !hostRef.current) {
          console.log("🛑 [openViewer] Stopping stream (not live)");
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          setCurrentStream(null);
        } else if (streamRef.current && hostRef.current) {
          console.log("✅ [openViewer] Keeping stream alive (still live to remote viewers)");
        }
      }
    }, 500);
    setTimeout(() => {
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

  // Wrapper functions for hotkeys that ensure canvas stream exists
  const togglePresentationModeWithStream = useCallback(() => {
    if (!layout.isPresentationMode) {
      const stream = ensureCanvasStreamExists();
      if (!stream) {
        console.warn("Presenter: Cannot enter presentation mode without a stream");
        return;
      }
    }
    layout.togglePresentationMode();
  }, [layout, ensureCanvasStreamExists]);

  const toggleConfidencePreviewWithStream = useCallback(() => {
    if (!layout.isConfidencePreviewVisible) {
      const stream = ensureCanvasStreamExists();
      if (!stream) {
        console.warn("Presenter: Cannot show confidence preview without a stream");
        return;
      }
    }
    layout.toggleConfidencePreview();
  }, [layout, ensureCanvasStreamExists]);

  // Setup hotkeys
  usePresenterHotkeys({
    editingTextId: layout.editingTextId,
    isPresentationMode: layout.isPresentationMode,
    onTogglePresentationMode: togglePresentationModeWithStream,
    onExitPresentationMode: layout.exitPresentationMode,
    onToggleConfidencePreview: toggleConfidencePreviewWithStream,
  });

  const isEditingSelectedText = selectedLayer?.type === "text" && layout.editingTextId === selectedLayer.id;
  const controlStripShouldBeVisible = layout.isPresentationMode ? true : layout.controlStripVisible;

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
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      layerIdsRef.current.forEach((id) => stopSource(id));
      if (viewerWindowRef.current && !viewerWindowRef.current.closed) viewerWindowRef.current.close();
    };
  }, []);

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

      // 3) Attach the track to WebRTC BEFORE creating the offer
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

      // 4) Start WebRTC host with the canvas stream
      hostingRef.current = true;
      hostRef.current = await startHost(s.id, {
        displayStream,
        requireDisplay: false,   // do NOT prompt; we'll capture only from the ScreenShare control
        sendAudio: false,        // optional: change to true if you want mic on at Go Live
        loadingText: "Waiting for presenter…",
      });
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
  }, [goLive, ensureCanvasStreamExists]);

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

        {/* 👇 New: inline error feedback */}
      </div>

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
          skipLayerIds={layout.editingTextId ? [layout.editingTextId] : undefined}
        />
        {canvasLayout && (
          <CanvasSelectionOverlay
            layout={canvasLayout}
            scene={currentScene}
            skipLayerIds={layout.editingTextId ? [layout.editingTextId] : undefined}
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
        position={layout.panelPosition}
        size={{
          width: LAYERS_PANEL_WIDTH,
          height: layout.isLayersPanelCollapsed ? LAYERS_PANEL_COLLAPSED_HEIGHT : LAYERS_PANEL_EXPANDED_HEIGHT,
        }}
        onPositionChange={layout.setPanelPosition}
        collapsible
        collapsed={layout.isLayersPanelCollapsed}
        onToggleCollapse={layout.toggleLayersPanel}
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
        selectedLayer.type !== "screen" &&
        !isEditingSelectedText && (
          <TransformControls
            layout={canvasLayout}
            layer={selectedLayer}
            scene={currentScene}
            onRequestEdit={selectedLayer.type === "text" ? () => layout.startEditingText(selectedLayer.id) : undefined}
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
              layout.stopEditingText();
              if (!cancelled) requestCurrentStreamFrame();
            }}
          />
        )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} />

      <ControlStrip
        visible={controlStripShouldBeVisible}
        onTogglePresentation={togglePresentationModeWithStream}
        presentationActive={layout.isPresentationMode}
        onToggleConfidence={toggleConfidencePreviewWithStream}
        confidenceActive={layout.isConfidencePreviewVisible}
        onOpenViewer={openViewer}
        viewerOpen={isViewerOpen}
      />

      <ConfidencePreview
        stream={streamRef.current}
        visible={layout.isConfidencePreviewVisible}
        onClose={() => {
          layout.hideConfidencePreview();
          layout.showControlStrip();
        }}
      />

      <PresentationOverlay
        stream={streamRef.current}
        active={layout.isPresentationMode}
        onExit={layout.exitPresentationMode}
      />
    </div>
  );
}

export default PresenterPage;
export { PresenterPage };