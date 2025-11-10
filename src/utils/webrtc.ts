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
  if (viewerConnections.size === 0) {
    console.warn("[replaceHostVideoTrack] No active viewer connections");
    return;
  }

  console.log("🎥 [HOST] Broadcasting video track to", viewerConnections.size, "viewers");

  const promises: Promise<void>[] = [];

  for (const [viewerId, conn] of viewerConnections.entries()) {
    const promise = (async () => {
      try {
        if (!conn.videoSender) {
          console.warn(`⚠️ [HOST] No video sender for viewer ${viewerId}, skipping`);
          return;
        }

        await conn.videoSender.replaceTrack(newTrack);

        if (newTrack) {
          const dummyStream = new MediaStream([newTrack]);
          conn.videoSender.setStreams(dummyStream);
        }

        // Nudge a first frame for canvas/synthetic tracks
        try { (conn.videoSender as any)?.track?.requestFrame?.(); } catch {}

        console.log("✅ [HOST] Video track replaced for viewer:", viewerId);
      } catch (err) {
        console.error(`💥 [HOST] Failed to replace video track for viewer ${viewerId}:`, err);
      }
    })();

    promises.push(promise);
  }

  await Promise.all(promises);
  console.log("✅ [HOST] Video track broadcast complete");
}

/**
 * Swap the host AUDIO track without renegotiation. Accepts `null` to detach.
 */
