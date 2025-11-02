/**
 * ViewerHostPage component - displays the composited output in a separate viewer window.
 * 
 * Receives canvas.captureStream(30) via postMessage and renders it in a full-bleed video element.
 */

import { useEffect, useRef } from 'react';

/**
 * Viewer page component for the second window that displays the presentation output.
 * 
 * @returns Video element placeholder ready for stream input
 */
export function ViewerHostPage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // TODO: Listen for postMessage from presenter window with MediaStream
    // Set video.srcObject = stream when received
    const handleMessage = (event: MessageEvent) => {
      // Future: handle MediaStream setup
      if (event.data?.type === 'stream') {
        const video = videoRef.current;
        if (video && event.data.stream) {
          video.srcObject = event.data.stream;
          video.play().catch(console.error);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
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
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}

