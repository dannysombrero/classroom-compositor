// src/utils/webrtc.ts
import { db, collection, addDoc, onSnapshot, doc, setDoc, getDoc } from "../firebase";
import { getDocs, query, where } from "firebase/firestore";


// Track which sessions have already published an answer from this tab
const publishedAnswersFor = new Set<string>();


// Helper to log selected ICE candidate pair (must be in scope before buildPeer)
async function logSelectedPair(pc: RTCPeerConnection, label: string) {
  try {
    const stats = await pc.getStats();
    let pair: any, local: any, remote: any;

    stats.forEach((s) => {
      if (s.type === "transport" && (s as any).selectedCandidatePairId) {
        pair = stats.get((s as any).selectedCandidatePairId);
      }
    });
    if (!pair) {
      stats.forEach((s) => {
        if (s.type === "candidate-pair" && (s as any).selected) pair = s;
      });
    }
    if (pair) {
      local = stats.get(pair.localCandidateId);
      remote = stats.get(pair.remoteCandidateId);
      console.log(`[webrtc] ${label} selected pair`, {
        state: pair.state,
        nominated: pair.nominated,
        local: local && { type: local.candidateType, protocol: local.protocol, address: local.address, port: local.port },
        remote: remote && { type: remote.candidateType, protocol: remote.protocol, address: remote.address, port: remote.port },
      });
    } else {
      console.warn(`[webrtc] ${label} no selected candidate pair`);
    }
  } catch (e) {
    console.warn("[webrtc] getStats failed", e);
  }
}

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

  // --- Host track swap helpers (no renegotiation needed) ---
/**
 * Swap the host VIDEO track without renegotiation.
 * Use `await` in async flows (e.g., inside an `async` click handler):
 *   const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
 *   await replaceHostVideoTrack(stream.getVideoTracks()[0]);
 * Or use the fire-and-forget helper:
 *   setHostVideoTrack(track)
 */
export async function replaceHostVideoTrack(newTrack: MediaStreamTrack | null) {
  if (!pc) {
    console.warn("[replaceHostVideoTrack] PeerConnection not initialized; skipping video swap until Go Live.");
    return;
  }
  
  const hostPc = pc;
  const vSender = (videoSender = ensureVideoSender(hostPc, videoSender));
  
  try {
    console.log("🎥 [HOST] Replacing video track with:", newTrack ? "canvas track" : "null");
    await vSender.replaceTrack(newTrack);
    console.log("✅ [HOST] Video track replaced successfully");
  } catch (err) {
    console.error("💥 [HOST] Failed to replace video track:", err);
  }
}

/**
 * Swap the host AUDIO track without renegotiation. Accepts `null` to detach.
 */
export async function replaceHostAudioTrack(track: MediaStreamTrack | null): Promise<void> {
  if (!pc) {
    console.warn("[replaceHostAudioTrack] PeerConnection not initialized; skipping audio swap until Go Live.");
    return;
  }
  const sender = (audioSender = ensureAudioSender(pc, audioSender));
  await sender.replaceTrack(track);
}

/**
 * Convenience wrappers when you don't care about awaiting the swap (e.g., UI button handlers).
 * They catch and log errors to avoid unhandled promise rejections.
 */
export function setHostVideoTrack(track: MediaStreamTrack | null): void {
  replaceHostVideoTrack(track).catch((err) => console.warn("[webrtc] setHostVideoTrack failed", err));
}

