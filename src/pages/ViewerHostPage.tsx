import { useMemo, useRef } from "react";

import {
  useViewerOrchestration,
  type ViewerConnectionStatus,
} from "../hooks/useViewerOrchestration";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Separator } from "../components/ui/Separator";

const STATUS_LABELS: Record<ViewerConnectionStatus, { title: string; background: string; color: string }> = {
  idle: { title: "Idle", background: "rgba(255, 255, 255, 0.08)", color: "var(--color-text-muted)" },
  connecting: {
    title: "Connecting",
    background: "rgba(245, 158, 11, 0.18)",
    color: "var(--color-secondary)",
  },
  "awaiting-stream": {
    title: "Awaiting Stream",
    background: "rgba(255, 255, 255, 0.08)",
    color: "var(--color-text-muted)",
  },
  ready: {
    title: "Live",
    background: "rgba(16, 185, 129, 0.22)",
    color: "var(--color-success)",
  },
  ended: {
    title: "Stream Ended",
    background: "rgba(255, 255, 255, 0.08)",
    color: "var(--color-text-muted)",
  },
  error: {
    title: "Error",
    background: "rgba(239, 68, 68, 0.2)",
    color: "var(--color-danger)",
  },
};

const DEFAULT_STREAM_ID = "presenter:primary";

export function ViewerHostPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    status,
    error,
    debugLog,
    lastStreamId,
    announceReady,
    requestStream,
  } = useViewerOrchestration({ videoRef });

  const statusMeta = useMemo(() => STATUS_LABELS[status] ?? STATUS_LABELS.idle, [status]);

  const handleRetry = () => {
    announceReady();
    requestStream(lastStreamId ?? DEFAULT_STREAM_ID);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "rgba(10, 12, 18, 0.95)",
        color: "var(--color-text)",
        padding: "2.5rem 1.5rem",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 960,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Card
          style={{
            width: "100%",
            background: "rgba(18, 21, 32, 0.9)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(12px)",
          }}
        >
          <CardHeader
            style={{
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              background: "rgba(0, 0, 0, 0.25)",
              paddingBottom: "1.5rem",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: "1rem",
                alignItems: "flex-start",
              }}
            >
              <div>
                <CardTitle style={{ fontSize: "1.75rem" }}>Viewer Window</CardTitle>
                <CardDescription style={{ fontSize: "1rem" }}>
                  This window mirrors the presenter canvas in real time.
                </CardDescription>
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 32,
                  padding: "0 1rem",
                  borderRadius: 999,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  background: statusMeta.background,
                  color: statusMeta.color,
                }}
              >
                {statusMeta.title}
              </span>
            </div>
          </CardHeader>

          <CardContent style={{ display: "grid", gap: "1.75rem" }}>
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 9",
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                background: "#000",
              }}
            >
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                  background: "#000",
                }}
              />
              {status !== "ready" && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(0, 0, 0, 0.7)",
                  }}
                >
                  <div
                    style={{
                      borderRadius: 12,
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      background: "rgba(14, 16, 24, 0.9)",
                      padding: "0.75rem 1.25rem",
                      fontSize: "0.9rem",
                      textAlign: "center",
                      color: "var(--color-text-muted)",
                      maxWidth: "80%",
                    }}
                  >
                    {status === "connecting" && "Waiting for presenter…"}
                    {status === "awaiting-stream" && "Requesting video stream"}
                    {status === "ended" && "Stream ended by presenter"}
                    {status === "error" && (error ?? "Unable to connect")}
                    {status === "idle" && "Viewer ready"}
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gap: "0.75rem",
                padding: "1rem",
                borderRadius: 12,
                border: "1px solid rgba(255, 255, 255, 0.08)",
                background: "rgba(255, 255, 255, 0.04)",
                fontSize: "0.9rem",
              }}
            >
              <div>
                <p style={{ fontWeight: 600, margin: 0 }}>Connection details</p>
                <p style={{ margin: "0.35rem 0 0", color: "var(--color-text-muted)" }}>
                  Status updates are shown above. If the video freezes you can request a fresh stream.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  alignItems: "center",
                  color: "var(--color-text-muted)",
                  fontSize: "0.75rem",
                }}
              >
                <span
                  style={{
                    padding: "0.25rem 0.75rem",
                    borderRadius: 999,
                    background: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  Stream ID: {lastStreamId ?? DEFAULT_STREAM_ID}
                </span>
                {error && (
                  <span
                    style={{
                      padding: "0.25rem 0.75rem",
                      borderRadius: 999,
                      background: "rgba(239, 68, 68, 0.2)",
                      color: "var(--color-danger)",
                    }}
                  >
                    {error}
                  </span>
                )}
              </div>
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <h3
                  style={{
                    fontSize: "0.85rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--color-text-muted)",
                    margin: 0,
                  }}
                >
                  Diagnostics
                </h3>
                <Button variant="ghost" size="sm" onClick={handleRetry}>
                  Reconnect
                </Button>
              </div>
              <Separator />
              <div
                style={{
                  maxHeight: 200,
                  overflowY: "auto",
                  borderRadius: 10,
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  background: "rgba(16, 18, 26, 0.9)",
                  padding: "0.75rem",
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  fontSize: "0.75rem",
                  lineHeight: 1.5,
                  color: "var(--color-text-muted)",
                }}
              >
                {debugLog.length > 0 ? (
                  debugLog.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)
                ) : (
                  <div>Waiting for events…</div>
                )}
              </div>
            </div>
          </CardContent>

          <CardFooter
            style={{
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              paddingTop: "1.5rem",
              marginTop: "1rem",
              fontSize: "0.9rem",
              color: "var(--color-text-muted)",
            }}
          >
            <div style={{ flex: "1 1 300px" }}>
              Having trouble? Make sure the presenter window stays in the foreground while starting the stream.
            </div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Button variant="secondary" size="sm" onClick={announceReady}>
                Signal Ready
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => requestStream(lastStreamId ?? DEFAULT_STREAM_ID)}
              >
                Request Stream
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
