/**
 * Phone Camera WebRTC - Host-side logic for receiving phone camera streams
 *
 * This module handles the host side of phone camera streaming:
 * - Listens for phone camera offers in Firestore
 * - Creates answers and establishes peer connections
 * - Receives remote video streams from phones
 * - Provides callback interface for stream delivery
 */

import { db, collection, doc, setDoc, onSnapshot, addDoc } from "../firebase";

// Helper to extract ICE ufrag from SDP
function getUfrag(
  value: string | RTCSessionDescriptionInit | RTCIceCandidateInit | null | undefined
): string | null {
  if (!value) return null;

  let text = "";
  if (typeof value === "string") {
    text = value;
  } else if ((value as RTCSessionDescriptionInit).sdp) {
    text = (value as RTCSessionDescriptionInit).sdp ?? "";
  } else if ((value as RTCIceCandidateInit).candidate) {
    text = (value as RTCIceCandidateInit).candidate ?? "";
  }

  const sdpMatch = text.match(/^a=ice-ufrag:(.+)$/m);
  if (sdpMatch) {
    return sdpMatch[1].trim();
  }

  const candMatch = text.match(/(?:\s|^)ufrag\s+([^\s]+)/);
  if (candMatch) {
    return candMatch[1];
  }

  return null;
}

// TURN config (reuse from main webrtc.ts)
const ICE_URLS: string[] = (() => {
  try { return JSON.parse(import.meta.env.VITE_TURN_URLS || "[]"); }
  catch { return []; }
})();

const TURN_AUTH = {
  username: import.meta.env.VITE_TURN_USERNAME,
  credential: import.meta.env.VITE_TURN_CREDENTIAL,
};

function rtcConfig(): RTCConfiguration {
  const servers: RTCIceServer[] = [];
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
    iceTransportPolicy: "all",
    bundlePolicy: "max-bundle",
  };
}

export interface PhoneCameraConnection {
  cameraId: string;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  unsubCandidates: (() => void) | null;
  createdAt: number;
  facingMode?: string;
}

// Active phone camera connections
const phoneCameraConnections = new Map<string, PhoneCameraConnection>();

// Callbacks for phone camera events
type PhoneCameraCallback = (cameraId: string, stream: MediaStream) => void;
type PhoneCameraDisconnectCallback = (cameraId: string) => void;

let onPhoneCameraStreamCallback: PhoneCameraCallback | null = null;
let onPhoneCameraDisconnectCallback: PhoneCameraDisconnectCallback | null = null;

export function setPhoneCameraStreamCallback(callback: PhoneCameraCallback) {
  onPhoneCameraStreamCallback = callback;
}

export function setPhoneCameraDisconnectCallback(callback: PhoneCameraDisconnectCallback) {
  onPhoneCameraDisconnectCallback = callback;
}

/**
 * Handle a phone camera offer - create answer and establish connection
 */
async function handlePhoneCameraOffer(
  sessionId: string,
  cameraId: string,
  offerData: any
): Promise<void> {
  console.log("📱 [HOST] Handling phone camera offer:", cameraId);

  // FIX: Check if we already have a connection for this camera
  const existingConn = phoneCameraConnections.get(cameraId);
  if (existingConn) {
    // Check if connection is still alive
    if (existingConn.pc.connectionState === 'connected' ||
        existingConn.pc.connectionState === 'connecting') {
      console.log("⚠️ [HOST] Already have active connection for camera:", cameraId);
      return;
    } else {
      // Clean up stale connection and allow reconnection
      console.log("🔄 [HOST] Cleaning up stale connection for camera:", cameraId);
      stopPhoneCamera(cameraId);
    }
  }

  try {
    // Create peer connection
    const pc = new RTCPeerConnection(rtcConfig());

    // Set up ICE candidate handling
    // Use 5-segment paths: sessions/{sessionId}/candidates_phone/{cameraId}/candidates
    const candPhoneCol = collection(db, "sessions", sessionId, "candidates_phone", cameraId, "candidates");
    const candHostPhoneCol = collection(db, "sessions", sessionId, "candidates_host_phone", cameraId, "candidates");

    // Handle ICE candidates
    pc.onicecandidate = async (e) => {
      if (!e.candidate) {
        console.log("✅ [HOST] Phone camera ICE gathering complete:", cameraId);
        return;
      }

      try {
        const myUfrag = getUfrag(pc.localDescription);
        await addDoc(candHostPhoneCol, {
          candidate: e.candidate.toJSON(),
          at: Date.now(),
          from: "host",
          cameraId,
          ufrag: myUfrag,
        });
        console.log("✅ [HOST] Published ICE candidate for phone camera:", cameraId);
      } catch (err) {
        console.error(`💥 [HOST] Failed to publish ICE candidate for camera ${cameraId}:`, err);
      }
    };

    // Listen for phone ICE candidates
    const unsubCandidates = onSnapshot(
      candPhoneCol,
      async (snap) => {
        const expectedUfrag = getUfrag(pc.remoteDescription);

        for (const ch of snap.docChanges()) {
          if (ch.type !== "added") continue;
          const data = ch.doc.data() as any;
          if (!data?.candidate) continue;

          // Check ufrag match
          const candUfrag = data.ufrag;
          if (expectedUfrag && candUfrag && candUfrag !== expectedUfrag) {
            console.warn(`[HOST][${cameraId}] Skipping candidate due to ufrag mismatch`);
            continue;
          }

          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            console.log(`✅ [HOST] Added ICE candidate for phone camera ${cameraId}`);
          } catch (err) {
            console.warn(`❌ [HOST] Failed to add ICE candidate for camera ${cameraId}:`, err);
          }
        }
      },
      (err) => console.warn(`[HOST][${cameraId}] Candidate listener error:`, err)
    );

    // Handle incoming stream
    let receivedStream: MediaStream | null = null;

    pc.ontrack = (ev) => {
      console.log("🎥 [HOST] Phone camera track received:", {
        cameraId,
        kind: ev.track.kind,
        readyState: ev.track.readyState,
      });

      if (ev.track.kind === "video") {
        // Get or create stream
        if (!receivedStream) {
          receivedStream = ev.streams?.[0] ?? new MediaStream([ev.track]);

          // Store stream in connection
          const conn = phoneCameraConnections.get(cameraId);
          if (conn) {
            conn.stream = receivedStream;
          }

          // Notify callback
          if (onPhoneCameraStreamCallback) {
            onPhoneCameraStreamCallback(cameraId, receivedStream);
          }

          console.log("✅ [HOST] Phone camera stream ready:", cameraId);
        }
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`📡 [HOST] Phone camera ${cameraId} connection:`, pc.connectionState);

      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        // Clean up connection
        stopPhoneCamera(cameraId);

        // Notify disconnect callback
        if (onPhoneCameraDisconnectCallback) {
          onPhoneCameraDisconnectCallback(cameraId);
        }
      }
    };

    // Apply phone's offer as remote description
    console.log("📥 [HOST] Setting remote description (phone's offer)");
    await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: offerData.sdp }));

    // Add receive-only transceiver for video
    pc.addTransceiver("video", { direction: "recvonly" });

    // Create answer
    console.log("🎬 [HOST] Creating answer for phone camera:", cameraId);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Publish answer to Firestore (in the same document as the offer, as a nested field)
    const offerDoc = doc(db, "sessions", sessionId, "phone_camera_offers", cameraId);
    await setDoc(offerDoc, {
      ...offerData,
      answer: {
        type: "answer",
        sdp: answer.sdp,
        at: Date.now(),
      },
    }, { merge: true });

    console.log("✅ [HOST] Answer published for phone camera:", cameraId);

    // Track this connection
    phoneCameraConnections.set(cameraId, {
      cameraId,
      pc,
      stream: receivedStream,
      unsubCandidates,
      createdAt: Date.now(),
      facingMode: offerData.facingMode,
    });

    console.log("🎉 [HOST] Phone camera connection established:", cameraId);
  } catch (err) {
    console.error(`💥 [HOST] Failed to handle phone camera offer for ${cameraId}:`, err);
  }
}

