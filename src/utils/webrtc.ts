// src/utils/webrtc.ts
import { db, collection, addDoc, onSnapshot, doc, setDoc, getDoc } from "../firebase";

/**
 * Extract ICE ufrag from either an SDP blob or a candidate line/init.
 * Accepts string SDP, RTCSessionDescriptionInit, RTCIceCandidateInit, or null/undefined.
 * Returns the ufrag string when found, otherwise null.
 */

// src/utils/webrtc.ts
import type {
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";

function getUfrag(
    value: string | RTCSessionDescriptionInit | RTCIceCandidateInit | null | undefined
  ): string | null {
    if (!value) return null;
  
    // Normalize to a string we can regex against
    let text = "";
    if (typeof value === "string") {
      text = value;
    } else if ((value as RTCSessionDescriptionInit).sdp) {
      text = (value as RTCSessionDescriptionInit).sdp ?? "";
    } else if ((value as RTCIceCandidateInit).candidate) {
      text = (value as RTCIceCandidateInit).candidate ?? "";
    }
  
    // SDP form: a=ice-ufrag:XXXX
    const sdpMatch = text.match(/^a=ice-ufrag:(.+)$/m);
    if (sdpMatch) {
      return sdpMatch[1].trim();
    }
  
    // Candidate form (some stacks include `ufrag XXXX`)
    const candMatch = text.match(/(?:\s|^)ufrag\s+([^\s]+)/);
    if (candMatch) {
      return candMatch[1];
    }
  
    return null;
  }

const ICE_URLS = (() => {
  try {
    return JSON.parse(import.meta.env.VITE_TURN_URLS || "[]");
  } catch { return []; }
})();
const TURN_AUTH = {
  username: import.meta.env.VITE_TURN_USERNAME,
  credential: import.meta.env.VITE_TURN_CREDENTIAL,
};
const FORCE_RELAY = import.meta.env.VITE_ICE_FORCE_RELAY === "true";
const FALLBACK_MS = Number(import.meta.env.VITE_ICE_FALLBACK_MS || 8000);

function rtcConfig(forceRelay = false): RTCConfiguration {
  const servers: RTCIceServer[] = [];
  // Always include default STUN
  servers.push({ urls: ["stun:stun.l.google.com:19302"] });
  if (ICE_URLS.length) {
    if (TURN_AUTH.username && TURN_AUTH.credential) {
      servers.push({
        urls: ICE_URLS,
        username: TURN_AUTH.username,
        credential: TURN_AUTH.credential,
      });
    } else {
      servers.push({ urls: ICE_URLS });
    }
  }
  return {
    iceServers: servers,
    iceTransportPolicy: forceRelay ? "relay" : "all",
  };
}

type PeerRole = "host" | "viewer";

function waitForConnected(pc: RTCPeerConnection, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
      return resolve(true);
    }
    const timer = setTimeout(() => resolve(false), timeoutMs);
    const onChange = () => {
      const s = pc.iceConnectionState;
      if (s === "connected" || s === "completed") {
        clearTimeout(timer);
        pc.removeEventListener("iceconnectionstatechange", onChange);
        resolve(true);
      }
    };
    pc.addEventListener("iceconnectionstatechange", onChange);
  });
}

async function buildPeer(role: PeerRole, forceRelay: boolean): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection(rtcConfig(forceRelay));
  pc.onicegatheringstatechange = () => console.log(`[webrtc] ${role} gathering:`, pc.iceGatheringState);
  pc.oniceconnectionstatechange = () => console.log(`[webrtc] ${role} ice:`, pc.iceConnectionState);
  pc.onconnectionstatechange = () => console.log(`[webrtc] ${role} conn:`, pc.connectionState);
  pc.onicecandidate = (e) => {
    if (e.candidate) console.log(`[webrtc] ${role} local cand:`, e.candidate.candidate);
  };
  return pc;
}

