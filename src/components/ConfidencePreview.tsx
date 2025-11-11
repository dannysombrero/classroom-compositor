import { useEffect, useRef } from 'react';

interface ConfidencePreviewProps {
  stream: MediaStream | null;
  visible: boolean;
  onClose: () => void;
}

export function ConfidencePreview({ stream, visible, onClose }: ConfidencePreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lowResCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lowResStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!visible || !stream) {
      // Clean up
      try {
        video.pause();
      } catch (error) {
        console.warn('ConfidencePreview: failed to pause video', error);
      }
      video.srcObject = null;

      // Stop low-res stream
      if (lowResStreamRef.current) {
        lowResStreamRef.current.getTracks().forEach(track => track.stop());
        lowResStreamRef.current = null;
      }

      // Cancel animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    // Create a low-resolution canvas for the preview (320x180 @ 15fps)
    // This dramatically reduces CPU usage vs decoding full 1920x1080 @ 30fps
    if (!lowResCanvasRef.current) {
      lowResCanvasRef.current = document.createElement('canvas');
      lowResCanvasRef.current.width = 320;
      lowResCanvasRef.current.height = 180;
    }

    const lowResCanvas = lowResCanvasRef.current;
    const ctx = lowResCanvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Create a temporary video element to decode the source stream
    const sourceVideo = document.createElement('video');
    sourceVideo.srcObject = stream;
    sourceVideo.muted = true;
    sourceVideo.playsInline = true;

    let isDrawing = false;
    let lastFrameTime = 0;
    const targetFPS = 15; // Lower FPS for preview to save CPU
    const frameDuration = 1000 / targetFPS;

    // Draw frames to low-res canvas at reduced rate
    const drawFrame = (timestamp: number) => {
      if (!visible || !isDrawing) return;

      const elapsed = timestamp - lastFrameTime;
      if (elapsed >= frameDuration) {
        ctx.drawImage(sourceVideo, 0, 0, 320, 180);
        lastFrameTime = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    // Start drawing when source video is ready
    sourceVideo.addEventListener('loadeddata', () => {
      sourceVideo.play().catch((err) => {
        console.warn('ConfidencePreview: failed to play source video', err);
      });

      // Capture the low-res canvas as a stream
      const lowResStream = lowResCanvas.captureStream(targetFPS);
      lowResStreamRef.current = lowResStream;

      // Display the low-res stream in the preview video
      video.srcObject = lowResStream;
      video.play().catch((err) => {
        console.warn('ConfidencePreview: failed to play preview', err);
      });

      // Start the drawing loop
      isDrawing = true;
      lastFrameTime = performance.now();
      animationFrameRef.current = requestAnimationFrame(drawFrame);
    });

    return () => {
      isDrawing = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      sourceVideo.pause();
      sourceVideo.srcObject = null;
    };
  }, [stream, visible]);

  if (!visible) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        width: '320px',
        height: '180px',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 16px 32px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        background: 'rgba(12, 12, 12, 0.9)',
        zIndex: 48,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          fontSize: '12px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'rgba(255, 255, 255, 0.65)',
        }}
      >
        Confidence Preview
        <button
          type="button"
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'rgba(255, 255, 255, 0.75)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ flex: 1, background: '#000', position: 'relative' }}>
        {stream ? (
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '13px',
            }}
          >
            Waiting for stream…
          </div>
        )}
      </div>
    </div>
  );
}
