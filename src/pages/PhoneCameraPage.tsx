/**
 * PhoneCameraPage - Allows a phone to stream its camera to the host as a video source
 *
 * Flow:
 * 1. Phone navigates to /phone-camera/:sessionId?cameraId=xxx
 * 2. Gets camera access (with front/back toggle)
 * 3. Establishes WebRTC connection to send camera feed to host
 * 4. Host receives stream and can use it as a camera layer
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { db, collection, doc, setDoc, onSnapshot, addDoc, getDoc } from '../firebase';

// Reuse the WebRTC helpers from the main webrtc.ts file
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

// Simple TURN config (reuse from main webrtc.ts)
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

type ConnectionState = 'idle' | 'requesting-camera' | 'connecting' | 'connected' | 'failed';

export default function PhoneCameraPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const cameraId = searchParams.get('cameraId') || crypto.randomUUID?.() || `camera_${Date.now()}`;

  const [state, setState] = useState<ConnectionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment'); // Default to back camera
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const unsubscribersRef = useRef<Array<() => void>>([]);

  // Get camera access
  const startCamera = async (facing: 'user' | 'environment') => {
    setState('requesting-camera');
    setError(null);

    try {
      // Stop existing stream if any
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false, // No audio for now
      });

      setStream(mediaStream);

      // Attach to video element for preview
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          // Ignore AbortError - happens when play is interrupted by new src
          if ((playErr as Error).name !== 'AbortError') {
            console.warn('[PhoneCamera] Video play warning:', playErr);
          }
        }
      }

      return mediaStream;
    } catch (err) {
      console.error('[PhoneCamera] Failed to get camera:', err);
      setError(`Camera access failed: ${(err as Error).message}`);
      setState('failed');
      return null;
    }
  };

  // Establish WebRTC connection
  const connectToHost = async (mediaStream: MediaStream) => {
    if (!sessionId) {
      setError('No session ID provided');
      setState('failed');
      return;
    }

    setState('connecting');
    setConnectionInfo('Connecting to session...');

    try {
      // Check if session exists (don't require host_ready - allow preview before Go Live)
      const sessionDoc = doc(db, "sessions", sessionId);
      const sessionSnap = await getDoc(sessionDoc);

      if (!sessionSnap.exists()) {
        setError('Session not found. Please check the QR code and try again.');
        setState('failed');
        return;
      }

      console.log('[PhoneCamera] Session found, establishing connection...');
      setConnectionInfo('Creating peer connection...');

      // Create peer connection
      const pc = new RTCPeerConnection(rtcConfig());
      pcRef.current = pc;

      // Add event listeners
      pc.oniceconnectionstatechange = () => {
        console.log('[PhoneCamera] ICE state:', pc.iceConnectionState);
        setConnectionInfo(`ICE: ${pc.iceConnectionState}`);

        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setState('connected');
          setConnectionInfo('Connected! Camera streaming to host.');
        } else if (pc.iceConnectionState === 'failed') {
          setState('failed');
          setError('Connection failed');
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[PhoneCamera] Connection state:', pc.connectionState);
      };

      // Add camera track
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track in stream');
      }

      pc.addTrack(videoTrack, mediaStream);
      console.log('[PhoneCamera] Added video track to peer connection');

      // Set up ICE candidate handling
      // Use 5-segment paths: sessions/{sessionId}/candidates_phone/{cameraId}/candidates
      const candPhoneCol = collection(db, "sessions", sessionId, "candidates_phone", cameraId, "candidates");
      const candHostPhoneCol = collection(db, "sessions", sessionId, "candidates_host_phone", cameraId, "candidates");

      pc.onicecandidate = async (e) => {
        if (!e.candidate) {
          console.log('[PhoneCamera] ICE gathering complete');
          return;
        }

        console.log('[PhoneCamera] Publishing ICE candidate');
        const myUfrag = getUfrag(pc.localDescription);

        try {
          await addDoc(candPhoneCol, {
            candidate: e.candidate.toJSON(),
            at: Date.now(),
            from: 'phone',
            cameraId,
            ufrag: myUfrag,
          });
        } catch (err) {
          console.error('[PhoneCamera] Failed to publish ICE candidate:', err);
        }
      };

      // Listen for host ICE candidates
      const unsubHostCandidates = onSnapshot(
        candHostPhoneCol,
        async (snap) => {
          const remoteUfrag = getUfrag(pc.remoteDescription);

          for (const ch of snap.docChanges()) {
            if (ch.type !== 'added') continue;
            const data = ch.doc.data() as any;
            if (!data?.candidate) continue;

            // Check ufrag match
            if (remoteUfrag && data?.ufrag && data.ufrag !== remoteUfrag) {
              console.log('[PhoneCamera] Skipping candidate due to ufrag mismatch');
              continue;
            }

            console.log('[PhoneCamera] Adding host ICE candidate');
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (err) {
              console.warn('[PhoneCamera] Failed to add ICE candidate:', err);
            }
          }
        },
        (err) => console.warn('[PhoneCamera] Host candidates listener error:', err)
      );

      unsubscribersRef.current.push(unsubHostCandidates);

      // Create and publish offer
      setConnectionInfo('Creating offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('[PhoneCamera] Offer created');

      // Publish offer to Firestore
      const offerDoc = doc(db, "sessions", sessionId, "phone_camera_offers", cameraId);
      setConnectionInfo('Publishing offer...');

      await setDoc(offerDoc, {
        type: 'offer',
        sdp: offer.sdp,
        at: Date.now(),
        cameraId,
        facingMode,
      });

      console.log('[PhoneCamera] Offer published, waiting for answer...');
      setConnectionInfo('Waiting for host to accept...');

      // Listen for answer from host
      const unsubAnswer = onSnapshot(
        offerDoc,
        async (snap) => {
          const data = snap.data() as any;

          // Check if answer has been added
          if (data?.answer?.sdp) {
            console.log('[PhoneCamera] Received answer from host');
            setConnectionInfo('Received answer, connecting...');

            try {
              await pc.setRemoteDescription(new RTCSessionDescription({
                type: 'answer',
                sdp: data.answer.sdp,
              }));
              console.log('[PhoneCamera] Answer applied successfully');
            } catch (err) {
              console.error('[PhoneCamera] Failed to apply answer:', err);
              setError('Failed to apply answer from host');
              setState('failed');
            }
          }
        },
        (err) => {
          console.error('[PhoneCamera] Answer listener error:', err);
        }
      );

      unsubscribersRef.current.push(unsubAnswer);

    } catch (err) {
      console.error('[PhoneCamera] Connection error:', err);
      setError(`Connection failed: ${(err as Error).message}`);
      setState('failed');
    }
  };

  // Initialize on mount
  useEffect(() => {
    let mounted = true;
    let currentStream: MediaStream | null = null;

    const init = async () => {
      const mediaStream = await startCamera(facingMode);
      if (!mounted) {
        // Component unmounted during camera init - clean up
        mediaStream?.getTracks().forEach(track => track.stop());
        return;
      }
      if (mediaStream) {
        currentStream = mediaStream;
        await connectToHost(mediaStream);
      }
    };

    init();

    // Cleanup on unmount only (not pagehide during init)
    return () => {
      mounted = false;
      console.log('[PhoneCamera] Component unmounting, cleaning up...');

      // Close peer connection
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }

      // Stop camera stream
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }

      // Unsubscribe listeners
      unsubscribersRef.current.forEach(unsub => unsub());
      unsubscribersRef.current = [];
    };
  }, []); // Only run on mount

  // Handle camera flip
  const flipCamera = async () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);

    // FIX: Stop old stream tracks before creating new one
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('[PhoneCamera] Stopped old camera track');
      });
    }

    const mediaStream = await startCamera(newFacing);
    if (mediaStream && pcRef.current) {
      // Replace track in peer connection
      const videoTrack = mediaStream.getVideoTracks()[0];
      const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');

      if (sender && videoTrack) {
        await sender.replaceTrack(videoTrack);
        console.log('[PhoneCamera] Camera track replaced');
      }
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p>No session ID provided. Please use a valid link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-4 shadow-lg">
        <h1 className="text-lg font-semibold">Phone Camera</h1>
        <p className="text-sm text-gray-400">Session: {sessionId?.substring(0, 8)}...</p>
      </div>

      {/* Video Preview */}
      <div className="flex-1 relative bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Status Overlay */}
        <div className="absolute top-4 left-4 right-4">
          <div className={`p-3 rounded-lg shadow-lg ${
            state === 'connected' ? 'bg-green-600' :
            state === 'failed' ? 'bg-red-600' :
            'bg-blue-600'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                state === 'connected' ? 'bg-white animate-pulse' : 'bg-white/50'
              }`} />
              <span className="text-sm font-medium">
                {state === 'connected' ? 'STREAMING' :
                 state === 'failed' ? 'FAILED' :
                 state === 'connecting' ? 'CONNECTING' :
                 state === 'requesting-camera' ? 'STARTING CAMERA' :
                 'INITIALIZING'}
              </span>
            </div>
            {connectionInfo && (
              <p className="text-xs mt-1 opacity-90">{connectionInfo}</p>
            )}
          </div>

          {error && (
            <div className="mt-2 p-3 bg-red-600 rounded-lg">
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Camera Flip Button */}
        {state === 'connected' && (
          <button
            onClick={flipCamera}
            className="absolute bottom-24 right-4 w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>

      {/* Bottom Info */}
      <div className="bg-gray-800 p-4 text-center">
        <p className="text-sm text-gray-400">
          {facingMode === 'user' ? 'Front Camera' : 'Back Camera'}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Keep this page open while streaming
        </p>
      </div>
    </div>
  );
}
