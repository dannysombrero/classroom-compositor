import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { startViewer, attachStreamToVideo } from "../utils/webrtc";

export default function ViewerPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startedRef = useRef(false);   // StrictMode guard
  const userTapRef = useRef(false);   // remember a prior user-gesture
  const [needsTap, setNeedsTap] = useState(false);

  const tryPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    const p = v.play();
    if (p && typeof (p as any).then === "function") {
      (p as Promise<void>)
        .then(() => setNeedsTap(false))
        .catch((err) => {
          console.warn("[viewer] video.play blocked (autoplay policy). Showing tap button.", err);
          setNeedsTap(true);
        });
    }
  };

  const onStream = async (stream: MediaStream) => {
    const v = videoRef.current;
    if (!v) return;
    console.log("[viewer] onStream received. tracks:", stream.getTracks().map(t => t.kind));
    await attachStreamToVideo(v, stream);
    if (userTapRef.current) {
      // If the user already tapped, force a play attempt again
      tryPlay();
    } else {
      // Attempt autoplay right away
      tryPlay();
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    if (startedRef.current) return;   // StrictMode: prevent double start
    startedRef.current = true;

    let stopFn: (() => void) | null = null;

    (async () => {
      try {
        console.log("[viewer] starting for session:", sessionId);
        const { pc, stop } = await startViewer(sessionId, onStream);
        stopFn = stop;

        // tidy up transport on unload
        window.addEventListener(
          "beforeunload",
          () => { try { pc.close(); } catch {} },
          { once: true }
        );
      } catch (e) {
        console.error("[viewer] startViewer failed:", e);
        setNeedsTap(false); // hide button if we failed earlier
      }
    })();

    return () => {
      try { stopFn?.(); } catch {}
      const v = videoRef.current;
      if (v?.srcObject) {
        (v.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        v.srcObject = null;
      }
      startedRef.current = false;
    };
  }, [sessionId]);

  const handleTap = () => {
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
        onLoadedMetadata={tryPlay}   // if metadata arrives late, retry play
      />
      {needsTap && (
        <button
          onClick={handleTap}
          className="absolute inset-0 m-auto h-12 w-44 rounded bg-white/10 text-white border border-white/30 backdrop-blur
                     hover:bg-white/20 transition"
          style={{ pointerEvents: "auto" }}
        >
          Tap to Play
        </button>
      )}
    </div>
  );
}