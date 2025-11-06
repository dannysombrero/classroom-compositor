import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { startViewer } from "../utils/webrtc";

export default function ViewerPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let stopFn: (() => void) | null = null;

    (async () => {
      console.log("[viewer] starting for session:", sessionId);
      const { stream, pc, stop } = await startViewer(sessionId);
      stopFn = stop;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const p = videoRef.current.play();
        if (p && typeof p.then === "function") {
          p.catch((e: any) => console.warn("[viewer] autoplay blocked", e));
        }
      }

      // Debug: log tracks as they appear
      if (stream) {
        const logTracks = () => {
          const kinds = stream.getTracks().map(t => t.kind);
          console.log("[viewer] stream tracks now:", kinds);
        };
        stream.addEventListener?.("addtrack", logTracks as any);
        logTracks();
      }

      // Clean up on unload
      window.addEventListener(
        "beforeunload",
        () => {
          try { pc.close(); } catch {}
        },
        { once: true }
      );
    })();

    return () => {
      try { stopFn?.(); } catch {}
      const v = videoRef.current;
      if (v && v.srcObject) {
        (v.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        v.srcObject = null;
      }
    };
  }, [sessionId]);

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        className="max-w-[100vw] max-h-[100vh]"
        autoPlay
        playsInline
        muted
        controls={false}
      />
    </div>
  );
}