export function setHostAudioTrack(track: MediaStreamTrack | null): void {
  replaceHostAudioTrack(track).catch((err) => console.warn("[webrtc] setHostAudioTrack failed", err));
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

// ---- TURN config helpers ----
const ICE_URLS: string[] = (() => {
    try { return JSON.parse(import.meta.env.VITE_TURN_URLS || "[]"); }
    catch { return []; }
})();
const HAS_TURN = ICE_URLS.some(u => u.includes("turn:") || u.includes("turns:"));
const TURN_AUTH = {
    username: import.meta.env.VITE_TURN_USERNAME,
    credential: import.meta.env.VITE_TURN_CREDENTIAL,
};
const FORCE_RELAY = import.meta.env.VITE_ICE_FORCE_RELAY === "true";
const FALLBACK_MS = Number(import.meta.env.VITE_ICE_FALLBACK_MS || 8000);

// ✅ Put the log *after* the declarations
console.log("[webrtc] TURN urls=", ICE_URLS, "HAS_TURN=", HAS_TURN);

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
  
  // CRITICAL: Never use relay mode without TURN configured
  const shouldUseRelay = forceRelay && HAS_TURN;
  if (forceRelay && !HAS_TURN) {
    console.warn("[webrtc] Relay mode requested but no TURN configured - using 'all' policy instead");
  }
  
  return {
    iceServers: servers,
    iceTransportPolicy: shouldUseRelay ? "relay" : "all",
    bundlePolicy: "max-bundle",
    iceCandidatePoolSize: 1,
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
  const config = rtcConfig(forceRelay);
  console.log(`🔧 [${role}] Creating PeerConnection with config:`, JSON.stringify(config, null, 2));
  
  const pc = new RTCPeerConnection(config);
  
  console.log(`✅ [${role}] PeerConnection created, iceGatheringState:`, pc.iceGatheringState);
  
  pc.onicegatheringstatechange = () => {
      console.log(`🔄 [webrtc] ${role} gathering:`, pc.iceGatheringState);
  };
  
  pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log(`🔌 [webrtc] ${role} ice:`, s);
      if (s === "connected" || s === "completed") {
        void logSelectedPair(pc, role);
      } else if (s === "failed") {
        void logSelectedPair(pc, `${role} (failed)`);
      }
  };
  
  pc.onconnectionstatechange = () => {
      console.log(`⚡ [webrtc] ${role} conn:`, pc.connectionState);
  };
  
  pc.onicecandidate = (e) => {
      if (e.candidate) {
          console.log(`🧊 [${role}] ICE candidate generated:`, {
              type: e.candidate.type,
              protocol: e.candidate.protocol,
              address: e.candidate.address,
              port: e.candidate.port,
              candidate: e.candidate.candidate.substring(0, 80)
          });
      } else {
          console.log(`✅ [${role}] ICE gathering complete (null candidate)`);
      }
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

// Fallback: one-shot fetch for answers when listener may be blocked (no composite index)
async function tryFetchAnswerOnce(answersColRef: any, tag: number, pcRef: RTCPeerConnection | null): Promise<boolean> {
  try {
    // Avoid composite index by not using orderBy/limit; filter client-side
    const q = query(answersColRef, where("tag", "==", tag));
    const snap = await getDocs(q);
    if (!pcRef || pcRef.signalingState !== "have-local-offer") return false;
    if (snap.empty) return false;

    let latest: any = null;
    snap.forEach((d: any) => {
      const data = d.data() as any;
      if (!data?.sdp) return;
      if (!latest || (Number(data.at) || 0) > (Number(latest.at) || 0)) latest = data;
    });

    if (!latest?.sdp) return false;
    await pcRef.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: latest.sdp }));
    console.log("[host] SRD set via fallback fetch (answers, no-index)");
    return true;
  } catch (err) {
    console.warn("[host] tryFetchAnswerOnce error", err);
    return false;
  }
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

