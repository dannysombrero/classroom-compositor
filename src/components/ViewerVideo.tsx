// src/components/ViewerVideo.tsx
import { useEffect, useRef } from "react";
import { startViewer, attachStreamToVideo } from "../utils/webrtc";

type Props = { sessionId: string };

export default function ViewerVideo({ sessionId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stop: (() => void) | undefined;

    (async () => {
      const { stop: stopFn } = await startViewer(sessionId, async (stream) => {
        const el = videoRef.current;
        if (!el) return;
        await attachStreamToVideo(el, stream);
      });
      stop = stopFn;
    })();

    return () => { try { stop?.(); } catch {} };
  }, [sessionId]);

  return (
    <video
      ref={videoRef}
      style={{ width: "100%", height: "100%", background: "#000" }}
    />
  );
}