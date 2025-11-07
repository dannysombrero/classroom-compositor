import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { startViewer } from "../utils/webrtc";

export default function ViewerPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startedRef = useRef(false);
  const userTapRef = useRef(false);

  const [needsTap, setNeedsTap] = useState(false);
  const [connecting, setConnecting] = useState(true);   // show overlay until ready
  const [iceState, setIceState] = useState<string>("new");

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

    // As soon as we have tracks, we can drop "connecting"
    if (stream.getTracks().length > 0) setConnecting(false);

    if (userTapRef.current) {
      tryPlay();
      return;
    }
    tryPlay();
  };

  useEffect(() => {
    if (!sessionId) return;
    if (startedRef.current) return;
    startedRef.current = true;

    let stopFn: (() => void) | null = null;

    (async () => {
      console.log("[viewer] starting for session:", sessionId);
      const { pc, stop } = await startViewer(sessionId, attachStreamAndAutoplay);
      stopFn = stop;

      // Track ICE state to drive overlay UX
      const onIce = () => {
        setIceState(pc.iceConnectionState);
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setConnecting(false);
        }
      };
      pc.addEventListener("iceconnectionstatechange", onIce);
      onIce();

      // If metadata comes late, retry play
      const v = videoRef.current;
      if (v) v.onloadedmetadata = () => tryPlay();

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
      if (v?.srcObject) {
        (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        v.srcObject = null;
      }
    };
  }, [sessionId]);

  const handleTapToPlay = () => {
    userTapRef.current = true;
    tryPlay();
  };

  const showOverlay = connecting || needsTap;

  return (
    <div className="page">
      <div className="card" style={{ width: "100%", maxWidth: 980 }}>
        <div className="card-header">
          <div className="row">
            <div className="card-title">Viewer</div>
            <div className="card-subtle">Session: {sessionId}</div>
          </div>
          <div className="help">ICE: {iceState}</div>
        </div>
        <div className="card-body">
          <div className="video-wrap">
            <video
              ref={videoRef}
              className="video-el"
              autoPlay
              playsInline
              muted
              controls={false}
            />
            {showOverlay && (
              <div className="overlay-center">
                <div className="overlay-chip">
                  {connecting && <span className="spinner" />}
                  <span>
                    {needsTap ? "Tap to Play" : "Loading stream…"}
                  </span>
                </div>
                {needsTap && (
                  <button
                    onClick={handleTapToPlay}
                    className="btn"
                    style={{ marginTop: 12 }}
                  >
                    Play
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={{ marginTop: 10 }} className="help">
            If nothing appears after a few seconds, the connection may be blocked by your network or a TURN server
            may be required.
          </div>
        </div>
      </div>
    </div>
  );
}