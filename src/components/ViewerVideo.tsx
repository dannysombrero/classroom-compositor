// src/components/ViewerVideo.tsx
import { useEffect, useRef, useState } from "react";
import { startViewer, attachStreamToVideo } from "../utils/webrtc";

type Props = { sessionId: string };

export default function ViewerVideo({ sessionId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedRef = useRef(false);
  const [needsTap, setNeedsTap] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tryPlay = async () => {
    const v = videoRef.current;
    if (!v) return;

    try {
      await v.play();
      console.log("✅ [ViewerVideo] Video playing successfully");
      setNeedsTap(false);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    } catch (err) {
      console.warn("⚠️ [ViewerVideo] Play failed:", err);
      setNeedsTap(true);
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

        try {
          await attachStreamToVideo(el, stream);
          console.log("✅ [ViewerVideo] Stream attached successfully");

          // Try playing immediately
          await tryPlay();

          // Set up aggressive retry if initial play failed
          // This catches cases where the video needs a frame or two before it can play
          let retryCount = 0;
          const maxRetries = 5;

          const retryPlay = async () => {
            if (retryCount >= maxRetries) {
              console.warn("⚠️ [ViewerVideo] Max autoplay retries reached");
              return;
            }

            const v = videoRef.current;
            if (!v) return;

            // Check if video is already playing
            if (!v.paused) {
              console.log("✅ [ViewerVideo] Video is already playing");
              return;
            }

            retryCount++;
            console.log(`🔄 [ViewerVideo] Retry autoplay attempt ${retryCount}/${maxRetries}`);

            try {
              await v.play();
              console.log("✅ [ViewerVideo] Retry successful");
              setNeedsTap(false);
            } catch {
              // Schedule next retry with exponential backoff
              const delay = Math.min(100 * Math.pow(2, retryCount - 1), 1000);
              retryTimerRef.current = setTimeout(retryPlay, delay);
            }
          };

          // Start retry timer if video isn't playing
          setTimeout(() => {
            const v = videoRef.current;
            if (v && v.paused) {
              retryPlay();
            }
          }, 100);

        } catch (err) {
          console.error("💥 [ViewerVideo] Failed to attach stream:", err);
        }
      });
      stop = stopFn;
    })();

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      try { stop?.(); } catch {}
      startedRef.current = false;
    };
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