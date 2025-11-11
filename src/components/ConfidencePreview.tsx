import { useEffect, useRef } from 'react';
import type { Scene } from '../types/scene';
import { drawScene } from '../renderer/canvasRenderer';

interface ConfidencePreviewProps {
  scene: Scene | null;
  visible: boolean;
  onClose: () => void;
}

/**
 * Confidence preview that renders the scene directly to a small canvas.
 * No encoding/decoding - just direct canvas rendering like OBS does.
 * Much more efficient than encoding→decoding→re-encoding cycle.
 */
export function ConfidencePreview({ scene, visible, onClose }: ConfidencePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible || !scene) {
      // Cancel animation frame when not visible
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    // Set up preview canvas at low resolution (320x180)
    const previewWidth = 320;
    const previewHeight = 180;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = previewWidth * dpr;
    canvas.height = previewHeight * dpr;
    canvas.style.width = `${previewWidth}px`;
    canvas.style.height = `${previewHeight}px`;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Calculate scale to fit scene in preview
    const scaleX = previewWidth / scene.width;
    const scaleY = previewHeight / scene.height;

    // Set transform for scaled rendering
    ctx.setTransform(dpr * scaleX, 0, 0, dpr * scaleY, 0, 0);

    let lastFrameTime = 0;
    const targetFPS = 15; // Lower FPS for preview to save CPU
    const frameDuration = 1000 / targetFPS;

    // Render loop - draw scene directly to preview canvas
    const renderFrame = (timestamp: number) => {
      if (!visible) return;

      const elapsed = timestamp - lastFrameTime;
      if (elapsed >= frameDuration) {
        // Direct render - no encoding/decoding!
        drawScene(scene, ctx);
        lastFrameTime = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    // Start rendering
    lastFrameTime = performance.now();
    animationFrameRef.current = requestAnimationFrame(renderFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [scene, visible]);

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
        {scene ? (
          <canvas
            ref={canvasRef}
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
            Waiting for scene…
          </div>
        )}
      </div>
    </div>
  );
}