function getPc(): RTCPeerConnection {
    if (!pc) throw new Error("PeerConnection not initialized");
    return pc;
  }

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
  if (!pc) throw new Error("Failed to create RTCPeerConnection");
  
  startingHost = true;
  const tag = Date.now();
  const hostPc = getPc();
  
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

    const vSender = (videoSender = ensureVideoSender(hostPc, videoSender));
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
      const aSender = (audioSender = ensureAudioSender(hostPc, audioSender));
      await aSender.replaceTrack(micTrack);
    }
    
    // ---- Firestore signaling ----
    const offersDoc = doc(db, "sessions", sessionId, "offers", "latest");
    const candHostCol = collection(db, "sessions", sessionId, "candidates_host");
    const candViewerCol = collection(db, "sessions", sessionId, "candidates_viewer");

    hostPc.onicecandidate = async (e) => {
      console.log("🧊 [HOST] ICE candidate event fired, candidate:", e.candidate ? "YES" : "null (gathering complete)");
      
      if (!e.candidate) {
        console.log("✅ [HOST] ICE gathering complete");
        return;
      }
      
      try {
        const myUfrag = getUfrag(hostPc.localDescription);
        console.log("📤 [HOST] Writing ICE candidate to Firestore...", { 
          candidate: e.candidate.candidate.substring(0, 50),
          type: e.candidate.type 
        });
        
        await addDoc(candHostCol, {
          candidate: e.candidate.toJSON(),
          at: Date.now(),
          from: "host",
          tag,
          ufrag: myUfrag,
        });
        
        console.log("✅ [HOST] ICE candidate written successfully");
      } catch (err) {
        console.error("💥 [HOST] FAILED to write ICE candidate:", err);
      }
    };

    const offer = await hostPc.createOffer();
    await hostPc.setLocalDescription(offer);
    await setDoc(offersDoc, { type: "offer", sdp: offer.sdp, at: tag, tag });

    console.log("[host] mids:", hostPc.getTransceivers().map((t) => t.mid));
    console.log("[host] SRD set?", !!hostPc.remoteDescription);

    // Buffer viewer ICE until SRD applied
    pendingViewerCandidates = [];
    if (unsubViewerCandidates) { unsubViewerCandidates(); unsubViewerCandidates = null; }
    unsubViewerCandidates = onSnapshot(
      candViewerCol,
      async (snap) => {
        for (const ch of snap.docChanges()) {
          if (ch.type !== "added") continue;
          const data = ch.doc.data() as any;
          if (data?.tag !== tag || !data?.candidate) continue;

          const cand: RTCIceCandidateInit = data.candidate;
          if (!hostPc.remoteDescription) {
            const c: any = { ...cand };
            (c as any).ufrag = (data && typeof data.ufrag === "string") ? data.ufrag : undefined;
            pendingViewerCandidates.push(c);
            continue;
          }
          const expectedUfrag = getUfrag(hostPc.remoteDescription ?? null);
          const candUfrag = (data && typeof data.ufrag === "string") ? data.ufrag : undefined;
          if (expectedUfrag && candUfrag && candUfrag !== expectedUfrag) {
            console.warn("[host] skipping viewer cand due to ufrag mismatch", { candUfrag, expectedUfrag });
            continue;
          }
          try {
            await safeAddIceCandidate(hostPc, cand);
          } catch (err) {
            console.warn("[host] addIceCandidate(viewer) failed", err);
          }
        }
      },
      (err) => console.warn("[host] candViewer onSnapshot error:", err)
    );

    const answersDoc = doc(db, "sessions", sessionId, "answers", "latest");

    if (unsubViewerAnswers) { unsubViewerAnswers(); unsubViewerAnswers = null; }
    console.log("🎯 [HOST] Setting up answer listener at:", `sessions/${sessionId}/answers/latest`);

    unsubViewerAnswers = onSnapshot(
      answersDoc,
      async (snap) => {
        console.log("📨 [HOST] Answer snapshot triggered, exists:", snap.exists());
        
        if (!snap.exists()) {
          console.log("⚠️ [HOST] Answer doc doesn't exist yet");
          return;
        }
        
        const data = snap.data() as any;
        console.log("📦 [HOST] Answer data received:", data ? JSON.stringify(data).substring(0, 200) : "null");
        
        if (!data?.sdp) {
          console.log("❌ [HOST] No SDP field in answer document");
          return;
        }

        if (hostPc.signalingState !== "have-local-offer") {
          console.log(`⚠️ [HOST] Wrong signaling state: ${hostPc.signalingState}, expected 'have-local-offer'`);
          return;
        }

        try {
          console.log("✅ [HOST] Calling setRemoteDescription with answer...");
          await hostPc.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp: data.sdp })
          );
          console.log("🎉 [HOST] SRD SUCCESS! Remote description is set!");
          console.log("🔌 [HOST] ICE connection state:", hostPc.iceConnectionState);

          // Drain any queued ICE we buffered pre-SRD
          const expectedUfrag = getUfrag(hostPc.remoteDescription ?? null);
          for (const queued of pendingViewerCandidates) {
            const queuedUfrag = (queued as any).ufrag as string | undefined;
            if (expectedUfrag && queuedUfrag && queuedUfrag !== expectedUfrag) {
              console.warn("[host] skipping queued viewer cand due to ufrag mismatch", { queuedUfrag, expectedUfrag });
              continue;
            }
            try { await safeAddIceCandidate(hostPc, queued); }
            catch (err) { console.warn("[host] safeAddIceCandidate(queued) failed", err, queued); }
          }
          pendingViewerCandidates = [];
        } catch (err) {
          console.error("💥 [HOST] setRemoteDescription(answer) failed:", err);
        }
      },
      (err) => {
        console.error("🔥 [HOST] Answer listener error:", err);
      }
    );

    // Fallback fetch if snapshot listener hasn't fired
    setTimeout(async () => {
      if (!hostPc.remoteDescription) {
        console.warn("⏰ [HOST] SRD still not set ~4s after offer. Trying fallback fetch...");
        try {
          const snap = await getDoc(answersDoc);
          console.log("📋 [HOST] Fallback fetch result, exists:", snap.exists());
          
          const data = snap.data() as any;
          if (data?.sdp && hostPc.signalingState === "have-local-offer") {
            console.log("✅ [HOST] Fallback found answer, applying...");
            await hostPc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: data.sdp }));
            console.log("🎉 [HOST] SRD set via fallback fetch!");
          } else {
            console.warn("❌ [HOST] Fallback fetch found no valid answer");
          }
        } catch (err) {
          console.error("💥 [HOST] Fallback fetch error:", err);
        }
      } else {
        console.log("✅ [HOST] SRD already set, fallback not needed");
      }
    }, 4000);

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

  const viewerPc = await buildPeer("viewer", FORCE_RELAY);
  const answersCol = collection(db, "sessions", sessionId, "answers");
  const candHostCol = collection(db, "sessions", sessionId, "candidates_host");
  const candViewerCol = collection(db, "sessions", sessionId, "candidates_viewer");

  await viewerPc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: offerData.sdp }));
  const remoteUfrag = getUfrag(viewerPc.remoteDescription);

  // Always be ready to receive video; add audio if present in offer
  const offerSdp = viewerPc.remoteDescription?.sdp ?? undefined;
  const hasAudio = sdpHasMediaKind(offerSdp, "audio");
  viewerPc.addTransceiver("video", { direction: "recvonly" });
  if (hasAudio) viewerPc.addTransceiver("audio", { direction: "recvonly" });

  viewerPc.onicecandidate = async (e) => {
    console.log("🧊 [VIEWER] ICE candidate event fired, candidate:", e.candidate ? "YES" : "null (gathering complete)");
    
    if (!e.candidate) {
      console.log("✅ [VIEWER] ICE gathering complete");
      return;
    }
    
    const myUfrag = getUfrag(viewerPc.localDescription ?? null);
    console.log("📤 [VIEWER] Writing ICE candidate to Firestore...", {
      candidate: e.candidate.candidate.substring(0, 50),
      type: e.candidate.type
    });
    
    await addDoc(candViewerCol, {
      candidate: e.candidate.toJSON(),
      at: Date.now(),
      from: "viewer",
      tag,
      ufrag: myUfrag,
    }).catch((err) => {
      console.error("💥 [VIEWER] FAILED to write ICE candidate:", err);
    });
    
    console.log("✅ [VIEWER] ICE candidate written successfully");
  };

  const viewerStream = new MediaStream();
  viewerPc.ontrack = (ev) => {
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

  console.log("🎬 [VIEWER] Creating answer...");
  const answer = await viewerPc.createAnswer();
  console.log("✅ [VIEWER] Answer created, setting as local description...");
  
  await viewerPc.setLocalDescription(answer);
  console.log("✅ [VIEWER] setLocalDescription complete");
  console.log("🔍 [VIEWER] ICE gathering state:", viewerPc.iceGatheringState);
  console.log("🔍 [VIEWER] Signaling state:", viewerPc.signalingState);

  // Wait for ICE gathering to start (Firefox sometimes delays)
  if (viewerPc.iceGatheringState === "new") {
    console.log("⏳ [VIEWER] ICE gathering hasn't started yet, waiting up to 2s...");
    
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.warn("⚠️ [VIEWER] ICE gathering still 'new' after 2s");
        resolve();
      }, 2000);
      
      const checkState = () => {
        console.log("🔄 [VIEWER] ICE gathering state changed to:", viewerPc.iceGatheringState);
        if (viewerPc.iceGatheringState !== "new") {
          clearTimeout(timeout);
          viewerPc.removeEventListener("icegatheringstatechange", checkState);
          resolve();
        }
      };
      
      viewerPc.addEventListener("icegatheringstatechange", checkState);
      
      // Check immediately in case it already changed
      if (viewerPc.iceGatheringState !== "new") {
        clearTimeout(timeout);
        resolve();
      }
    });
  }

  console.log("🔍 [VIEWER] Final ICE gathering state:", viewerPc.iceGatheringState);

  try {
    const answersDoc = doc(db, "sessions", sessionId, "answers", "latest");
    console.log("📤 [VIEWER] About to publish answer to:", `sessions/${sessionId}/answers/latest`);
    console.log("📤 [VIEWER] Answer SDP preview:", answer.sdp?.substring(0, 100));
    
    const answerKey = sessionId;
    if (!publishedAnswersFor.has(answerKey)) {
      await setDoc(answersDoc, { type: "answer", sdp: answer.sdp, at: Date.now(), tag }, { merge: true });
      publishedAnswersFor.add(answerKey);
      console.log("✅ [VIEWER] Answer published successfully!", { sessionId, tag });
    } else {
      console.log("⚠️ [VIEWER] Skipped duplicate answer publish", { sessionId });
    }
  } catch (e) {
    console.error("💥 [VIEWER] FAILED to publish answer doc:", e);
  }

  let unsubHostCand: (() => void) | undefined;
  unsubHostCand = onSnapshot(
    candHostCol,
    async (snap) => {
      console.log("📥 [VIEWER] Received host candidates snapshot, docChanges:", snap.docChanges().length);
      for (const ch of snap.docChanges()) {
        if (ch.type !== "added") continue;
        const data = ch.doc.data() as any;
        if (!data?.candidate) continue;
        if (data?.tag !== tag) continue;
        if (remoteUfrag && data?.ufrag && data.ufrag !== remoteUfrag) continue;
        
        console.log("🧊 [VIEWER] Adding host candidate:", data.candidate.candidate?.substring(0, 60));
        try {
          await viewerPc.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log("✅ [VIEWER] Host candidate added successfully");
        } catch (err) {
          console.warn("❌ [VIEWER] addIceCandidate(host) failed", err);
        }
      }
    },
    (err) => console.warn("[viewer] candHost onSnapshot error:", err)
  );

  return {
    pc: viewerPc,
    stop() {
      try { unsubHostCand?.(); } catch {}
      try { viewerPc.close(); } catch {}
    },
  };
}
