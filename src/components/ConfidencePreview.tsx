import { useEffect, useRef } from 'react';

interface ConfidencePreviewProps {
  stream: MediaStream | null;
  visible: boolean;
  onClose: () => void;
}

export function ConfidencePreview({ stream, visible, onClose }: ConfidencePreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!visible || !stream) {
      try {
        video.pause();
      } catch (error) {
        console.warn('ConfidencePreview: failed to pause video', error);
      }
      video.srcObject = null;
      return;
    }

    video.srcObject = stream;

    let cancelled = false;

    video
      .play()
      .catch((error) => {
        if (!cancelled) {
          console.warn('ConfidencePreview: failed to play stream', error);
        }
      });

    return () => {
      cancelled = true;
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
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: 1,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            border: 'none',
            background: 'rgba(0, 0, 0, 0.5)',
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '16px',
            cursor: 'pointer',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
