/**
 * PresenterPage component - main editing interface with canvas and overlay panel.
 * 
 * Mounts the PresenterCanvas and provides space for the overlay panel with
 * visibility toggles and layer controls.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { PresenterCanvas } from '../components/PresenterCanvas';
import {
  captureCanvasStream,
  sendStreamToViewer,
  notifyStreamEnded,
  DEFAULT_STREAM_FPS,
  type ViewerMessage,
} from '../utils/viewerStream';
import { useAppStore } from '../app/store';
import { loadMostRecentScene } from '../app/persistence';

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
  const { getCurrentScene, createScene, loadScene, saveScene } = useAppStore();

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

  const startStreaming = useCallback((canvas: HTMLCanvasElement) => {
    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Capture new stream
    const stream = captureCanvasStream(canvas, { fps: DEFAULT_STREAM_FPS });
    if (!stream) {
      console.error('Failed to capture canvas stream');
      return;
    }

    streamRef.current = stream;

    // Send to viewer window if open
    if (viewerWindowRef.current && !viewerWindowRef.current.closed) {
      sendStreamToViewer(viewerWindowRef.current, stream);
    }

    // Handle stream ended
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (viewerWindowRef.current && !viewerWindowRef.current.closed) {
        notifyStreamEnded(viewerWindowRef.current);
      }
      streamRef.current = null;
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
    const handleMessage = (event: MessageEvent<ViewerMessage>) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === 'viewer-ready') {
        // Viewer is ready, send stream if we have canvas and stream
        if (canvasRef.current && streamRef.current) {
          // Stream already exists, resend it
          if (viewerWindowRef.current && !viewerWindowRef.current.closed) {
            sendStreamToViewer(viewerWindowRef.current, streamRef.current);
          }
        } else if (canvasRef.current) {
          // Start streaming to newly ready viewer
          startStreaming(canvasRef.current);
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
        return;
      }

      // Try to load most recent scene
      const mostRecent = await loadMostRecentScene();
      if (mostRecent && mostRecent.id) {
        // Load the scene into store (we need to add it first, then load it)
        useAppStore.setState((state) => ({
          scenes: { ...state.scenes, [mostRecent.id!]: mostRecent },
          currentSceneId: mostRecent.id,
        }));
      } else {
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
        <PresenterCanvas ref={handleCanvasRef} fitToContainer />
        
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

      {/* Overlay panel placeholder */}
      <div
        style={{
          width: '300px',
          backgroundColor: '#2a2a2a',
          borderLeft: '1px solid #3a3a3a',
          padding: '16px',
          overflowY: 'auto',
        }}
      >
        {/* TODO: Overlay panel component with visibility toggles */}
        <div style={{ color: '#fff', fontSize: '14px' }}>
          Overlay Panel (placeholder)
        </div>
      </div>
    </div>
  );
}

