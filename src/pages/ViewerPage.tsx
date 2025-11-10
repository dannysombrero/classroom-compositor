import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { startViewer } from "../utils/webrtc";
import { attachStreamToVideo } from "../utils/webrtc";


export default function ViewerPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startedRef = useRef(false);
  const userTapRef = useRef(false);

  const [needsTap, setNeedsTap] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [iceState, setIceState] = useState<string>("new");

  const tryPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    const p = v.play();
    if (p && typeof p.then === "function") {
      p.then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
    }
  };

  const attachStreamAndAutoplay = async (stream: MediaStream) => {
    const v = videoRef.current!;
    // Use shared helper to attach and handle ready/play plumbing
    try {
      await attachStreamToVideo(v, stream);
    } catch (e) {
      console.warn("[VIEWER] attachStreamToVideo failed, falling back", e);
      if (v.srcObject !== stream) v.srcObject = stream;
    }

    // Ensure attributes for mobile autoplay policies
    v.muted = true;
    v.playsInline = true;

    if (stream.getTracks().length > 0) setConnecting(false);

    // Best-effort autoplay (some browsers still require a tap)
    const p = v.play?.();
    if (p && typeof p.then === "function") {
      p.then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
    }

    // First-frame watchdog: if no frames arrive quickly, try play() again
    const watchdog = setTimeout(async () => {
      if (!v) return;
      try {
        if (v.readyState < 2 || v.paused) {
          console.log("▶ [VIEWER] Watchdog nudging video.play()");
          await v.play();
          setNeedsTap(false);
        }
      } catch (e) {
        // Autoplay may still be blocked; overlay/button will remain
        console.warn("⚠️ [VIEWER] Watchdog play() failed:", e);
      }
    }, 1500);

    // Clear watchdog once we actually have data buffered
    const onLoadedData = () => {
      clearTimeout(watchdog);
    };
    v.addEventListener("loadeddata", onLoadedData, { once: true });

    const onFirstResize = () => {
      clearTimeout(watchdog);
      v.removeEventListener("resize", onFirstResize);
      if (v.paused) { v.play().catch(() => setNeedsTap(true)); }
    };
    v.addEventListener("resize", onFirstResize);
    (v as any).__onFirstResize = onFirstResize;
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

      const onIce = () => {
        setIceState(pc.iceConnectionState);
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setConnecting(false);
        }
      };
      pc.addEventListener("iceconnectionstatechange", onIce);
      onIce();

      const v = videoRef.current;
      if (v) {
        const onResize = () => {
          console.log("[VIEWER] video resize →", v.videoWidth, "x", v.videoHeight);
          if (v.videoWidth && v.videoHeight) {
            setConnecting(false);
            if (v.paused) tryPlay();
          }
        };
        v.addEventListener("resize", onResize);
        v.onloadedmetadata = () => tryPlay();

        // Store remover on the element so we can cleanly remove in cleanup
        (v as any).__onResize = onResize;
      }

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
      if (v && (v as any).__onResize) {
        v.removeEventListener("resize", (v as any).__onResize);
        delete (v as any).__onResize;
      }
      if (v && (v as any).__onFirstResize) {
        try { v.removeEventListener("resize", (v as any).__onFirstResize); } catch {}
        try { delete (v as any).__onFirstResize; } catch {}
      }
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
    <div style={styles.page}>
      <div style={{ ...styles.card, width: "100%", maxWidth: 980 }}>
        <div style={styles.cardHeader}>
          <div>
            <div style={styles.cardTitle}>Viewer</div>
            <div style={styles.cardSubtle}>Session: {sessionId}</div>
          </div>
          <div style={styles.help}>ICE: {iceState}</div>
        </div>

        <div style={styles.cardBody}>
          <div style={styles.videoWrap}>
            <video
              ref={videoRef}
              style={styles.videoEl}
              autoPlay
              playsInline
              muted
              controls={false}
            />
            {showOverlay && (
              <div style={styles.overlayCenter}>
                <div style={styles.overlayChip}>
                  {connecting && <span style={styles.spinner} />}
                  <span>{needsTap ? "Tap to Play" : "Loading stream…"}</span>
                </div>
                {needsTap && (
                  <button onClick={handleTapToPlay} style={styles.btn}>
                    Play
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: 10, ...styles.help }}>
            If nothing appears after a few seconds, your network may be blocking P2P and a TURN server is required.
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0b0b0b",
    padding: 16,
  },
  card: {
    background: "#151515",
    border: "1px solid #2a2a2a",
    borderRadius: 12,
    boxShadow: "0 10px 30px rgba(0,0,0,.35)",
    color: "#eee",
    width: "100%",
  },
  cardHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: "1px solid #242424",
  },
  cardTitle: { fontSize: 20, fontWeight: 600, lineHeight: 1.1 },
  cardSubtle: { fontSize: 12, opacity: 0.7, marginTop: 4 },
  cardBody: { padding: 16 },
  videoWrap: {
    position: "relative",
    background: "#000",
    width: "100%",
    aspectRatio: "16 / 9",
    borderRadius: 8,
    overflow: "hidden",
  },
  videoEl: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    background: "#000",
  },
  overlayCenter: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    pointerEvents: "none",
    gap: 8,
  },
  overlayChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(0,0,0,.6)",
    border: "1px solid rgba(255,255,255,.2)",
    backdropFilter: "blur(6px)",
    color: "#fff",
    pointerEvents: "auto",
  },
  spinner: {
    width: 14,
    height: 14,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,.3)",
    borderTopColor: "#fff",
    display: "inline-block",
    animation: "spin 0.9s linear infinite",
  },
  btn: {
    marginTop: 12,
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.25)",
    background: "rgba(255,255,255,.08)",
    color: "#fff",
    pointerEvents: "auto",
    cursor: "pointer",
  },
  help: { fontSize: 12, opacity: 0.7 },
};