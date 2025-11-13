import { useMemo, useRef } from "react";

import {
  useViewerOrchestration,
  type ViewerConnectionStatus,
} from "../hooks/useViewerOrchestration";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Separator } from "../components/ui/separator";

const STATUS_LABELS: Record<ViewerConnectionStatus, { title: string; tone: string }> = {
  idle: { title: "Idle", tone: "bg-muted text-muted-foreground" },
  connecting: { title: "Connecting", tone: "bg-secondary/20 text-secondary" },
  "awaiting-stream": { title: "Awaiting Stream", tone: "bg-muted text-muted-foreground" },
  ready: { title: "Live", tone: "bg-primary/20 text-primary" },
  ended: { title: "Stream Ended", tone: "bg-muted text-muted-foreground" },
  error: { title: "Error", tone: "bg-destructive/15 text-destructive" },
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
    <div className="min-h-screen bg-background/95 text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
        <Card className="w-full overflow-hidden border-border/60 bg-card/80 backdrop-blur">
          <CardHeader className="space-y-2 border-b border-border/70 bg-black/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-semibold">Viewer Window</CardTitle>
                <CardDescription className="mt-1 text-base">
                  This window mirrors the presenter canvas in real time.
                </CardDescription>
              </div>
              <span
                className={`inline-flex h-8 items-center rounded-full px-4 text-sm font-medium ${statusMeta.tone}`}
              >
                {statusMeta.title}
              </span>
            </div>
          </CardHeader>

          <CardContent className="grid gap-6 p-6">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
              <video
                ref={videoRef}
                playsInline
                className="h-full w-full object-contain"
                autoPlay
                muted
              />
              {status !== "ready" && (
                <div className="absolute inset-0 grid place-items-center bg-black/70">
                  <div className="rounded-lg border border-border/60 bg-background/90 px-4 py-3 text-center text-sm text-muted-foreground">
                    {status === "connecting" && "Waiting for presenter…"}
                    {status === "awaiting-stream" && "Requesting video stream"}
                    {status === "ended" && "Stream ended by presenter"}
                    {status === "error" && (error ?? "Unable to connect")}
                    {status === "idle" && "Viewer ready"}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4 rounded-lg border border-border/60 bg-muted/10 p-4 text-sm">
              <div className="grid gap-1">
                <p className="font-semibold text-foreground">Connection details</p>
                <p className="text-muted-foreground">
                  Status updates are shown above. If the video freezes you can request a fresh stream.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted/40 px-3 py-1">Stream ID: {lastStreamId ?? DEFAULT_STREAM_ID}</span>
                {error && (
                  <span className="rounded-full bg-destructive/20 px-3 py-1 text-destructive">{error}</span>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Diagnostics
                </h3>
                <Button variant="ghost" size="sm" onClick={handleRetry} className="h-8 px-3 text-xs">
                  Reconnect
                </Button>
              </div>
              <Separator className="my-2" />
              <div className="max-h-48 overflow-auto rounded-md border border-border/50 bg-background/60 p-3 text-xs font-mono leading-relaxed text-muted-foreground">
                {debugLog.length > 0 ? (
                  debugLog.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)
                ) : (
                  <div>Waiting for events…</div>
                )}
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t border-border/70 bg-black/10 p-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              Having trouble? Make sure the presenter window stays in the foreground while starting the stream.
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={announceReady} className="h-9 px-4">
                Signal Ready
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => requestStream(lastStreamId ?? DEFAULT_STREAM_ID)}
                className="h-9 px-4"
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
