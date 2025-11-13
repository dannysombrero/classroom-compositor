import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addSessionMessageListener,
  postSessionMessage,
  type SessionMessagePayload,
} from "../utils/sessionMessaging";

function generateViewerId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `viewer-${Math.random().toString(36).slice(2, 10)}`;
}

export type ViewerConnectionStatus =
  | "idle"
  | "connecting"
  | "awaiting-stream"
  | "ready"
  | "ended"
  | "error";

export interface ViewerOrchestrationOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  sessionId?: string | null;
  handshakeTimeoutMs?: number;
  onStreamReceived?: (stream: MediaStream) => void;
  onStreamEnded?: () => void;
}

export interface ViewerOrchestrationState {
  viewerId: string;
  status: ViewerConnectionStatus;
  error: string | null;
  debugLog: string[];
  lastStreamId: string | null;
  announceReady: () => void;
  requestStream: (streamId: string) => void;
}

const PRIMARY_STREAM_ID = "presenter:primary";

/**
 * Hook used within the viewer window to orchestrate the postMessage handshake with the presenter window.
 */
export function useViewerOrchestration(options: ViewerOrchestrationOptions): ViewerOrchestrationState {
  const { videoRef, sessionId = null, handshakeTimeoutMs = 4000, onStreamReceived, onStreamEnded } = options;
  const viewerIdRef = useRef<string>(generateViewerId());
  const [status, setStatus] = useState<ViewerConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastStreamId, setLastStreamId] = useState<string | null>(null);
  const [debugVersion, setDebugVersion] = useState(0);
  const debugLogRef = useRef<string[]>([]);
  const playbackStreamRef = useRef<MediaStream | null>(null);
  const handshakeTimerRef = useRef<number | null>(null);

  const appendDebug = useCallback((message: string) => {
    const timestamp = new Date().toISOString();
    debugLogRef.current = [...debugLogRef.current.slice(-49), `${timestamp} • ${message}`];
    setDebugVersion((version) => (version + 1) % Number.MAX_SAFE_INTEGER);
  }, []);

  const updateStatus = useCallback((next: ViewerConnectionStatus) => {
    setStatus((prev) => {
      if (prev !== next) {
        appendDebug(`status → ${next}`);
      }
      return next;
    });
  }, [appendDebug]);

  const stopPlaybackStream = useCallback(() => {
    const current = playbackStreamRef.current;
    if (!current) return;
    current.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (err) {
        console.warn("Failed to stop playback track", err);
      }
    });
    playbackStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [videoRef]);

  const attachStream = useCallback(
    async (stream: MediaStream, streamId: string) => {
      if (!stream) {
        return;
      }
      appendDebug(`attaching stream ${streamId}`);
      setLastStreamId(streamId);
      playbackStreamRef.current = stream;
      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.srcObject = stream;
        try {
          await videoEl.play();
          appendDebug("video playback started");
        } catch (err) {
          appendDebug(`video playback error: ${(err as Error).message}`);
          console.error("Viewer failed to autoplay stream", err);
        }
      }
      onStreamReceived?.(stream);
      updateStatus("ready");
    },
    [appendDebug, onStreamReceived, updateStatus, videoRef],
  );

  const announceReady = useCallback(() => {
    if (!window.opener) {
      const message = "Viewer window has no opener";
      appendDebug(message);
      setError(message);
      updateStatus("error");
      return;
    }
    appendDebug("sending viewer-ready message");
    updateStatus("connecting");
    postSessionMessage(window.opener, {
      type: "viewer-ready",
      viewerId: viewerIdRef.current,
      sessionId,
      capabilities: { acceptsStreamTransfer: true },
    });

    // Fallback legacy event for older presenters
    window.opener.postMessage({ type: "viewer-ready" }, window.location.origin);

    if (handshakeTimerRef.current) {
      window.clearTimeout(handshakeTimerRef.current);
    }
    handshakeTimerRef.current = window.setTimeout(() => {
      appendDebug("handshake timeout waiting for stream");
      updateStatus("awaiting-stream");
    }, handshakeTimeoutMs);
  }, [appendDebug, handshakeTimeoutMs, sessionId, updateStatus]);

  const requestStream = useCallback(
    (streamId: string) => {
      if (!window.opener) {
        appendDebug("cannot request stream without opener");
        return;
      }
      appendDebug(`requesting stream ${streamId}`);
      postSessionMessage(window.opener, {
        type: "request-stream",
        viewerId: viewerIdRef.current,
        streamId,
        sessionId,
      });

      // Legacy request
      window.opener.postMessage({ type: "request-stream" }, window.location.origin);
    },
    [appendDebug, sessionId],
  );

  const handleSessionMessage = useCallback(
    (payload: SessionMessagePayload) => {
      appendDebug(`session message: ${payload.type}`);
      switch (payload.type) {
        case "stream-announce":
          if (payload.streamId) {
            updateStatus("awaiting-stream");
            if (payload.hasStream !== false) {
              requestStream(payload.streamId);
            }
          }
          break;
        case "deliver-stream":
          if (payload.stream) {
            attachStream(payload.stream, payload.streamId ?? PRIMARY_STREAM_ID);
          } else if (payload.streamId) {
            requestStream(payload.streamId);
          }
          break;
        case "stream-ended":
          stopPlaybackStream();
          onStreamEnded?.();
          updateStatus("ended");
          break;
        case "viewer-ready":
          // Presenter acknowledging our message, ignore
          break;
        case "request-stream":
          // Viewer should not receive these, ignore
          break;
        case "error":
          setError(payload.message);
          updateStatus("error");
          break;
        default:
          break;
      }
    },
    [appendDebug, attachStream, onStreamEnded, requestStream, stopPlaybackStream, updateStatus],
  );

  useEffect(() => {
    if (!videoRef.current) {
      appendDebug("video element not ready on mount");
    }

    const removeListener = addSessionMessageListener((payload) => {
      handleSessionMessage(payload);
    });

    const handleLegacyEvent = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "stream" && data.stream && typeof data.stream.getVideoTracks === "function") {
        appendDebug("legacy stream message received");
        attachStream(data.stream as MediaStream, PRIMARY_STREAM_ID);
      } else if (data.type === "stream" && data.streamAvailable && !data.stream) {
        appendDebug("legacy stream availability message");
        requestStream(PRIMARY_STREAM_ID);
      } else if (data.type === "stream-ended") {
        appendDebug("legacy stream-ended message");
        stopPlaybackStream();
        onStreamEnded?.();
        updateStatus("ended");
      }
    };

    window.addEventListener("message", handleLegacyEvent);
    announceReady();

    return () => {
      removeListener();
      window.removeEventListener("message", handleLegacyEvent);
      if (handshakeTimerRef.current) {
        window.clearTimeout(handshakeTimerRef.current);
        handshakeTimerRef.current = null;
      }
      stopPlaybackStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const debugLog = useMemo(() => debugLogRef.current, [status, error, lastStreamId, debugVersion]);

  return {
    viewerId: viewerIdRef.current,
    status,
    error,
    debugLog,
    lastStreamId,
    announceReady,
    requestStream,
  };
}
