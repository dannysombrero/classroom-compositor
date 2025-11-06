import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { startViewer } from "../utils/webrtc";

export default function ViewerPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startedRef = useRef(false);               // StrictMode guard
  const userTapRef = useRef(false);               // remember user intent
  const [needsTap, setNeedsTap] = useState(false);

  const tryPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    const p = v.play();
    if (p && typeof p.then === "function") {
      p.then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
    }
  };

  const attachStreamAndAutoplay = (stream: MediaStream) => {
    const v = videoRef.current!;
    if (v.srcObject !== stream) v.srcObject = stream;
    v.muted = true;
    v.playsInline = true;

    // If the user already tried to play, honor it immediately.
    if (userTapRef.current) {
      tryPlay();
      return;
    }

    // Otherwise attempt autoplay now.
    tryPlay();
  };

  useEffect(() => {
    if (!sessionId) return;
    if (startedRef.current) return;   // StrictMode: prevent double start in dev
    startedRef.current = true;

    let stopFn: (() => void) | null = null;

    (async () => {
      console.log("[viewer] starting for session:", sessionId);
      const { pc, stop } = await startViewer(sessionId, attachStreamAndAutoplay);
      stopFn = stop;

      window.addEventListener("beforeunload", () => { try { pc.close(); } catch {} }, { once: true });
    })();

    return () => {
      try { stopFn?.(); } catch {}
      const v = videoRef.current;
      if (v?.srcObject) {
        (v.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        v.srcObject = null;
      }
    };
  }, [sessionId]);

  const handleTapToPlay = () => {
    userTapRef.current = true;
    tryPlay();
  };

  return (
    <div className="w-screen h-screen bg-black relative">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain"
        autoPlay
        playsInline
        muted
        controls={false}
        onLoadedMetadata={tryPlay}     // if metadata arrives late, retry play
      />
      {needsTap && (
        <button
          onClick={handleTapToPlay}
          className="absolute inset-0 m-auto h-12 w-40 rounded bg-white/10 text-white border border-white/30 backdrop-blur
                     hover:bg-white/20 transition"
          style={{ pointerEvents: "auto" }}
        >
          Tap to Play
        </button>
      )}
    </div>
  );
}