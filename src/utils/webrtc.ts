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
  const hostPc = getPc();
  if (!hostPc) {
    console.warn("[replaceHostVideoTrack] No peer connection");
    return;
  }
  
  if (!videoSender) {
    console.warn("[replaceHostVideoTrack] No video sender");
    return;
  }
  
  try {
    console.log("🎥 [HOST] Replacing video track with:", newTrack ? "canvas track" : "null");
    await videoSender.replaceTrack(newTrack);
    
    if (newTrack) {
      const dummyStream = new MediaStream([newTrack]);
      videoSender.setStreams(dummyStream);
      console.log("✅ [HOST] Stream associated with sender");
    }
    
    // Nudge a first frame for canvas/synthetic tracks
    try { (videoSender as any)?.track?.requestFrame?.(); } catch {}
    
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

    const tryPlay = async () => {
      try { await video.play(); } catch (err) {
        console.warn("video.play was blocked by autoplay policy.", err);
      }
    };

    // Kick on metadata or first resize, whichever comes first (first dimensioned frame)
    let done = false;
    const onMeta = () => {
      if (done) return; done = true;
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("resize", onResize);
      void tryPlay();
    };
    const onResize = () => {
      if (done) return; done = true;
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("resize", onResize);
      void tryPlay();
    };

    video.addEventListener("loadedmetadata", onMeta, { once: true });
    video.addEventListener("resize", onResize, { once: true });

    // If it's already ready, play now
    if (video.readyState >= 2) {
      done = true;
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("resize", onResize);
      await tryPlay();
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
// Safety valve: limit re-offer retries per tag to avoid loops
const srdRetryCountByTag = new Map<number, number>();

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

  // 🔧 CRITICAL FIX: Always create fresh peer connection to avoid ufrag mismatches
  // If pc exists from a previous session, close it first
  if (pc) {
    console.log("🔄 [startHost] Closing existing peer connection from previous session...");
    try {
      pc.getTransceivers().forEach((t: RTCRtpTransceiver) => t.stop());
      pc.close();
    } catch (e) {
      console.warn("⚠️ [startHost] Error closing old peer connection:", e);
    }
    pc = null;
    videoSender = null;
    audioSender = null;
  }

  pc = await buildPeer("host", opts?.forceRelay ?? FORCE_RELAY);
  if (!pc) throw new Error("Failed to create RTCPeerConnection");
  
  startingHost = true;
  const tag = Date.now();
  const hostPc = getPc();

  try {
    // --- Decide initial video: screen if provided/required, else loading slate ---
    let screenTrack: MediaStreamTrack | null = null;
    
    if (opts?.displayStream) {
      screenTrack = opts.displayStream.getVideoTracks()[0] ?? null;
      console.log("📹 [startHost] Using provided displayStream, track:", screenTrack ? "YES" : "NO");
    } else if (opts?.requireDisplay) {
      const displayStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
      screenTrack = displayStream.getVideoTracks()[0] ?? null;
      if (!screenTrack) {
        displayStream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        throw new Error("No video track from display capture");
      }
      console.log("📹 [startHost] Captured display via getDisplayMedia");
    }
    
    const vSender = (videoSender = ensureVideoSender(hostPc, videoSender));
    
    // Ensure sender has an associated stream so SDP gets proper a=msid lines.
    try {
      vSender.setStreams(new MediaStream());
      console.log("🪪 [HOST] setStreams applied to video sender");
    } catch (e) {
      console.warn("⚠️ [HOST] setStreams not supported?", e);
    }

    if (screenTrack) {
      // Use the real screen track
      try { (screenTrack as any).contentHint = "detail"; } catch {}
      await vSender.replaceTrack(screenTrack);
      
      const streamWithTrack = new MediaStream([screenTrack]);
      vSender.setStreams(streamWithTrack);
      console.log("✅ [startHost] Stream associated with sender (before offer)");
      
      console.log("✅ [startHost] Canvas track added to sender:", {
        trackId: screenTrack.id,
        readyState: screenTrack.readyState,
        enabled: screenTrack.enabled,
        muted: screenTrack.muted,
        label: screenTrack.label
      });
      
      // Nudge first frame
      try { (vSender as any)?.track?.requestFrame?.(); } catch {}

      if (screenTrack.muted) {
        const onUnmute = async () => {
          screenTrack.removeEventListener("unmute", onUnmute);
          try { await vSender.replaceTrack(screenTrack); } catch {}
        };
        screenTrack.addEventListener("unmute", onUnmute, { once: true });
      }

      screenTrack.onended = async () => {
        try {
          const placeholder = createLoadingSlateTrack(opts?.loadingText ?? "Waiting for presenter…");
          await vSender.replaceTrack(placeholder);
          try { (vSender as any)?.track?.requestFrame?.(); } catch {}
        } catch {}
      };
    } else {
      // No display provided; send a placeholder slate
      const placeholder = createLoadingSlateTrack(opts?.loadingText ?? "Waiting for presenter…");
      await vSender.replaceTrack(placeholder);
      try { (vSender as any)?.track?.requestFrame?.(); } catch {}
      console.log("⚠️ [startHost] Using placeholder track (no displayStream provided)");
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
      if (!e.candidate) { console.log("✅ [HOST] ICE gathering complete"); return; }

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
          tag,                 // <-- scope by current offer
          ufrag: myUfrag,      // <-- include ufrag
        });

        console.log("✅ [HOST] ICE candidate written successfully");
      } catch (err) {
        console.error("💥 [HOST] FAILED to write ICE candidate:", err);
      }
    };

    const offer = await hostPc.createOffer();

    console.log("📝 [HOST] Offer SDP contains video?", offer.sdp?.includes("m=video"));
    console.log("📝 [HOST] Offer SDP preview:", offer.sdp?.substring(0, 200));
    const senders = hostPc.getSenders();
    const videoSenderObj = senders.find(s => s.track?.kind === "video");
    console.log("📹 [HOST] Video sender at offer time:", {
      hasSender: !!videoSenderObj,
      hasTrack: !!videoSenderObj?.track,
      trackId: videoSenderObj?.track?.id,
      trackReadyState: videoSenderObj?.track?.readyState
    });

    await hostPc.setLocalDescription(offer);

    // Publish the offer with tag + ufrag
    await setDoc(offersDoc, {
      type: "offer",
      sdp: offer.sdp,
      at: tag,
      tag,
      ufrag: getUfrag(offer),
    });

    // ADD THESE AFTER setDoc closes:
    console.log("📤 [HOST] Offer written to Firestore, checking...");
    const checkDoc = await getDoc(offersDoc);
    const storedSdp = checkDoc.data()?.sdp;
    console.log("🔍 [HOST] SDP match?", storedSdp === offer.sdp);
    console.log("🔍 [HOST] Stored SDP has msid?", storedSdp?.includes("a=msid"));

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
          if (!data?.candidate) continue;
          if (data?.tag !== tag) continue; // <-- ignore different offer

          const cand: RTCIceCandidateInit = data.candidate;
          if (!hostPc.remoteDescription) {
            const c: any = { ...cand, ufrag: typeof data.ufrag === "string" ? data.ufrag : undefined };
            pendingViewerCandidates.push(c);
            continue;
          }
          const expectedUfrag = getUfrag(hostPc.remoteDescription ?? null);
          const candUfrag = (typeof data.ufrag === "string") ? data.ufrag : undefined;
          if (expectedUfrag && candUfrag && candUfrag !== expectedUfrag) {
            console.warn("[host] skipping viewer cand due to ufrag mismatch", { candUfrag, expectedUfrag });
            continue;
          }
          try {
            await safeAddIceCandidate(hostPc, cand);
            console.log("✅ [HOST] Added viewer ICE", cand.candidate?.substring?.(0, 60));
          } catch (err) {
            console.warn("❌ [HOST] addIceCandidate(viewer) failed", err);
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
        if (!snap.exists()) { console.log("⚠️ [HOST] Answer doc doesn't exist yet"); return; }

        const data = snap.data() as any;
        console.log("📦 [HOST] Answer data received:", data ? JSON.stringify(data).substring(0, 200) : "null");
        if (!data?.sdp) { console.log("❌ [HOST] No SDP field in answer document"); return; }

        // 🚫 IMPORTANT: only accept the answer if it matches THIS offer/tag
        if (Number(data.tag) !== Number(tag)) {
          console.log("↪️ [HOST] Ignoring answer for a different tag", { expected: tag, got: data.tag });
          return;
        }

        const canApplySRD = hostPc.signalingState === "have-local-offer" && !hostPc.remoteDescription;

        if (canApplySRD) {
          console.log("✅ [HOST] Calling setRemoteDescription with answer...");
          try {
            await hostPc.setRemoteDescription(
              new RTCSessionDescription({ type: "answer", sdp: data.sdp })
            );
            console.log("🎉 [HOST] SRD SUCCESS! Remote description is set!");
            console.log("🔌 [HOST] ICE connection state:", hostPc.iceConnectionState);
          } catch (err) {
            console.error("💥 [HOST] setRemoteDescription(answer) failed:", err);
            return;
          }
        } else {
          // Safety valve: if an answer arrives when we're not in 'have-local-offer',
          // try a one-time re-offer with ICE restart and republish the offer
          const already = srdRetryCountByTag.get(tag) ?? 0;
          if (already < 1) {
            console.warn("⚠️ [HOST] Answer arrived out-of-phase; re-offering with iceRestart");
            try {
              const re = await hostPc.createOffer({ iceRestart: true });
              await hostPc.setLocalDescription(re);
              await setDoc(offersDoc, {
                type: "offer",
                sdp: re.sdp,
                at: Date.now(),
                tag,
                ufrag: getUfrag(re)
              }, { merge: true });
              srdRetryCountByTag.set(tag, already + 1);
              // Wait for a fresh, tag-matched answer
              return;
            } catch (reErr) {
              console.error("💥 [HOST] Re-offer (iceRestart) failed; proceeding without restart", reErr);
            }
          } else {
            console.log("ℹ️ [HOST] Skipping SRD and already retried once; proceeding to drain ICE.");
          }
        }

        // Drain buffered candidates (respect ufrag)
        const expectedUfrag = getUfrag(hostPc.remoteDescription ?? ({ sdp: data.sdp } as any));
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
      },
      (err) => {
        console.error("🔥 [HOST] Answer listener error:", err);
      }
    );

    // Fallback fetch (kept)
    setTimeout(async () => {
      if (!hostPc.remoteDescription) {
        console.warn("⏰ [HOST] SRD still not set ~4s after offer. Trying fallback fetch...");
        try {
          const snap = await getDoc(answersDoc);
          console.log("📋 [HOST] Fallback fetch result, exists:", snap.exists());
          const data = snap.data() as any;
          if (data?.sdp && hostPc.signalingState === "have-local-offer" && Number(data.tag) === Number(tag)) {
            console.log("✅ [HOST] Fallback found answer, applying...");
            await hostPc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: data.sdp }));
            console.log("🎉 [HOST] SRD set via fallback fetch!");
          } else {
            console.warn("❌ [HOST] Fallback fetch found no valid answer (or wrong tag)");
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

  // --- Prepare to receive before SRD (fixes flaky ontrack/black video in some browsers) ---
  const offerSdpText = offerData.sdp as string;
  const offerHasAudio = sdpHasMediaKind(offerSdpText, "audio");

  // Pre-declare recv-only transceivers BEFORE SRD
  viewerPc.addTransceiver("video", { direction: "recvonly" });
  if (offerHasAudio) viewerPc.addTransceiver("audio", { direction: "recvonly" });

  // Prefer VP8 then H264 on the receiving side
  try {
    const caps = RTCRtpReceiver.getCapabilities && RTCRtpReceiver.getCapabilities("video");
    if (caps && caps.codecs && caps.codecs.length) {
      const prefer = [
        ...caps.codecs.filter(c => /VP8/i.test(c.mimeType)),
        ...caps.codecs.filter(c => /H264/i.test(c.mimeType)),
        ...caps.codecs.filter(c => !/VP8|H264/i.test(c.mimeType)),
      ];
      // Best-effort: pick the video recv transceiver
      const vRx =
        viewerPc.getTransceivers().find(t => t.receiver?.track?.kind === "video") ??
        viewerPc.getTransceivers().find(t => t.direction === "recvonly");
      if (vRx && (vRx as any).setCodecPreferences) {
        (vRx as any).setCodecPreferences(prefer);
        console.log("[VIEWER] setCodecPreferences(video) ->", prefer.map(c => c.mimeType));
      }
    }
  } catch (e) {
    console.warn("[VIEWER] setCodecPreferences(video) not supported", e);
  }

  // Set up ontrack BEFORE SRD so first frames aren't missed
  const viewerStream = new MediaStream();
  viewerPc.ontrack = (ev) => {
    console.log("🎥 [VIEWER] ontrack event fired!", {
      kind: ev.track.kind,
      id: ev.track.id,
      readyState: ev.track.readyState,
      muted: ev.track.muted,
      streams: ev.streams?.length || 0
    });

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

  // --- Fallback: if ontrack is flaky, attach via receiver polling
  let deliveredViaOntrack = false;
  const originalOntrack = viewerPc.ontrack;
  viewerPc.ontrack = (ev: RTCTrackEvent) => {
    deliveredViaOntrack = true;
    originalOntrack?.call(viewerPc, ev as any);
  };

  const receiverFallbackStart = Date.now();
  const receiverFallbackTimer = setInterval(() => {
    // Stop after ~6s
    if (Date.now() - receiverFallbackStart > 6000) {
      clearInterval(receiverFallbackTimer);
      return;
    }
    if (deliveredViaOntrack) {
      clearInterval(receiverFallbackTimer);
      return;
    }
    const vids = viewerPc.getReceivers().filter(r => r.track && r.track.kind === "video");
    const v0 = vids[0]?.track;
    if (v0 && v0.readyState !== "ended") {
      console.log("🛟 [VIEWER] Receiver fallback attaching stream");
      try {
        const ms = new MediaStream([v0]);
        onStream(ms);
        // best-effort nudge for first frame on some GPUs
        (v0 as any).requestFrame?.();
      } catch (e) {
        console.warn("⚠️ [VIEWER] Receiver fallback failed", e);
      }
      clearInterval(receiverFallbackTimer);
    }
  }, 250);

  // Now apply the remote offer
  await viewerPc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: offerData.sdp }));
  const remoteUfrag = getUfrag(viewerPc.remoteDescription);

  console.log("🎬 [VIEWER] Creating answer...");
  const answer = await viewerPc.createAnswer();
  console.log("✅ [VIEWER] Answer created, setting as local description...");
  
  await viewerPc.setLocalDescription(answer);
  console.log("✅ [VIEWER] setLocalDescription complete");
  // Debug: inbound video stats probe (every 2s)
  try {
    let lastBytes = 0, lastFrames = 0;
    const statsTimer = setInterval(async () => {
      try {
        const stats = await viewerPc.getStats();
        stats.forEach((s: any) => {
          if (s.type === "inbound-rtp" && s.kind === "video") {
            const bytes = s.bytesReceived ?? 0;
            const frames = s.framesDecoded ?? 0;
            const dB = bytes - lastBytes;
            const dF = frames - lastFrames;
            lastBytes = bytes; lastFrames = frames;
            console.log(`[VIEWER][stats] inbound video bytes:+${dB} framesDecoded:+${dF}`);
          }
        });
      } catch {}
    }, 2000);
    viewerPc.addEventListener("connectionstatechange", () => {
      if (["closed","failed","disconnected"].includes(viewerPc.connectionState)) {
        clearInterval(statsTimer);
      }
    });
  } catch {}
  console.log("🔍 [VIEWER] ICE gathering state:", viewerPc.iceGatheringState);
  console.log("🔍 [VIEWER] Signaling state:", viewerPc.signalingState);

  // After await viewerPc.setLocalDescription(answer);
  const myUfrag = getUfrag(answer) || getUfrag(viewerPc.localDescription) || null;

  // Publish the answer (unchanged)
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

  // 🚀 Publish viewer ICE candidates with tag + ufrag
  viewerPc.onicecandidate = (e) => {
    if (!e.candidate) {
      console.log("✅ [VIEWER] ICE gathering complete (null candidate)");
      return;
    }
    console.log("🧊 [VIEWER] ICE -> publishing", e.candidate.candidate.substring(0, 60));
    addDoc(candViewerCol, {
      candidate: e.candidate.toJSON(),
      at: Date.now(),
      from: "viewer",
      tag,
      ufrag: myUfrag,
    }).then(() => {
      console.log("✅ [VIEWER] candidate published");
    }).catch((err) => console.warn("[VIEWER] failed to write ICE", err));
  };

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
        // (lenient; only enforce if tag present)
        if (data && "tag" in data && data.tag !== tag) {
          // Different offer cycle — ignore
          continue;
        }
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
