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
export async function replaceHostVideoTrack(track: MediaStreamTrack | null): Promise<void> {
  if (!pc) throw new Error("PeerConnection not initialized");
  const p = pc as RTCPeerConnection;
  const sender = (videoSender = ensureVideoSender(p, videoSender));
  await sender.replaceTrack(track);
}

/**
 * Swap the host AUDIO track without renegotiation. Accepts `null` to detach.
 */
export async function replaceHostAudioTrack(track: MediaStreamTrack | null): Promise<void> {
  if (!pc) throw new Error("PeerConnection not initialized");
  const p = pc as RTCPeerConnection;
  const sender = (audioSender = ensureAudioSender(p, audioSender));
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
  return {
    iceServers: servers,
    iceTransportPolicy: forceRelay ? "relay" : "all",
    bundlePolicy: "max-bundle",
    // Optional: small pool to speed first candidate pair (Chrome only)
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
    const pc = new RTCPeerConnection(rtcConfig(forceRelay));
    pc.onicegatheringstatechange = () => console.log(`[webrtc] ${role} gathering:`, pc.iceGatheringState);
    pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        console.log(`[webrtc] ${role} ice:`, s);
        if (s === "connected" || s === "completed") {
          void logSelectedPair(pc, role);
        } else if (s === "failed") {
          void logSelectedPair(pc, `${role} (failed)`);
        }
    };
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
  
    // Host-side one-shot retry hook: on ICE failure, re-start with relay if TURN is configured
    let retried = false;
    const hostPc = getPc();
    const prior = hostPc.oniceconnectionstatechange as ((this: RTCPeerConnection, ev: Event) => any) | null;
    hostPc.oniceconnectionstatechange = async (ev?: Event) => {
    try { prior?.call(hostPc, ev ?? new Event("iceconnectionstatechange")); } catch {}
    if (hostPc.iceConnectionState === "failed" && !retried) {
        retried = true;
        await logSelectedPair(hostPc, "host (failed)");
        if (HAS_TURN) {
        await restartIceWithPolicy(
            "relay",
            "host",
            async () => {
            // re-launch host with relay forced
            await startHost(sessionId, { ...(opts || {}), forceRelay: true });
            }
        );
        } else {
        console.warn("[webrtc] skipping relay restart: no TURN configured");
        }
    }
    };
  
  startingHost = true;
  const tag = Date.now();
  const hostPc2 = getPc();
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

    const vSender = (videoSender = ensureVideoSender(hostPc2, videoSender));
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
      const aSender = (audioSender = ensureAudioSender(hostPc2, audioSender));
      await aSender.replaceTrack(micTrack);
    }
    

    // ---- Firestore signaling ----
    const offersDoc = doc(db, "sessions", sessionId, "offers", "latest");
    const answersCol = collection(db, "sessions", sessionId, "answers");
    const candHostCol = collection(db, "sessions", sessionId, "candidates_host");
    const candViewerCol = collection(db, "sessions", sessionId, "candidates_viewer");

    hostPc2.onicecandidate = async (e) => {
      if (!e.candidate) return;
      try {
        const myUfrag = getUfrag(hostPc2.localDescription);
        await addDoc(candHostCol, {
          candidate: e.candidate.toJSON(),
          at: Date.now(),
          from: "host",
          tag,
          ufrag: myUfrag,
        });
      } catch (err) {
        console.error("[host] FAILED to write ICE candidate", err);
      }
    };

    const offer = await hostPc2.createOffer();
    await hostPc2.setLocalDescription(offer);
    await setDoc(offersDoc, { type: "offer", sdp: offer.sdp, at: tag, tag });


    console.log("[host] mids:", hostPc2.getTransceivers().map((t) => t.mid));
    console.log("[host] SRD set?", !!hostPc2.remoteDescription);

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
          if (!hostPc2.remoteDescription) {
            const c: any = { ...cand };
            (c as any).ufrag = (data && typeof data.ufrag === "string") ? data.ufrag : undefined;
            pendingViewerCandidates.push(c);
            continue;
          }
          const expectedUfrag = getUfrag(hostPc2.remoteDescription ?? null);
          const candUfrag = (data && typeof data.ufrag === "string") ? data.ufrag : undefined;
          if (expectedUfrag && candUfrag && candUfrag !== expectedUfrag) {
            console.warn("[host] skipping viewer cand due to ufrag mismatch", { candUfrag, expectedUfrag });
            continue;
          }
          try {
            await safeAddIceCandidate(hostPc2, cand);
          } catch (err) {
            console.warn("[host] addIceCandidate(viewer) failed", err);
          }
        }
      },
      (err) => console.warn("[host] candViewer onSnapshot error:", err)
    );

    const answersDoc = doc(db, "sessions", sessionId, "answers", "latest");

    if (unsubViewerAnswers) { unsubViewerAnswers(); unsubViewerAnswers = null; }
    unsubViewerAnswers = onSnapshot(
      answersDoc,
      async (snap) => {
        const data = snap.data() as any;
        if (!data?.sdp) return;

        try {
          if (hostPc2.signalingState === "have-local-offer") {
            await hostPc2.setRemoteDescription(
              new RTCSessionDescription({ type: "answer", sdp: data.sdp })
            );

            // Drain any queued ICE we buffered pre-SRD
            const expectedUfrag = getUfrag(hostPc2.remoteDescription ?? null);
            for (const queued of pendingViewerCandidates) {
              const queuedUfrag = (queued as any).ufrag as string | undefined;
              if (expectedUfrag && queuedUfrag && queuedUfrag !== expectedUfrag) {
                console.warn("[host] skipping queued viewer cand due to ufrag mismatch", { queuedUfrag, expectedUfrag });
                continue;
              }
              try { await safeAddIceCandidate(hostPc2, queued); }
              catch (err) { console.warn("[host] safeAddIceCandidate(queued) failed", err, queued); }
            }
            pendingViewerCandidates = [];
          }
        } catch (err) {
          console.warn("[host] setRemoteDescription(answer) failed", err);
        }
      },
      (err) => console.warn("[host] answers onSnapshot error:", err)
    );

    // (Optional) keep your 4s fallback, but read the single doc:
    setTimeout(async () => {
      if (!hostPc2.remoteDescription) {
        console.warn("[host] SRD still not set ~4s after offer. Trying fallback fetch of answers/latest…");
        try {
          const snap = await getDoc(answersDoc);
          const data = snap.data() as any;
          if (data?.sdp && hostPc2.signalingState === "have-local-offer") {
            await hostPc2.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: data.sdp }));
            console.log("[host] SRD set via fallback fetch answers/latest");
          } else {
            console.warn("[host] Fallback fetch found no answer yet.");
          }
        } catch (err) {
          console.warn("[host] Fallback getDoc(answers/latest) error", err);
        }
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
    if (!e.candidate) return;
    const myUfrag = getUfrag(viewerPc.localDescription ?? null);
    await addDoc(candViewerCol, {
      candidate: e.candidate.toJSON(),
      at: Date.now(),
      from: "viewer",
      tag,
      ufrag: myUfrag,
    }).catch((err) => console.error("[viewer] FAILED to write ICE candidate", err));
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

  const answer = await viewerPc.createAnswer();
  await viewerPc.setLocalDescription(answer);

  try {
    // publish deterministic doc so host listener is trivial/reliable
    const answersDoc = doc(db, "sessions", sessionId, "answers", "latest");
    const answerKey = sessionId;
    if (!publishedAnswersFor.has(answerKey)) {
      await setDoc(answersDoc, { type: "answer", sdp: answer.sdp, at: Date.now(), tag }, { merge: true });
      publishedAnswersFor.add(answerKey);
      console.log("[viewer] published answer at answers/latest", { sessionId, tag });
    } else {
      console.log("[viewer] skipped duplicate answer publish", { sessionId });
    }
  } catch (e) {
    console.error("[viewer] FAILED to publish answer doc", e, { path: `sessions/${sessionId}/answers`, tag });
  }

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
          await viewerPc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.warn("[viewer] addIceCandidate(host) failed", err);
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


// Replace restartIceWithPolicy with a version that actually restarts the host/viewer
async function restartIceWithPolicy(
    nextPolicy: "all" | "relay",
    role: "host" | "viewer",
    relaunch?: () => Promise<void>
  ): Promise<void> {
    if (startingHost) {
      console.warn("[webrtc] restart requested during start; ignoring to avoid races");
      return;
    }
    if (!pc) {
      console.warn("[webrtc] restart requested but no active RTCPeerConnection");
      if (relaunch) await relaunch();
      return;
    }
    try { pc.close(); } catch {}
    pc = null;
    videoSender = null;
    audioSender = null;
  
    console.warn(`[webrtc] restarting with iceTransportPolicy='${nextPolicy}' for ${role}`);
    if (relaunch) {
      await relaunch(); // caller provides how to relaunch (e.g., startHost with forceRelay)
    }
  }