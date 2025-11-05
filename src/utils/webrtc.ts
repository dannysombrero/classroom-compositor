// src/utils/webrtc.ts
import { db, collection, addDoc, onSnapshot, doc, setDoc, getDoc } from "../firebase";

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
  if (ICE_URLS.length) {
    // Merge STUN and TURN into a single ICE server entry when creds exist; browsers will use what applies.
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

// small helper: resolve when ICE gets connected/completed, or timeout
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
      if (s === "failed" || s === "disconnected" || s === "closed") {
        // let timer resolve(false)
      }
    };
    pc.addEventListener("iceconnectionstatechange", onChange);
  });
}

async function buildPeer(role: PeerRole, forceRelay: boolean): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection(rtcConfig(forceRelay));
  // Optional: tighter candidate policy in very strict envs (Chrome only)
  // (pc as any).setConfiguration?.({ iceCandidatePoolSize: 0 });
  return pc;
}

/* ---------------- Host side ---------------- */

export async function startHost(sessionId: string, stream: MediaStream) {
  // Try direct first (unless force relay is explicitly true)
  let pc = await buildPeer("host", FORCE_RELAY);
  stream.getTracks().forEach(t => pc.addTrack(t, stream));

  const offersDoc = doc(db, "sessions", sessionId, "offers", "latest");
  const answersCol = collection(db, "sessions", sessionId, "answers");
  const candHostCol = collection(db, "sessions", sessionId, "candidates_host");

  pc.onicecandidate = async (e) => {
    if (e.candidate) await addDoc(candHostCol, { candidate: e.candidate.toJSON(), at: Date.now() });
  };

  const offer = await pc.createOffer({ offerToReceiveVideo: false, offerToReceiveAudio: false });
  await pc.setLocalDescription(offer);
  await setDoc(offersDoc, { type: "offer", sdp: offer.sdp, at: Date.now() });

  // answers & viewer candidates listener
  const unsubAns = onSnapshot(answersCol, async (snap) => {
    for (const ch of snap.docChanges()) {
      if (ch.type !== "added") continue;
      const data = ch.doc.data() as any;
      if (data?.type === "answer" && data?.sdp && !pc.currentRemoteDescription) {
        try { await pc.setRemoteDescription(new RTCSessionDescription(data)); } catch {}
      } else if (data?.candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
      }
    }
  });

  // If we’re not forced to relay, try fallback after a grace period
  if (!FORCE_RELAY) {
    const ok = await waitForConnected(pc, FALLBACK_MS);
    if (!ok) {
      // fallback: rebuild as relay-only
      try {
        pc.getSenders().forEach(s => s.track?.stop());
        pc.close();
      } catch {}
      pc = await buildPeer("host", true);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.onicecandidate = async (e) => {
        if (e.candidate) await addDoc(candHostCol, { candidate: e.candidate.toJSON(), at: Date.now() });
      };
      const off2 = await pc.createOffer({ offerToReceiveVideo: false, offerToReceiveAudio: false });
      await pc.setLocalDescription(off2);
      await setDoc(offersDoc, { type: "offer", sdp: off2.sdp, at: Date.now(), forcedRelay: true });
      // answers listener continues to work (same collection)
    }
  }

  return {
    pc,
    stop() {
      unsubAns();
      try { pc.getSenders().forEach(s => s.track?.stop()); } catch {}
      try { pc.close(); } catch {}
    },
  };
}

/* ---------------- Viewer side ---------------- */

export async function startViewer(sessionId: string) {
  // fetch the current offer first (if a relay-only refresh happened, you’ll get that newest SDP)
  const offerSnap = await getDoc(doc(db, "sessions", sessionId, "offers", "latest"));
  const offData = offerSnap.data() as any;
  if (!offData?.sdp) throw new Error("No offer from host yet.");

  let pc = await buildPeer("viewer", FORCE_RELAY);
  const remoteStream = new MediaStream();

  pc.ontrack = (e) => {
    const [stream] = e.streams;
    if (stream) stream.getTracks().forEach(t => remoteStream.addTrack(t));
  };

  const answersCol = collection(db, "sessions", sessionId, "answers");
  const candHostCol = collection(db, "sessions", sessionId, "candidates_host");
  const candViewerCol = collection(db, "sessions", sessionId, "candidates_viewer");

  pc.onicecandidate = async (e) => {
    if (e.candidate) await addDoc(candViewerCol, { candidate: e.candidate.toJSON(), at: Date.now(), from: "viewer" });
  };

  await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: offData.sdp }));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await addDoc(answersCol, { type: "answer", sdp: answer.sdp, at: Date.now() });

  // host ICE listener
  const unsubHostCand = onSnapshot(candHostCol, async (snap) => {
    for (const ch of snap.docChanges()) {
      if (ch.type !== "added") continue;
      const data = ch.doc.data() as any;
      if (data?.candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
      }
    }
  });

  if (!FORCE_RELAY) {
    const ok = await waitForConnected(pc, FALLBACK_MS);
    if (!ok) {
      // If the host has refreshed its offer to relay-only, re-pull offer and re-join
      unsubHostCand();
      try { pc.close(); } catch {}
      const latest = await getDoc(doc(db, "sessions", sessionId, "offers", "latest"));
      const od = latest.data() as any;
      if (!od?.sdp) throw new Error("No offer available.");
      pc = await buildPeer("viewer", true);
      const remote2 = new MediaStream();
      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (stream) stream.getTracks().forEach(t => remote2.addTrack(t));
      };
      pc.onicecandidate = async (e) => {
        if (e.candidate) await addDoc(candViewerCol, { candidate: e.candidate.toJSON(), at: Date.now(), from: "viewer" });
      };
      await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: od.sdp }));
      const ans2 = await pc.createAnswer();
      await pc.setLocalDescription(ans2);
      await addDoc(answersCol, { type: "answer", sdp: ans2.sdp, at: Date.now(), relay: true });
      // re-listen to host ICE
      onSnapshot(candHostCol, async (snap) => {
        for (const ch of snap.docChanges()) {
          if (ch.type !== "added") continue;
          const data = ch.doc.data() as any;
          if (data?.candidate) {
            try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
          }
        }
      });
      return {
        pc,
        stream: remote2,
        stop() { try { pc.close(); } catch {} },
      };
    }
  }

  return {
    pc,
    stream: remoteStream,
    stop() { try { pc.close(); } catch {} },
  };
}