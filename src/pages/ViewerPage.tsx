import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Signaling } from "../utils/signaling";

export default function ViewerPage() {
  const { sessionId } = useParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection>();
  const sigRef = useRef<Signaling>();

  useEffect(() => {
    console.log("[viewer] param sessionId:", sessionId);
    if (!sessionId) return;
    (async () => {
      const sig = new Signaling();
      sigRef.current = sig;

      await sig.connect("http://localhost:8787", sessionId, "viewer");

      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pcRef.current = pc;

      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
        }
      };

      sig.onSignal = async (from, payload) => {
        if (from !== "host") return;
        if (payload.type === "offer") {
          await pc.setRemoteDescription(payload);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sig.sendSignal(answer);
        } else if (payload.candidate) {
          try { await pc.addIceCandidate(payload); } catch {}
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) sig.sendSignal({ candidate: e.candidate });
      };
    })();
  }, [sessionId]);

  return <video ref={videoRef} autoPlay playsInline className="w-full h-full bg-black" />;
}