export async function replaceHostAudioTrack(track: MediaStreamTrack | null): Promise<void> {
  if (viewerConnections.size === 0) {
    console.warn("[replaceHostAudioTrack] No active viewer connections");
    return;
  }

  console.log("🎤 [HOST] Broadcasting audio track to", viewerConnections.size, "viewers");

  const promises: Promise<void>[] = [];

  for (const [viewerId, conn] of viewerConnections.entries()) {
    const promise = (async () => {
      try {
        if (conn.audioSender) {
          await conn.audioSender.replaceTrack(track);
          console.log("✅ [HOST] Audio track replaced for viewer:", viewerId);
        }
      } catch (err) {
        console.error(`💥 [HOST] Failed to replace audio track for viewer ${viewerId}:`, err);
      }
    })();

    promises.push(promise);
  }

  await Promise.all(promises);
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

/// ===== Multi-Viewer Support: Track per-viewer peer connections =====
interface ViewerConnection {
  pc: RTCPeerConnection;
  videoSender: RTCRtpSender | null;
  audioSender: RTCRtpSender | null;
  unsubCandidates: (() => void) | null;
  viewerId: string;
  createdAt: number;
}

// Map of viewerId -> connection details
const viewerConnections = new Map<string, ViewerConnection>();

let startingHost = false; // prevents double-click races
let liveHandle: HostHandle | null = null;
let currentSessionId: string | null = null;
let hostTag: number = 0;

// Firestore unsubscribers for host side (now per-viewer)
let unsubViewerAnswersCollection: (() => void) | null = null;
// Safety valve: limit re-offer retries per viewer to avoid loops
const srdRetryCountByViewer = new Map<string, number>();

export async function stopHost(keepPc = false): Promise<void> {
    console.log("🛑 [HOST] Stopping host, cleaning up", viewerConnections.size, "viewer connections");

    // Unsubscribe Firestore listeners
    if (unsubViewerAnswersCollection) {
      unsubViewerAnswersCollection();
      unsubViewerAnswersCollection = null;
    }

    // Close all viewer connections
    if (!keepPc) {
      for (const [viewerId, conn] of viewerConnections.entries()) {
        console.log("🔌 [HOST] Closing connection to viewer:", viewerId);
        try { conn.unsubCandidates?.(); } catch {}
        try { conn.pc.getTransceivers().forEach((t: RTCRtpTransceiver) => t.stop()); } catch {}
        try { conn.pc.close(); } catch {}
      }
      viewerConnections.clear();
    }

    currentSessionId = null;
    liveHandle = null;
  }

/**
 * Helper: Create answer for a viewer's offer
 * Called when a new viewer offer arrives
 */
async function handleViewerOffer(
  sessionId: string,
  viewerId: string,
  offerData: any,
  videoTrack: MediaStreamTrack | null,
  audioTrack: MediaStreamTrack | null,
  tag: number
): Promise<void> {
  console.log("🆕 [HOST] Creating answer for viewer offer:", viewerId);

  // Create fresh peer connection for this viewer
  const viewerPc = await buildPeer("host", FORCE_RELAY);

  // 🔧 Set up ICE candidate handling BEFORE setRemoteDescription
  const candHostCol = collection(db, "sessions", sessionId, "candidates_host");
  const candViewerCol = collection(db, "sessions", sessionId, `candidates_viewer_${viewerId}`);

  // Set onicecandidate handler BEFORE creating answer
  viewerPc.onicecandidate = async (e) => {
    if (!e.candidate) {
      console.log("✅ [HOST] ICE gathering complete for viewer:", viewerId);
      return;
    }

    try {
      const myUfrag = getUfrag(viewerPc.localDescription);
      await addDoc(candHostCol, {
        candidate: e.candidate.toJSON(),
        at: Date.now(),
        from: "host",
        tag,
        ufrag: myUfrag,
        viewerId, // Tag candidates with viewerId
      });
      console.log("✅ [HOST] ICE candidate published for viewer:", viewerId);
    } catch (err) {
      console.error(`💥 [HOST] Failed to write ICE candidate for viewer ${viewerId}:`, err);
    }
  };

  // Apply viewer's offer as remote description FIRST
  // This creates transceivers from the viewer's offer
  console.log("📥 [HOST] Setting remote description (viewer's offer)");
  await viewerPc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: offerData.sdp }));

  // Now get the transceivers that were created from the remote offer
  const transceivers = viewerPc.getTransceivers();
  console.log("📊 [HOST] Transceivers after applying offer:", transceivers.length);

  // Find video and audio transceivers and attach our tracks
  let vSender: RTCRtpSender | null = null;
  let aSender: RTCRtpSender | null = null;

  for (const transceiver of transceivers) {
    console.log(`📡 [HOST] Transceiver ${transceiver.mid}:`, {
      kind: transceiver.receiver.track.kind,
      direction: transceiver.direction,
      currentDirection: transceiver.currentDirection
    });

    if (transceiver.receiver.track.kind === "video" && !vSender) {
      vSender = transceiver.sender;

      // Ensure transceiver is set to send
      if (transceiver.direction === "recvonly" || transceiver.direction === "inactive") {
        transceiver.direction = "sendrecv";
        console.log("🔄 [HOST] Changed video transceiver direction to sendrecv");
      }

      if (videoTrack) {
        await vSender.replaceTrack(videoTrack);
        const streamWithTrack = new MediaStream([videoTrack]);
        vSender.setStreams(streamWithTrack);
        console.log("✅ [HOST] Video track attached for viewer:", viewerId, {
          trackId: videoTrack.id,
          readyState: videoTrack.readyState,
          enabled: videoTrack.enabled,
          transceiverDirection: transceiver.direction
        });
      }
    } else if (transceiver.receiver.track.kind === "audio" && !aSender) {
      aSender = transceiver.sender;

      // Ensure transceiver is set to send
      if (transceiver.direction === "recvonly" || transceiver.direction === "inactive") {
        transceiver.direction = "sendrecv";
        console.log("🔄 [HOST] Changed audio transceiver direction to sendrecv");
      }

      if (audioTrack) {
        await aSender.replaceTrack(audioTrack);
        console.log("✅ [HOST] Audio track attached for viewer:", viewerId);
      }
    }
  }

  if (!vSender) {
    console.error("💥 [HOST] No video transceiver found after applying offer!");
  }

  // Create answer
  console.log("🎬 [HOST] Creating answer for viewer:", viewerId);
  const answer = await viewerPc.createAnswer();

  // Set answer as local description
  await viewerPc.setLocalDescription(answer);
  console.log("✅ [HOST] Answer created and set as local description");

  // Publish answer to Firestore
  const answersDoc = doc(db, "sessions", sessionId, "answers", viewerId);
  await setDoc(answersDoc, {
    type: "answer",
    sdp: answer.sdp,
    at: Date.now(),
    tag,
    viewerId,
  });
  console.log("✅ [HOST] Answer published for viewer:", viewerId);

  // Listen for ICE candidates from this viewer
  const unsubCandidates = onSnapshot(
    candViewerCol,
    async (snap) => {
      const expectedUfrag = getUfrag(viewerPc.remoteDescription);

      for (const ch of snap.docChanges()) {
        if (ch.type !== "added") continue;
        const data = ch.doc.data() as any;
        if (!data?.candidate) continue;

        // Check ufrag match
        const candUfrag = data.ufrag;
        if (expectedUfrag && candUfrag && candUfrag !== expectedUfrag) {
          console.warn(`[HOST][${viewerId}] Skipping candidate due to ufrag mismatch`);
          continue;
        }

        try {
          await viewerPc.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log(`✅ [HOST] Added ICE candidate for viewer ${viewerId}`);
        } catch (err) {
          console.warn(`❌ [HOST] Failed to add ICE candidate for viewer ${viewerId}:`, err);
        }
      }
    },
    (err) => console.warn(`[HOST][${viewerId}] Candidate listener error:`, err)
  );

  // Track this connection
  viewerConnections.set(viewerId, {
    pc: viewerPc,
    videoSender: vSender,
    audioSender: aSender,
    unsubCandidates,
    viewerId,
    createdAt: Date.now(),
  });

  console.log("🎉 [HOST] Answer complete for viewer:", viewerId);
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

  // Clean up any existing connections
  if (viewerConnections.size > 0) {
    console.log("🔄 [startHost] Closing existing viewer connections...");
    await stopHost(false);
  }

  startingHost = true;
  currentSessionId = sessionId;
  hostTag = Date.now();

  // Keep references to tracks so we can attach them to each viewer connection
  let currentVideoTrack: MediaStreamTrack | null = null;
  let currentAudioTrack: MediaStreamTrack | null = null;

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

    if (screenTrack) {
      try { (screenTrack as any).contentHint = "detail"; } catch {}
      currentVideoTrack = screenTrack;
      console.log("✅ [startHost] Video track ready:", {
        trackId: screenTrack.id,
        readyState: screenTrack.readyState,
        enabled: screenTrack.enabled,
        muted: screenTrack.muted,
        label: screenTrack.label
      });
    } else {
      const placeholder = createLoadingSlateTrack(opts?.loadingText ?? "Waiting for presenter…");
      currentVideoTrack = placeholder;
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
      currentAudioTrack = micTrack;
    }

    // 🔧 NEW APPROACH: Don't create an offer
    // Instead, publish a "ready" signal and wait for viewer offers
    const readyDoc = doc(db, "sessions", sessionId, "host_ready", "status");
    const readyPath = `sessions/${sessionId}/host_ready/status`;

    console.log("📝 [HOST] About to write ready signal to:", readyPath);
    console.log("📝 [HOST] SessionId:", sessionId);

    try {
      await setDoc(readyDoc, {
        ready: true,
        at: hostTag,
        tag: hostTag,
        hasVideo: !!currentVideoTrack,
        hasAudio: !!currentAudioTrack,
      });
      console.log("✅ [HOST] Published ready signal successfully");
    } catch (err) {
      console.error("💥 [HOST] FAILED to write ready signal:", err);
      console.error("💥 [HOST] Error details:", {
        name: (err as any).name,
        code: (err as any).code,
        message: (err as any).message,
        sessionId,
        readyPath,
      });
      throw err;
    }

    console.log("🎯 [HOST] Current tag:", hostTag);
    console.log("🎯 [HOST] Video track ready:", !!currentVideoTrack);
    console.log("🎯 [HOST] Audio track ready:", !!currentAudioTrack);

    // 🔧 Listen for viewer OFFERS (role reversal)
    // Each viewer creates an offer, host creates answer
    const offersCol = collection(db, "sessions", sessionId, "offers");

    console.log("🎯 [HOST] Setting up offer collection listener at:", `sessions/${sessionId}/offers/`);

    if (unsubViewerAnswersCollection) {
      unsubViewerAnswersCollection();
      unsubViewerAnswersCollection = null;
    }

    unsubViewerAnswersCollection = onSnapshot(
      offersCol,
      async (snap) => {
        console.log("📨 [HOST] Offer collection snapshot triggered!");
        console.log("📨 [HOST] Total docs in collection:", snap.size);
        console.log("📨 [HOST] Document changes:", snap.docChanges().length);
        console.log("📨 [HOST] Change types:", snap.docChanges().map(ch => `${ch.type}:${ch.doc.id}`));

        if (snap.docChanges().length === 0) {
          console.log("⚠️ [HOST] No document changes in snapshot (might be initial empty snapshot)");
        }

        for (const ch of snap.docChanges()) {
          if (ch.type !== "added") {
            console.log(`⏭️ [HOST] Skipping ${ch.type} change for doc:`, ch.doc.id);
            continue;
          }

          const viewerId = ch.doc.id;

          // Skip the old "latest" document if it exists
          if (viewerId === "latest") {
            console.log("⏭️ [HOST] Skipping legacy 'latest' offer document");
            continue;
          }

          const data = ch.doc.data() as any;

          console.log("📦 [HOST] New viewer offer from:", viewerId, "data:", {
            hasSDP: !!data?.sdp,
            tag: data?.tag,
            viewerId: data?.viewerId
          });

          // Validate offer data
          if (!data?.sdp) {
            console.warn("❌ [HOST] No SDP in offer from viewer:", viewerId);
            continue;
          }

          // Check tag matches current session
          if (Number(data.tag) !== Number(hostTag)) {
            console.log(`↪️ [HOST] Ignoring offer for different tag from viewer ${viewerId}`, {
              expected: hostTag,
              got: data.tag
            });
            continue;
          }

          // Skip if we already have a connection for this viewer
          if (viewerConnections.has(viewerId)) {
            console.log("⚠️ [HOST] Already have connection for viewer:", viewerId);
            continue;
          }

          // Create answer for this viewer
          console.log("🔨 [HOST] About to create answer for viewer:", viewerId);
          try {
            await handleViewerOffer(
              sessionId,
              viewerId,
              data,
              currentVideoTrack,
              currentAudioTrack,
              hostTag
            );
            console.log("✅ [HOST] Successfully created answer for viewer:", viewerId);
            console.log("📊 [HOST] Total active viewers:", viewerConnections.size);
          } catch (err) {
            console.error(`💥 [HOST] Failed to create answer for viewer ${viewerId}:`, err);
            console.error("Stack trace:", err);
          }
        }
      },
      (err) => {
        console.error("🔥 [HOST] Offer collection listener error:", err);
      }
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
  // 🆔 Generate unique viewer ID for multi-viewer support
  const viewerId = crypto.randomUUID ? crypto.randomUUID() : `viewer_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  console.log("🆔 [VIEWER] Generated unique viewer ID:", viewerId);

  // 🔧 NEW APPROACH: Wait for host ready signal instead of fetching offer
  const readyDoc = doc(db, "sessions", sessionId, "host_ready", "status");
  const readySnap = await getDoc(readyDoc);
  const readyData = readySnap.data() as any;

  if (!readyData?.ready) {
    throw new Error("Host is not ready yet. Please wait for the host to start streaming.");
  }

  const tag = readyData.tag ?? readyData.at ?? Date.now();
  const hasVideo = readyData.hasVideo ?? true;
  const hasAudio = readyData.hasAudio ?? false;

  console.log("✅ [VIEWER] Host is ready, tag:", tag, "hasVideo:", hasVideo, "hasAudio:", hasAudio);

  const viewerPc = await buildPeer("viewer", FORCE_RELAY);
  const candHostCol = collection(db, "sessions", sessionId, "candidates_host");
  const candViewerCol = collection(db, "sessions", sessionId, `candidates_viewer_${viewerId}`);

  // Pre-declare recv-only transceivers
  viewerPc.addTransceiver("video", { direction: "recvonly" });
  if (hasAudio) viewerPc.addTransceiver("audio", { direction: "recvonly" });

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

      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let delivered = false;

      const deliverStream = () => {
        if (delivered) return;
        delivered = true;
        if (timeoutId) clearTimeout(timeoutId);
        console.log("[viewer] video track unmuted; delivering stream");
        onStream(viewerStream);
      };

      // Try unmute event first (Chrome/modern browsers)
      track.addEventListener("unmute", deliverStream, { once: true });

      // 🔧 FIREFOX FIX: Fallback timeout (unmute never fires on Firefox canvas tracks)
      timeoutId = setTimeout(() => {
        console.log("⏰ [viewer] unmute timeout - delivering anyway (Firefox fix)");
        deliverStream();
      }, 1500); // 1.5s timeout

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

  // 🔧 NEW: Create OFFER (viewer-initiated)
  console.log("🎬 [VIEWER] Creating offer...");
  const offer = await viewerPc.createOffer();
  console.log("✅ [VIEWER] Offer created, setting as local description...");

  await viewerPc.setLocalDescription(offer);
  console.log("✅ [VIEWER] setLocalDescription complete (offer)");
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

  const myUfrag = getUfrag(offer) || getUfrag(viewerPc.localDescription) || null;

  // 🔧 Set up ALL listeners BEFORE publishing offer
  // This ensures we catch all responses from the host

  // Listen for host ICE candidates (set up FIRST to avoid missing early candidates)
  let unsubHostCand: (() => void) | undefined;
  unsubHostCand = onSnapshot(
    candHostCol,
    async (snap) => {
      console.log("📥 [VIEWER] Received host candidates snapshot, docChanges:", snap.docChanges().length);

      // Get current remote ufrag (from answer)
      const remoteUfrag = getUfrag(viewerPc.remoteDescription);

      for (const ch of snap.docChanges()) {
        if (ch.type !== "added") continue;
        const data = ch.doc.data() as any;
        if (!data?.candidate) continue;

        // 🔧 Filter by viewerId - only process candidates meant for this viewer
        if (data.viewerId && data.viewerId !== viewerId) {
          console.log(`⏭️ [VIEWER] Skipping candidate for different viewer: ${data.viewerId}`);
          continue;
        }

        // (lenient; only enforce if tag present)
        if (data && "tag" in data && data.tag !== tag) {
          // Different offer cycle — ignore
          continue;
        }

        // Check ufrag match (only if we have remote description set)
        if (remoteUfrag && data?.ufrag && data.ufrag !== remoteUfrag) {
          console.log(`⏭️ [VIEWER] Skipping candidate due to ufrag mismatch`);
          continue;
        }

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

  // 🔧 Listen for host's answer
  console.log("👂 [VIEWER] Waiting for answer from host...");
  const answersDoc = doc(db, "sessions", sessionId, "answers", viewerId);

  const unsubAnswer = onSnapshot(
    answersDoc,
    async (snap) => {
      if (!snap.exists()) {
        console.log("⏳ [VIEWER] Answer document doesn't exist yet");
        return;
      }

      const data = snap.data() as any;
      console.log("📨 [VIEWER] Received answer from host!");

      if (!data?.sdp) {
        console.warn("❌ [VIEWER] No SDP in answer");
        return;
      }

      // Check tag matches
      if (Number(data.tag) !== Number(tag)) {
        console.log(`↪️ [VIEWER] Ignoring answer for different tag`, {
          expected: tag,
          got: data.tag
        });
        return;
      }

      try {
        console.log("📥 [VIEWER] Applying answer as remote description...");
        await viewerPc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: data.sdp }));
        console.log("✅ [VIEWER] Answer applied successfully!");
        console.log("🔌 [VIEWER] ICE connection state:", viewerPc.iceConnectionState);

        // Stop listening for answers
        unsubAnswer();
      } catch (err) {
        console.error("💥 [VIEWER] Failed to apply answer:", err);
      }
    },
    (err) => {
      console.error("🔥 [VIEWER] Answer listener error:", err);
    }
  );

  // 🚀 Set up ICE candidate publishing
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
      viewerId, // Include viewerId for routing
    }).then(() => {
      console.log("✅ [VIEWER] candidate published");
    }).catch((err) => console.warn("[VIEWER] failed to write ICE", err));
  };

  // 🔧 NOW publish OFFER (after all listeners are ready)
  try {
    const offersDoc = doc(db, "sessions", sessionId, "offers", viewerId);
    console.log("📤 [VIEWER] Publishing offer to:", `sessions/${sessionId}/offers/${viewerId}`);
    console.log("📤 [VIEWER] Offer SDP preview:", offer.sdp?.substring(0, 100));

    await setDoc(offersDoc, {
      type: "offer",
      sdp: offer.sdp,
      at: Date.now(),
      tag,
      viewerId,
    });
    console.log("✅ [VIEWER] Offer published successfully!", { sessionId, viewerId, tag });
  } catch (e) {
    console.error("💥 [VIEWER] FAILED to publish offer doc:", e);
    throw e;
  }

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

  return {
    pc: viewerPc,
    stop() {
      try { unsubHostCand?.(); } catch {}
      try { viewerPc.close(); } catch {}
    },
  };
}
