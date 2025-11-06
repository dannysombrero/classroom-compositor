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
  
function ensureVideoSender(pc: RTCPeerConnection, sender: RTCRtpSender | null): RTCRtpSender {
  if (sender && pc.getSenders().includes(sender)) return sender;
  const existing = pc.getSenders().find(s => s.track?.kind === "video");
  if (existing) return existing;
  const tx = pc.addTransceiver("video", { direction: "sendonly" });
  return tx.sender;
}
  
  function ensureAudioSender(pc: RTCPeerConnection, sender: RTCRtpSender | null): RTCRtpSender {
    if (sender && pc.getSenders().includes(sender)) return sender;
    const existing = pc.getSenders().find(s => s.track?.kind === "audio");
    if (existing) return existing;
    const tx = pc.addTransceiver("audio", { direction: "sendonly" });
    return tx.sender;
  }

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

async function safeAddIceCandidate(pc: RTCPeerConnection, cand: RTCIceCandidateInit) {
  if (!pc.remoteDescription) {
    throw new Error("safeAddIceCandidate called before SRD");
  }
  const mids = pc.getTransceivers().map(t => t.mid);
  if (!cand.sdpMid && cand.sdpMLineIndex != null && mids[cand.sdpMLineIndex]) {
    cand = { ...cand, sdpMid: mids[cand.sdpMLineIndex] };
  }
  if (cand.sdpMid && !mids.includes(cand.sdpMid) && cand.sdpMLineIndex != null && mids[cand.sdpMLineIndex]) {
    cand = { ...cand, sdpMid: mids[cand.sdpMLineIndex] };
  }
  await pc.addIceCandidate(new RTCIceCandidate(cand));
}

// --- SDP helpers ---
function sdpHasMediaKind(sdp: string | undefined | null, kind: "audio" | "video"): boolean {
  if (!sdp) return false;
  const needle = `\nm=${kind} `;
  return sdp.indexOf(needle) !== -1;
}

export async function attachStreamToVideo(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
  (video as any).srcObject = stream;
  video.muted = true;
  (video as any).playsInline = true;
  video.autoplay = true;
  if (video.readyState < 2) {
    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => { video.onloadedmetadata = null; resolve(); };
    });
  }
  try {
    await video.play();
  } catch (err) {
    console.warn("video.play was blocked by autoplay policy.", err);
  }
}

// Create a loading/placeholder video track using a canvas animation.
export function createLoadingSlateTrack(
  text: string = "Waiting for presenter…",
  w: number = 640,
  h: number = 360,
  fps: number = 5
): MediaStreamTrack {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  function drawFrame(tick: number) {
    ctx.fillStyle = "#111"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff"; ctx.font = "24px sans-serif";
    const dots = ".".repeat((tick % 4));
    const msg = `${text}${dots}`;
    const m = ctx.measureText(msg);
    ctx.fillText(msg, (w - m.width) / 2, Math.floor(h / 2));
  }

  let tick = 0;
  let raf = 0;
  const animate = () => { tick++; drawFrame(tick); raf = requestAnimationFrame(animate); };
  drawFrame(tick);
  raf = requestAnimationFrame(animate);

  const stream: MediaStream | undefined = (canvas as any).captureStream?.(fps);
  const track = stream?.getVideoTracks()[0];
  if (!track) {
    cancelAnimationFrame(raf);
    throw new Error("Canvas captureStream not supported");
  }
  track.addEventListener("ended", () => cancelAnimationFrame(raf));
  return track;
}

// ---- Host handle ----
export interface HostHandle {
    stop(keepPc?: boolean): Promise<void>;
  }

let pc: RTCPeerConnection | null = null;
let videoSender: RTCRtpSender | null = null;
let audioSender: RTCRtpSender | null = null;
let startingHost = false; // prevents double-click races
let liveHandle: HostHandle | null = null;
let pendingViewerCandidates: RTCIceCandidateInit[] = [];


// Firestore unsubscribers for host side
let unsubViewerAnswers: (() => void) | null = null;
let unsubViewerCandidates: (() => void) | null = null;

export async function stopHost(keepPc = false): Promise<void> {
    // Unsubscribe Firestore listeners
    if (unsubViewerAnswers) { unsubViewerAnswers(); unsubViewerAnswers = null; }
    if (unsubViewerCandidates) { unsubViewerCandidates(); unsubViewerCandidates = null; }
  
    // Detach tracks to avoid accidental reuse
    if (videoSender) await videoSender.replaceTrack(null);
    if (audioSender) await audioSender.replaceTrack(null);
  
    // Stop any live tracks (closes share bubble)
    pc?.getSenders().forEach((s: RTCRtpSender) => {
      const t = s.track;
      if (t) t.stop();
    });
  
    if (!keepPc) {
      pc?.getTransceivers().forEach((t: RTCRtpTransceiver) => t.stop());
      try { pc?.close(); } catch {}
      pc = null;
      videoSender = null;
      audioSender = null;
    }
  
    liveHandle = null;
  }

