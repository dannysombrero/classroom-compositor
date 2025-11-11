/**
 * PresenterCanvas component - renders the main canvas for editing and preview.
 * 
 * Handles canvas resize logic and renders layers from the store.
 */

import { forwardRef, useCallback, useEffect, useRef, useImperativeHandle, useMemo } from 'react';
import { useAppStore } from '../app/store';
import { drawScene, getCanvasSize } from '../renderer/canvasRenderer';
import { requestCurrentStreamFrame } from '../utils/viewerStream';
import type { Layer, Scene } from '../types/scene';
import { getLayerBaseSize } from '../utils/layerGeometry';
import { hasActiveSource } from '../media/sourceManager';
import { PerformanceMonitor } from '../utils/performanceMonitor';

interface PresenterCanvasProps {
  /** Whether to fit canvas to container */
  fitToContainer?: boolean;
  /** Notify layout changes for interaction overlays */
  onLayoutChange?: (layout: CanvasLayout) => void;
  /** Layer IDs to omit during render (e.g., when editing text inline) */
  skipLayerIds?: string[];
  /** Background type: color, image, or url */
  backgroundType?: 'color' | 'image' | 'url';
  /** Background value: hex color, data URL, or image URL */
  backgroundValue?: string;
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
  ({ fitToContainer = true, onLayoutChange, skipLayerIds, backgroundType = 'color', backgroundValue = '#ffffff' }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dirtyRef = useRef<boolean>(true);
  const previousSceneRef = useRef<Scene | null>(null);
  const previousSkipKeyRef = useRef<string>('');
  const perfMonitorRef = useRef<PerformanceMonitor>(new PerformanceMonitor(30, 15, 30));
  const previousBackgroundRef = useRef<string>(`${backgroundType}:${backgroundValue}`);

  const scene = useAppStore((state) => state.getCurrentScene());
  const sceneSize = useMemo(() => getCanvasSize(scene), [scene?.width, scene?.height]);

  const hasLiveVideoSources = useMemo(() => {
    if (!scene) return false;
    return scene.layers.some((layer) => {
      if (layer.type !== 'screen' && layer.type !== 'camera') {
        return false;
      }
      return hasActiveSource(layer.id) || Boolean(layer.streamId);
    });
  }, [scene]);

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

    const renderFrame = (timestamp: number) => {
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

      // Check if background changed
      const currentBackground = `${backgroundType}:${backgroundValue}`;
      const backgroundChanged = previousBackgroundRef.current !== currentBackground;

      const dirtyRect = hasLiveVideoSources
        ? fullCanvasRect(currentScene ?? previousScene)
        : skipChanged || backgroundChanged
          ? fullCanvasRect(currentScene ?? previousScene)
          : computeDirtyRect(previousScene, currentScene);

      if (!dirtyRect) {
        dirtyRef.current = false;
        previousSceneRef.current = currentScene ?? null;
        previousSkipKeyRef.current = skipKey;
        return;
      }

      // Record frame timing for performance monitoring, but don't skip frames
      // when streaming. Skipping frames causes the canvas stream to freeze/go black
      // because captureStream() has nothing new to capture.
      const isFullCanvasRender = dirtyRect.width === (currentScene?.width || 1920) &&
                                 dirtyRect.height === (currentScene?.height || 1080);

      if (hasLiveVideoSources && isFullCanvasRender) {
        // Record frame timing for adaptive FPS monitoring
        const perfMonitor = perfMonitorRef.current;
        perfMonitor.recordFrame(timestamp);
        // Note: We record the frame but don't skip rendering, as that would break streaming.
        // The performance monitor adjusts targetFPS, which can be used to adjust
        // the render pump interval in the future.
      }

      drawScene(currentScene, ctx, {
        skipLayerIds,
        dirtyRect,
        background: {
          type: backgroundType,
          value: backgroundValue,
        },
      });
      // NOTE: requestCurrentStreamFrame() removed - captureStream(fps) automatically
      // captures frames as the canvas is drawn. Calling requestFrame() on every render
      // was causing performance issues by forcing frame capture too frequently.

      dirtyRef.current = false;
      previousSceneRef.current = currentScene ?? null;
      previousSkipKeyRef.current = skipKey;
      previousBackgroundRef.current = currentBackground;

      if (dirtyRef.current) {
        requestRender();
      }
    };

    animationFrameRef.current = requestAnimationFrame(renderFrame);
  }, [skipLayerIds, hasLiveVideoSources, backgroundType, backgroundValue]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    requestRender();
  }, [requestRender]);

  // Mark dirty when background settings change
  useEffect(() => {
    markDirty();
  }, [backgroundType, backgroundValue, markDirty]);

  // Update canvas size based on scene dimensions or default
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

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
  }, [sceneSize.width, sceneSize.height, fitToContainer, onLayoutChange, markDirty]);

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

  useEffect(() => {
    if (!hasLiveVideoSources) {
      return;
    }

    let rafId: number | null = null;
    let cancelled = false;
    const frameInterval = 1000 / 30;
    const getTimestamp = () =>
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    let lastTimestamp = getTimestamp();

    const pump = (timestamp: number) => {
      if (cancelled) {
        return;
      }
      if (timestamp - lastTimestamp >= frameInterval) {
        markDirty();
        lastTimestamp = timestamp;
      }
      rafId = requestAnimationFrame(pump);
    };

    markDirty();
    rafId = requestAnimationFrame(pump);

    return () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [hasLiveVideoSources, markDirty]);

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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#2a2a2a', // Dark gray background for outer area
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
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