// Unsubscribe function for phone camera offers listener
let unsubPhoneCameraOffers: (() => void) | null = null;

/**
 * Start listening for phone camera offers from a session
 */
export async function startPhoneCameraHost(sessionId: string): Promise<void> {
  console.log("📱 [HOST] Starting phone camera host for session:", sessionId);

  // Clean up existing listener if any
  if (unsubPhoneCameraOffers) {
    unsubPhoneCameraOffers();
    unsubPhoneCameraOffers = null;
  }

  // Listen for phone camera offers
  const offersCol = collection(db, "sessions", sessionId, "phone_camera_offers");

  unsubPhoneCameraOffers = onSnapshot(
    offersCol,
    async (snap) => {
      console.log("📨 [HOST] Phone camera offers snapshot:", snap.docChanges().length, "changes");

      for (const ch of snap.docChanges()) {
        if (ch.type !== "added") continue;

        const cameraId = ch.doc.id;
        const data = ch.doc.data() as any;

        console.log("📦 [HOST] New phone camera offer:", cameraId);

        if (!data?.sdp) {
          console.warn("❌ [HOST] No SDP in phone camera offer:", cameraId);
          continue;
        }

        // Skip if already have answer (reconnection scenario)
        if (data.answer) {
          console.log("⏭️ [HOST] Offer already has answer, skipping:", cameraId);
          continue;
        }

        // Handle the offer
        await handlePhoneCameraOffer(sessionId, cameraId, data);
      }
    },
    (err) => {
      console.error("🔥 [HOST] Phone camera offers listener error:", err);
    }
  );

  console.log("✅ [HOST] Phone camera host started");
}

/**
 * Stop listening for phone cameras and close all connections
 */
export async function stopPhoneCameraHost(): Promise<void> {
  console.log("🛑 [HOST] Stopping phone camera host");

  // Unsubscribe from offers
  if (unsubPhoneCameraOffers) {
    unsubPhoneCameraOffers();
    unsubPhoneCameraOffers = null;
  }

  // Close all connections
  for (const [cameraId, conn] of phoneCameraConnections.entries()) {
    stopPhoneCamera(cameraId);
  }

  phoneCameraConnections.clear();
}

/**
 * Stop a specific phone camera connection
 */
export function stopPhoneCamera(cameraId: string): void {
  const conn = phoneCameraConnections.get(cameraId);
  if (!conn) return;

  console.log("🔌 [HOST] Stopping phone camera:", cameraId);

  try { conn.unsubCandidates?.(); } catch {}
  // Stop all tracks in the stream to prevent leaks
  if (conn.stream) {
    conn.stream.getTracks().forEach(t => {
      console.log('🗑️ [HOST] Stopping phone camera track:', t.id);
      try { t.stop(); } catch {}
    });
  }
  try { conn.pc.close(); } catch {}

  phoneCameraConnections.delete(cameraId);
}

/**
 * Get all active phone camera connections
 */
export function getActivePhoneCameras(): PhoneCameraConnection[] {
  return Array.from(phoneCameraConnections.values());
}

/**
 * Get a specific phone camera connection
 */
export function getPhoneCamera(cameraId: string): PhoneCameraConnection | null {
  return phoneCameraConnections.get(cameraId) ?? null;
}