// utils/webrtc.ts
export interface StartHostOpts {
  displayStream?: MediaStream;
  micStream?: MediaStream;
  forceRelay?: boolean;
  sendAudio?: boolean; // new: default false
  requireDisplay?: boolean;   // if true, force getDisplayMedia when displayStream not provided
  loadingText?: string;       // custom text for placeholder slate
}
  
export async function startHost(
  sessionId: string,
  opts?: StartHostOpts
): Promise<HostHandle> {
  if (startingHost) {
    if (liveHandle) return liveHandle;
    throw new Error("Host start already in progress");
  }
  if (liveHandle) return liveHandle;

  if (!pc) pc = await buildPeer("host", opts?.forceRelay ?? FORCE_RELAY);

  startingHost = true;
  try {
    // --- Decide initial video: screen if provided/required, else loading slate ---
    let screenTrack: MediaStreamTrack | null = null;
    if (opts?.displayStream) {
      screenTrack = opts.displayStream.getVideoTracks()[0] ?? null;
    } else if (opts?.requireDisplay) {
      const displayStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
      screenTrack = displayStream.getVideoTracks()[0] ?? null;
      if (!screenTrack) {
        displayStream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        throw new Error("No video track from display capture");
      }
    }

    const vSender = (videoSender = ensureVideoSender(pc!, videoSender));
    if (screenTrack) {
      try { (screenTrack as any).contentHint = "detail"; } catch {}
      await vSender.replaceTrack(screenTrack);
      if (screenTrack.muted) {
        const onUnmute = async () => {
          screenTrack!.removeEventListener("unmute", onUnmute);
          try { await vSender.replaceTrack(screenTrack!); } catch {}
        };
        screenTrack.addEventListener("unmute", onUnmute, { once: true });
      }
      screenTrack.onended = async () => {
        try {
          const placeholder = createLoadingSlateTrack(opts?.loadingText ?? "Waiting for presenter…");
          await vSender.replaceTrack(placeholder);
        } catch {}
      };
    } else {
      const placeholder = createLoadingSlateTrack(opts?.loadingText ?? "Waiting for presenter…");
      await vSender.replaceTrack(placeholder);
    }

    // Optional audio
    if (opts?.sendAudio || opts?.micStream) {
      const micStream =
        opts?.micStream ?? (await navigator.mediaDevices.getUserMedia({ audio: true, video: false }));
      const micTrack = micStream.getAudioTracks()[0];
      if (!micTrack) {
        micStream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        throw new Error("No audio track from microphone");
      }
      const aSender = (audioSender = ensureAudioSender(pc!, audioSender));
      await aSender.replaceTrack(micTrack);
    }

    // ---- Firestore signaling ----
    const offersDoc = doc(db, "sessions", sessionId, "offers", "latest");
    const answersCol = collection(db, "sessions", sessionId, "answers");
    const candHostCol = collection(db, "sessions", sessionId, "candidates_host");
    const candViewerCol = collection(db, "sessions", sessionId, "candidates_viewer");

    const tag = Date.now();

    pc.onicecandidate = async (e) => {
      if (!e.candidate) return;
      try {
        const myUfrag = getUfrag(pc?.localDescription ?? null);
        await addDoc(candHostCol, {
          candidate: e.candidate.toJSON(),
          at: Date.now(),
          from: "host",
          tag,
          ufrag: myUfrag,
        });
      } catch (err) {
        console.warn("[host] addIceCandidate(host) write failed", err);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await setDoc(offersDoc, { type: "offer", sdp: offer.sdp, at: tag, tag });

    // SRD watchdog (diagnose blocked listeners)
    setTimeout(() => {
      if (!pc?.remoteDescription) {
        console.warn("[host] SRD still not set ~4s after offer. Firestore listener may be blocked.");
      }
    }, 4000);

    console.log("[host] mids:", pc.getTransceivers().map((t) => t.mid));
    console.log("[host] SRD set?", !!pc.remoteDescription);

    // Buffer viewer ICE until SRD applied
    pendingViewerCandidates = [];
    if (unsubViewerCandidates) { unsubViewerCandidates(); unsubViewerCandidates = null; }
    unsubViewerCandidates = onSnapshot(
      candViewerCol,
      async (snap) => {
        for (const ch of snap.docChanges()) {
          if (ch.type !== "added") continue;
          const data = ch.doc.data() as any;
          const dbg = data.candidate as RTCIceCandidateInit;
          console.log("[host] incoming viewer cand:", { mid: dbg?.sdpMid, idx: dbg?.sdpMLineIndex });
          if (data?.tag !== tag || !data?.candidate) continue;

          const cand: RTCIceCandidateInit = data.candidate;
          if (!pc?.remoteDescription) {
            const c: any = { ...cand };
            (c as any).ufrag = (data && typeof data.ufrag === "string") ? data.ufrag : undefined;
            pendingViewerCandidates.push(c);
            continue;
          }
          const expectedUfrag = getUfrag(pc.remoteDescription ?? null);
          const candUfrag = (data && typeof data.ufrag === "string") ? data.ufrag : undefined;
          if (expectedUfrag && candUfrag && candUfrag !== expectedUfrag) {
            console.warn("[host] skipping viewer cand due to ufrag mismatch", { candUfrag, expectedUfrag });
            continue;
          }
          try {
            await safeAddIceCandidate(pc, cand);
          } catch (err) {
            console.warn("[host] addIceCandidate(viewer) failed", err);
          }
        }
      },
      (err) => console.warn("[host] candViewer onSnapshot error:", err)
    );

    if (unsubViewerAnswers) { unsubViewerAnswers(); unsubViewerAnswers = null; }
    unsubViewerAnswers = onSnapshot(
      answersCol,
      async (snap) => {
        for (const ch of snap.docChanges()) {
          if (ch.type !== "added") continue;
          const data = ch.doc.data() as any;
          if (data?.tag !== tag || !data?.sdp) continue;

          try {
            if (pc?.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(
                new RTCSessionDescription({ type: "answer", sdp: data.sdp })
              );
              const expectedUfrag = getUfrag(pc.remoteDescription ?? null);
              for (const queued of pendingViewerCandidates) {
                const queuedUfrag = (queued as any).ufrag as string | undefined;
                if (expectedUfrag && queuedUfrag && queuedUfrag !== expectedUfrag) {
                  console.warn("[host] skipping queued viewer cand due to ufrag mismatch", { queuedUfrag, expectedUfrag });
                  continue;
                }
                try { await safeAddIceCandidate(pc, queued); }
                catch (err) { console.warn("[host] safeAddIceCandidate(queued) failed", err, queued); }
              }
              pendingViewerCandidates = [];
            }
          } catch (err) {
            console.warn("[host] setRemoteDescription(answer) failed", err);
          }
        }
      },
      (err) => console.warn("[host] answers onSnapshot error:", err)
    );

    liveHandle = { stop: async (keepPc = false) => { await stopHost(keepPc); } };
    return liveHandle;
  } finally {
    startingHost = false;
  }
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
  const answersCol = collection(db, "sessions", sessionId, "answers");
  const candHostCol = collection(db, "sessions", sessionId, "candidates_host");
  const candViewerCol = collection(db, "sessions", sessionId, "candidates_viewer");

  await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: offerData.sdp }));
  const remoteUfrag = getUfrag(pc.remoteDescription);

  // Always be ready to receive video; add audio if present in offer
  const offerSdp = pc.remoteDescription?.sdp ?? undefined;
  const hasAudio = sdpHasMediaKind(offerSdp, "audio");
  pc.addTransceiver("video", { direction: "recvonly" });
  if (hasAudio) pc.addTransceiver("audio", { direction: "recvonly" });

  pc.onicecandidate = async (e) => {
    if (!e.candidate) return;
    const myUfrag = getUfrag(pc.localDescription);
    await addDoc(candViewerCol, {
      candidate: e.candidate.toJSON(),
      at: Date.now(),
      from: "viewer",
      tag,
      ufrag: myUfrag,
    });
  };

  const viewerStream = new MediaStream();
  pc.ontrack = (ev) => {
    const track = ev.track;
    const inbound = ev.streams?.[0] ?? new MediaStream([track]);

    inbound.getTracks().forEach((t) => {
      const already = viewerStream.getTracks().some((x) => x.id === t.id);
      if (!already) viewerStream.addTrack(t);
    });

    if (track.kind === "video" && track.muted) {
      console.log("[viewer] video track muted; waiting for frames…");
      const once = () => {
        track.removeEventListener("unmute", once);
        console.log("[viewer] video track unmuted; delivering stream");
        onStream(viewerStream);
      };
      track.addEventListener("unmute", once, { once: true });
      return;
    }

    onStream(viewerStream);
    console.log("[viewer] ontrack fired; stream tracks:", viewerStream.getTracks().map((t) => t.kind));
  };

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await addDoc(answersCol, { type: "answer", sdp: answer.sdp, at: Date.now(), tag });

  let unsubHostCand: (() => void) | undefined;
  unsubHostCand = onSnapshot(
    candHostCol,
    async (snap) => {
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
    },
    (err) => console.warn("[viewer] candHost onSnapshot error:", err)
  );

  return {
    pc,
    stop() {
      try { unsubHostCand?.(); } catch {}
      try { pc.close(); } catch {}
    },
  };
}