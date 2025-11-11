import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../app/store';
import type { Scene } from '../types/scene';
import { drawScene } from '../renderer/canvasRenderer';

interface ConfidencePreviewProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Confidence preview that renders the scene directly to a small canvas.
 * No encoding/decoding - just direct canvas rendering like OBS does.
 * Subscribes to store changes for immediate updates during user interaction.
 */
export function ConfidencePreview({ visible, onClose }: ConfidencePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isRenderingRef = useRef(false);

  // Subscribe to scene changes from the store for immediate updates
  const scene = useAppStore((state) => state.getCurrentScene());

  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible || !scene || isRenderingRef.current) {
      return;
    }

    isRenderingRef.current = true;

    try {
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      // Direct render - no encoding/decoding!
      drawScene(scene, ctx);
    } finally {
      isRenderingRef.current = false;
    }
  }, [scene, visible]);

  // Set up canvas dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible || !scene) return;

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

    // Initial render
    renderPreview();
  }, [scene, visible, renderPreview]);

  // Subscribe to store updates for immediate rendering during interaction
  useEffect(() => {
    if (!visible) return;

    // Subscribe to any store changes
    const unsubscribe = useAppStore.subscribe(() => {
      renderPreview();
    });

    return () => {
      unsubscribe();
    };
  }, [visible, renderPreview]);

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
