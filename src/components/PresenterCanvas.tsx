/**
 * PresenterCanvas component - renders the main canvas for editing and preview.
 * 
 * Handles canvas resize logic and will eventually render layers from the store.
 */

import { useEffect, useRef } from 'react';

interface PresenterCanvasProps {
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
  /** Whether to fit canvas to container */
  fitToContainer?: boolean;
}

/**
 * Canvas component with resize handling for the presenter view.
 * 
 * @param props - Component props
 * @returns Canvas element with resize logic
 */
export function PresenterCanvas({
  width = 1920,
  height = 1080,
  fitToContainer = false,
}: PresenterCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateCanvasSize = () => {
      if (fitToContainer) {
        // Fit canvas to container while maintaining aspect ratio
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const aspectRatio = width / height;

        let newWidth = containerWidth;
        let newHeight = containerWidth / aspectRatio;

        if (newHeight > containerHeight) {
          newHeight = containerHeight;
          newWidth = containerHeight * aspectRatio;
        }

        canvas.width = newWidth;
        canvas.height = newHeight;
      } else {
        // Use fixed dimensions
        canvas.width = width;
        canvas.height = height;
      }

      // Set CSS size to match internal resolution
      canvas.style.width = `${canvas.width}px`;
      canvas.style.height = `${canvas.height}px`;
    };

    // Initial size
    updateCanvasSize();

    // Handle window resize
    if (fitToContainer) {
      window.addEventListener('resize', updateCanvasSize);
      return () => window.removeEventListener('resize', updateCanvasSize);
    }
  }, [width, height, fitToContainer]);

  // Get 2D context for future rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas initially
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // TODO: Render layers from store
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      />
    </div>
  );
}

