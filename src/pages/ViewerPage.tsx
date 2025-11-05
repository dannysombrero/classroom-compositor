import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { startViewer } from "../utils/webrtc";

export default function ViewerPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let stop: (() => void) | null = null;

    (async () => {
      try {
        if (!sessionId) {
          console.warn("[viewer] no sessionId in route");
          return;
        }
        console.log("[viewer] starting for session:", sessionId);

        const { stream, stop: s } = await startViewer(sessionId);
        stop = s;

        if (videoRef.current) {
          videoRef.current.muted = true;     // autoplay safety
          // Assign MediaStream to <video>
          (videoRef.current as HTMLVideoElement).srcObject = stream;
          try {
            await videoRef.current.play();
          } catch {
            // Some browsers require a click; ignore here.
          }
        }
        console.log("[viewer] awaiting tracks…");
      } catch (e) {
        console.error("[viewer] failed to connect:", e);
      }
    })();

    return () => {
      try { stop?.(); } catch { /* no-op */ }
    };
  }, [sessionId]);

  return (
    <div style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", background: "#0b0b0b" }}>
      <video ref={videoRef} playsInline autoPlay style={{ maxWidth: "100%", maxHeight: "100%" }} />
      <div style={{ position: "fixed", top: 8, left: 8, color: "#bbb", fontSize: 12 }}>
        viewer session: <code>{sessionId}</code>
      </div>
    </div>
  );
}