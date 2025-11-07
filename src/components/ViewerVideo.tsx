// src/components/ViewerVideo.tsx
import { useEffect, useRef, useState } from "react";
import { startViewer, attachStreamToVideo } from "../utils/webrtc";

type Props = { sessionId: string };

export default function ViewerVideo({ sessionId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedRef = useRef(false);
  const [needsTap, setNeedsTap] = useState(false);

  const tryPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    const p = v.play();
    if (p && typeof (p as any).then === "function") {
      (p as Promise<void>)
        .then(() => setNeedsTap(false))
        .catch(() => setNeedsTap(true));
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    if (startedRef.current) return;
    startedRef.current = true;

    let stop: (() => void) | undefined;

    (async () => {
      const { stop: stopFn } = await startViewer(sessionId, async (stream) => {
        const el = videoRef.current;
        if (!el) return;
        await attachStreamToVideo(el, stream);
        tryPlay();
      });
      stop = stopFn;
    })();

    return () => { try { stop?.(); } catch {} startedRef.current = false; };
  }, [sessionId]);

  return (
    <div style={{ width: "100%", height: "100%", background: "#000", position: "relative" }}>
      <video ref={videoRef} style={{ width: "100%", height: "100%" }} autoPlay playsInline muted />
      {needsTap && (
        <button
          onClick={tryPlay}
          style={{
            position: "absolute", inset: 0, margin: "auto", height: 48, width: 160,
            borderRadius: 8, background: "rgba(255,255,255,0.1)", color: "#fff",
            border: "1px solid rgba(255,255,255,0.3)"
          }}
        >
          Tap to Play
        </button>
      )}
    </div>
  );
}