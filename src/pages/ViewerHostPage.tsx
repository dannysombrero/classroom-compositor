/**
 * ViewerHostPage component - displays the composited output in a separate viewer window.
 * 
 * Receives canvas.captureStream(30) via postMessage and renders it in a full-bleed video element.
 */

import { useEffect, useRef } from 'react';
import type { ViewerMessage } from '../utils/viewerStream';

/**
 * Viewer page component for the second window that displays the presentation output.
 * 
 * @returns Video element ready for stream input
 */
export function ViewerHostPage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ViewerMessage>) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      if (event.data?.type === 'stream') {
        const stream = event.data.stream as MediaStream;
        if (stream) {
          video.srcObject = stream;
          video
            .play()
            .then(() => {
              console.log('Viewer: Stream playing');
            })
            .catch((error) => {
              console.error('Viewer: Failed to play stream:', error);
            });
        }
      } else if (event.data?.type === 'stream-ended') {
        // Stream ended, show placeholder or message
        video.srcObject = null;
        console.log('Viewer: Stream ended');
      } else if (event.data?.type === 'handshake') {
        // Respond to handshake - parent window will resend stream if needed
        if (window.opener) {
          window.opener.postMessage({ type: 'viewer-ready' }, window.location.origin);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Send handshake to parent window if opened via window.open
    if (window.opener) {
      window.opener.postMessage({ type: 'viewer-ready' }, window.location.origin);
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}

