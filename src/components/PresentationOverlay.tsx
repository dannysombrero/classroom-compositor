import { useEffect, useRef } from 'react';

interface PresentationOverlayProps {
  stream: MediaStream | null;
  active: boolean;
  onExit: () => void;
}

export function PresentationOverlay({ stream, active, onExit }: PresentationOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!active || !stream) {
      try {
        video.pause();
      } catch (error) {
        console.warn('PresentationOverlay: failed to pause video', error);
      }
      video.srcObject = null;
      return;
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    let cancelled = false;
    video
      .play()
      .catch((error) => {
        if (!cancelled) {
          console.warn('PresentationOverlay: failed to play stream', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [active, stream]);

  if (!active) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 64,
        cursor: 'none',
      }}
      onClick={onExit}
    >
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
      <div
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          fontSize: '12px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'rgba(255, 255, 255, 0.65)',
          background: 'rgba(0, 0, 0, 0.4)',
          padding: '6px 12px',
          borderRadius: '999px',
          pointerEvents: 'none',
        }}
      >
        Press Esc to exit
      </div>
    </div>
  );
}
