import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, doc, getDoc } from "../firebase";
import { startViewer } from "../utils/webrtc";

export default function ViewerPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"connecting" | "ready" | "oops">("connecting");

  useEffect(() => {
    if (!sessionId) { setStatus("oops"); return; }

    let stop: (() => void) | null = null;

    (async () => {
      try {
        // Optional: bail if the session is explicitly inactive
        const s = await getDoc(doc(db, "sessions", sessionId));
        if (s.exists() && (s.data() as any)?.active === false) {
          navigate("/join?error=inactive", { replace: true });
          return;
        }

        // Start Firestore/WebRTC viewer
        const v = await startViewer(sessionId);
        stop = v.stop;

        if (videoRef.current) {
          // Ensure autoplay works by muting
          videoRef.current.muted = true;
          // Attach remote stream
          videoRef.current.srcObject = v.stream;
          // Try to play (ignore autoplay errors)
          await videoRef.current.play().catch(() => {});
        }

        setStatus("ready");
        console.log("[viewer] connected to session:", sessionId);
      } catch (e) {
        console.error("[viewer] failed to connect:", e);
        setStatus("oops");
      }
    })();

    return () => { try { stop?.(); } catch {} };
  }, [sessionId, navigate]);

  if (status === "oops") {
    return <div className="w-screen h-screen grid place-items-center text-red-500">Can’t connect to session.</div>;
  }

  return (
    <div className="w-screen h-screen bg-black grid place-items-center">
      <video ref={videoRef} autoPlay playsInline className="max-w-full max-h-full" />
    </div>
  );
}