/**
 * PresenterCanvas component - renders the main canvas for editing and preview.
 * 
 * Handles canvas resize logic and renders layers from the store.
 */

import { forwardRef, useCallback, useEffect, useRef, useImperativeHandle } from 'react';
import { useAppStore } from '../app/store';
import { drawScene, getCanvasSize } from '../renderer/canvasRenderer';
import { requestCurrentStreamFrame } from '../utils/viewerStream';
import type { Layer, Scene } from '../types/scene';
import { getLayerBaseSize } from '../utils/layerGeometry';

interface PresenterCanvasProps {
  /** Whether to fit canvas to container */
  fitToContainer?: boolean;
  /** Notify layout changes for interaction overlays */
  onLayoutChange?: (layout: CanvasLayout) => void;
  /** Layer IDs to omit during render (e.g., when editing text inline) */
  skipLayerIds?: string[];
}

export interface CanvasLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Canvas component with resize handling and render loop for the presenter view.
 * 
 * @param props - Component props
 * @returns Canvas element with resize logic and render loop
 */
export const PresenterCanvas = forwardRef<HTMLCanvasElement, PresenterCanvasProps>(
  ({ fitToContainer = true, onLayoutChange, skipLayerIds }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dirtyRef = useRef<boolean>(true);
  const previousSceneRef = useRef<Scene | null>(null);
  const previousSkipKeyRef = useRef<string>('');

  const scene = useAppStore((state) => {
    const currentScene = state.getCurrentScene();
    return currentScene;
  });

  const emitLayoutChange = (scaleX: number, scaleY: number) => {
    if (!onLayoutChange) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    requestAnimationFrame(() => {
      const rect = canvas.getBoundingClientRect();
      onLayoutChange({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        scaleX,
        scaleY,
      });
    });
  };

  const requestRender = useCallback(() => {
    if (animationFrameRef.current !== null) {
      return;
    }

    const renderFrame = () => {
      animationFrameRef.current = null;
      if (!dirtyRef.current) {
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx || canvas.width === 0 || canvas.height === 0) {
        // Canvas not ready yet; try again shortly.
        dirtyRef.current = true;
        requestRender();
        return;
      }

      const currentScene = useAppStore.getState().getCurrentScene();
      const previousScene = previousSceneRef.current;
      const skipKey = (skipLayerIds ?? []).join('|');
      const skipChanged = previousSkipKeyRef.current !== skipKey;
      const dirtyRect = skipChanged
        ? fullCanvasRect(currentScene ?? previousScene)
        : computeDirtyRect(previousScene, currentScene);

      if (!dirtyRect) {
        dirtyRef.current = false;
        previousSceneRef.current = currentScene ?? null;
        previousSkipKeyRef.current = skipKey;
        return;
      }

      drawScene(currentScene, ctx, { skipLayerIds, dirtyRect });
      requestCurrentStreamFrame();

      dirtyRef.current = false;
      previousSceneRef.current = currentScene ?? null;
      previousSkipKeyRef.current = skipKey;

      if (dirtyRef.current) {
        requestRender();
      }
    };

    animationFrameRef.current = requestAnimationFrame(renderFrame);
  }, [skipLayerIds]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    requestRender();
  }, [requestRender]);

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
            emitLayoutChange(scaleX, scaleY);
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

        emitLayoutChange(scaleX, scaleY);
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

        emitLayoutChange(1, 1);
      }

      markDirty();
    };

    // Initial size
    updateCanvasSize();

    // Handle window resize
    if (fitToContainer) {
      window.addEventListener('resize', updateCanvasSize);
      return () => window.removeEventListener('resize', updateCanvasSize);
    }
  }, [scene, fitToContainer, onLayoutChange, markDirty]);

  useEffect(() => {
    markDirty();

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [markDirty]);

  useEffect(() => {
    markDirty();
  }, [scene, markDirty]);

  useEffect(() => {
    markDirty();
  }, [skipLayerIds, markDirty]);

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

type DirtyRect = { x: number; y: number; width: number; height: number };

function fullCanvasRect(scene: Scene | null): DirtyRect {
  const width = scene?.width ?? 1920;
  const height = scene?.height ?? 1080;
  return { x: 0, y: 0, width, height };
}

function computeDirtyRect(previous: Scene | null, next: Scene | null): DirtyRect | null {
  if (!next) {
    if (!previous) {
      return null;
    }
    return fullCanvasRect(previous);
  }

  if (!previous) {
    return fullCanvasRect(next);
  }

  if (previous.width !== next.width || previous.height !== next.height) {
    return fullCanvasRect(next);
  }

  const prevOrder = previous.layers.map((layer) => layer.id).join('|');
  const nextOrder = next.layers.map((layer) => layer.id).join('|');
  if (prevOrder !== nextOrder) {
    return {
      x: 0,
      y: 0,
      width: next.width,
      height: next.height,
    };
  }

  let rect: DirtyRect | null = null;

  const previousMap = new Map(previous.layers.map((layer) => [layer.id, layer]));

  for (const layer of next.layers) {
    const prevLayer = previousMap.get(layer.id);
    if (!prevLayer) {
      if (layer.visible) {
        rect = unionRects(rect, inflateRect(getLayerBounds(layer, next), 4, next));
      }
      continue;
    }

    const layerChanged = prevLayer !== layer;
    const visibilityChanged = prevLayer.visible !== layer.visible;

    if (layerChanged || visibilityChanged) {
      if (prevLayer.visible) {
        rect = unionRects(rect, inflateRect(getLayerBounds(prevLayer, previous), 4, previous));
      }
      if (layer.visible) {
        rect = unionRects(rect, inflateRect(getLayerBounds(layer, next), 4, next));
      }
    }

    previousMap.delete(layer.id);
  }

  for (const remaining of previousMap.values()) {
    if (remaining.visible) {
      rect = unionRects(rect, inflateRect(getLayerBounds(remaining, previous), 4, previous));
    }
  }

  if (!rect) {
    return null;
  }

  rect.x = Math.max(0, rect.x);
  rect.y = Math.max(0, rect.y);
  rect.width = Math.min(next.width - rect.x, rect.width);
  rect.height = Math.min(next.height - rect.y, rect.height);
  return rect;
}

function unionRects(existing: DirtyRect | null, next: DirtyRect): DirtyRect {
  if (!existing) return { ...next };
  const minX = Math.min(existing.x, next.x);
  const minY = Math.min(existing.y, next.y);
  const maxX = Math.max(existing.x + existing.width, next.x + next.width);
  const maxY = Math.max(existing.y + existing.height, next.y + next.height);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function inflateRect(rect: DirtyRect, amount: number, scene: Scene): DirtyRect {
  const inflated = {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
  inflated.x = Math.max(0, inflated.x);
  inflated.y = Math.max(0, inflated.y);
  inflated.width = Math.max(0, Math.min(scene.width - inflated.x, inflated.width));
  inflated.height = Math.max(0, Math.min(scene.height - inflated.y, inflated.height));
  return inflated;
}

function getLayerBounds(layer: Layer, scene: Scene): DirtyRect {
  const size = getLayerBaseSize(layer, scene);
  const scaleX = Math.abs(layer.transform.scale.x || 1);
  const scaleY = Math.abs(layer.transform.scale.y || 1);
  const width = size.width * scaleX;
  const height = size.height * scaleY;
  const angle = Math.abs(layer.transform.rot || 0);
  let finalWidth = width;
  let finalHeight = height;
  if (angle % 360 !== 0) {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    finalWidth = width * cos + height * sin;
    finalHeight = width * sin + height * cos;
  }

  return {
    x: layer.transform.pos.x - finalWidth / 2,
    y: layer.transform.pos.y - finalHeight / 2,
    width: finalWidth,
    height: finalHeight,
  };
}
