/**
 * PresenterCanvas component - renders the main canvas for editing and preview.
 * 
 * Handles canvas resize logic and renders layers from the store.
 */

import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import { useAppStore } from '../app/store';
import { drawScene, getCanvasSize } from '../renderer/canvasRenderer';

interface PresenterCanvasProps {
  /** Whether to fit canvas to container */
  fitToContainer?: boolean;
}

/**
 * Canvas component with resize handling and render loop for the presenter view.
 * 
 * @param props - Component props
 * @returns Canvas element with resize logic and render loop
 */
export const PresenterCanvas = forwardRef<HTMLCanvasElement, PresenterCanvasProps>(
  ({ fitToContainer = true }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dirtyRef = useRef<boolean>(true);

  const scene = useAppStore((state) => {
    const currentScene = state.getCurrentScene();
    return currentScene;
  });

  // Update canvas size based on scene dimensions or default
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const sceneSize = getCanvasSize(scene);
    const logicalWidth = sceneSize.width;
    const logicalHeight = sceneSize.height;

    const updateCanvasSize = () => {
      if (fitToContainer) {
        // Fit canvas to container while maintaining aspect ratio
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // If container has no dimensions, use a default size and retry later
        if (containerWidth === 0 || containerHeight === 0) {
          // Use a reasonable default and schedule a retry
          const defaultWidth = 800;
          const defaultHeight = 600;
          const dpr = window.devicePixelRatio || 1;
          canvas.width = defaultWidth * dpr;
          canvas.height = defaultHeight * dpr;
          canvas.style.width = `${defaultWidth}px`;
          canvas.style.height = `${defaultHeight}px`;
          
          const ctx = canvas.getContext('2d', { alpha: false });
          if (ctx) {
            const scaleX = defaultWidth / logicalWidth;
            const scaleY = defaultHeight / logicalHeight;
            ctx.setTransform(dpr * scaleX, 0, 0, dpr * scaleY, 0, 0);
          }
          
          // Retry when container is ready
          setTimeout(updateCanvasSize, 100);
          return;
        }
        
        const aspectRatio = logicalWidth / logicalHeight;

        let displayWidth = containerWidth;
        let displayHeight = containerWidth / aspectRatio;

        if (displayHeight > containerHeight) {
          displayHeight = containerHeight;
          displayWidth = containerHeight * aspectRatio;
        }

        // Handle HiDPI displays
        const dpr = window.devicePixelRatio || 1;
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;

        // Set CSS size to match logical display size
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

        // Calculate scale factors from scene logical size to display size
        const scaleX = displayWidth / logicalWidth;
        const scaleY = displayHeight / logicalHeight;

        // Scale context for HiDPI and scene-to-display scaling
        // This allows drawScene() to use scene coordinates (e.g., 1920x1080)
        // which will be correctly transformed to fit the display canvas
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
          ctx.setTransform(dpr * scaleX, 0, 0, dpr * scaleY, 0, 0);
        }
      } else {
        // Use fixed dimensions
        const dpr = window.devicePixelRatio || 1;
        canvas.width = logicalWidth * dpr;
        canvas.height = logicalHeight * dpr;
        canvas.style.width = `${logicalWidth}px`;
        canvas.style.height = `${logicalHeight}px`;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }

      dirtyRef.current = true;
    };

    // Initial size
    updateCanvasSize();

    // Handle window resize
    if (fitToContainer) {
      window.addEventListener('resize', updateCanvasSize);
      return () => window.removeEventListener('resize', updateCanvasSize);
    }
  }, [scene, fitToContainer]);

  // Render loop with requestAnimationFrame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = () => {
      if (dirtyRef.current) {
        // Use same context options as updateCanvasSize to ensure consistent context
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          animationFrameRef.current = requestAnimationFrame(render);
          return;
        }

        // Ensure canvas has dimensions before drawing
        if (canvas.width === 0 || canvas.height === 0) {
          // Canvas not ready yet, skip this frame
          animationFrameRef.current = requestAnimationFrame(render);
          return;
        }

        // Get the current scene from store
        const currentScene = useAppStore.getState().getCurrentScene();
        
        // Debug: Log when rendering
        if (dirtyRef.current) {
          console.log('Rendering scene:', {
            hasScene: !!currentScene,
            sceneWidth: currentScene?.width,
            sceneHeight: currentScene?.height,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            layers: currentScene?.layers?.length || 0,
          });
        }
        
        // Note: Transform is already set by updateCanvasSize effect
        // We don't save/restore here because we want to preserve the transform
        // set by updateCanvasSize
        
        // Draw the scene
        drawScene(currentScene, ctx);
        
        dirtyRef.current = false;
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    // Mark dirty when scene changes
    dirtyRef.current = true;

    // Start render loop after a small delay to ensure canvas is set up
    const timeoutId = setTimeout(() => {
      render();
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Mark dirty when scene or store changes
  useEffect(() => {
    dirtyRef.current = true;
  }, [scene]);

    // Expose canvas ref to parent
    useImperativeHandle(ref, () => canvasRef.current!, []);

    return (
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'relative',
          minWidth: '100px',
          minHeight: '100px',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: '100%',
            backgroundColor: '#1a1a1a', // Temporary background to see canvas bounds
          }}
        />
      </div>
    );
  }
);