export async function startHost(sessionId: string, stream: MediaStream) {
    // (re)build with configured policy (may fallback later if you keep that path)
    let pc = await buildPeer("host", FORCE_RELAY);
  
    // Add tracks before creating the offer
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
  
    // Firestore refs
    const offersDoc = doc(db, "sessions", sessionId, "offers", "latest");
    const answersCol = collection(db, "sessions", sessionId, "answers");
    const candHostCol = collection(db, "sessions", sessionId, "candidates_host");
    const candViewerCol = collection(db, "sessions", sessionId, "candidates_viewer");
  
    // Tag this negotiation so we can ignore old ICE
    const tag = Date.now();
  
    // ✅ BEFORE createOffer
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    // Create offer
    const offer = await pc.createOffer({ offerToReceiveVideo: false, offerToReceiveAudio: false });
    await pc.setLocalDescription(offer);
    const localUfrag = getUfrag(pc.localDescription);
  
    await setDoc(offersDoc, { type: "offer", sdp: offer.sdp, at: tag, tag, forcedRelay: FORCE_RELAY === true });
  
    // Publish host ICE with tag + ufrag
    pc.onicecandidate = async (e) => {
      if (e.candidate) {
        await addDoc(candHostCol, {
          candidate: e.candidate.toJSON(),
          at: Date.now(),
          from: "host",
          tag,
          ufrag: localUfrag,
        });
      }
    };
  
    // Consume answers (only newest — once remote set, ignore others)
    const unsubAns = onSnapshot(answersCol, async (snap: QuerySnapshot<DocumentData>) => {
      for (const ch of snap.docChanges()) {
        if (ch.type !== "added") continue;
        const data = ch.doc.data() as any;
        if (data?.type !== "answer" || !data?.sdp) continue;
        if (data?.tag !== tag) {
          // stale answer from a prior offer — ignore
          continue;
        }
        if (!pc.currentRemoteDescription) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: data.sdp }));
            console.log("[host] set remote answer");
          } catch (err) {
            console.warn("[host] setRemoteDescription(answer) failed", err);
          }
        }
      }
    });
  
    // Consume viewer ICE for this tag and matching ufrag
    const unsubViewerCand = onSnapshot(candViewerCol, async (snap: QuerySnapshot<DocumentData>) => {
      const expectedUfrag = getUfrag(pc.remoteDescription);
      for (const ch of snap.docChanges()) {
        if (ch.type !== "added") continue;
        const data = ch.doc.data() as any;
        if (!data?.candidate) continue;
        if (data?.tag !== tag) continue; // stale for a previous offer
        if (expectedUfrag && data?.ufrag && data.ufrag !== expectedUfrag) {
          // "Unknown ufrag" prevention: ignore mismatched ICE
          continue;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log("[host] added viewer ICE");
        } catch (err) {
          console.warn("[host] addIceCandidate(viewer) failed", err);
        }
      }
    });
  
    return {
      pc,
      stop() {
        unsubAns();
        unsubViewerCand();
        try { pc.getSenders().forEach(s => s.track?.stop()); } catch {}
        try { pc.close(); } catch {}
      },
    };
  }
  
  /* ---------------- Viewer side ---------------- */
  
  export async function startViewer(
    sessionId: string,
    onStream: (stream: MediaStream) => void
  ) {
    const offersRef = doc(db, "sessions", sessionId, "offers", "latest");
    const offSnap = await getDoc(offersRef);
    const offerData = offSnap.data() as any;
    if (!offerData?.sdp) throw new Error("No offer from host yet.");
  
    const tag = offerData.tag ?? offerData.at ?? Date.now();
  
    const pc = await buildPeer("viewer", FORCE_RELAY);
  
    pc.ontrack = (ev) => {
      // Prefer unified stream if provided, otherwise wrap the track
      const stream = ev.streams?.[0] ?? new MediaStream([ev.track]);
      onStream(stream);
    };
  
    const answersCol = collection(db, "sessions", sessionId, "answers");
    const candHostCol = collection(db, "sessions", sessionId, "candidates_host");
    const candViewerCol = collection(db, "sessions", sessionId, "candidates_viewer");
  
    await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: offerData.sdp }));
    const remoteUfrag = getUfrag(pc.remoteDescription);
  
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
  
    await addDoc(answersCol, { type: "answer", sdp: answer.sdp, at: Date.now(), tag });
  
    pc.onicecandidate = async (e) => {
      if (e.candidate) {
        const myUfrag = getUfrag(pc.localDescription);
        await addDoc(candViewerCol, {
          candidate: e.candidate.toJSON(),
          at: Date.now(),
          from: "viewer",
          tag,
          ufrag: myUfrag,
        });
      }
    };

    // 👇 ensure the viewer is ready to receive
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });
  
    pc.ontrack = (ev) => {
      const stream = ev.streams?.[0] ?? new MediaStream([ev.track]);
      onStream(stream);
      console.log("[viewer] ontrack fired; stream tracks:", stream.getTracks().map(t => t.kind));
    };

    const unsubHostCand = onSnapshot(candHostCol, async (snap) => {
      for (const ch of snap.docChanges()) {
        if (ch.type !== "added") continue;
        const data = ch.doc.data() as any;
        if (!data?.candidate) continue;
        if (data?.tag !== tag) continue;
        if (remoteUfrag && data?.ufrag && data.ufrag !== remoteUfrag) continue;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.warn("[viewer] addIceCandidate(host) failed", err);
        }
      }
    });
  
    return {
      pc,
      stop() {
        unsubHostCand();
        try { pc.close(); } catch {}
      },
    };
  }