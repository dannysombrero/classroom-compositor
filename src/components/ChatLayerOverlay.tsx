/**
 * ChatLayerOverlay - Renders chat layers as DOM overlays on the canvas
 *
 * Positions ChatWidget components based on layer transform properties
 */

import type { ChatLayer } from '../types/scene';
import type { CanvasLayout } from './PresenterCanvas';
import { ChatWidget } from '../ai';
import { useSessionStore } from '../stores/sessionStore';

interface ChatLayerOverlayProps {
  layers: ChatLayer[];
  canvasLayout: CanvasLayout;
}

export function ChatLayerOverlay({ layers, canvasLayout }: ChatLayerOverlayProps) {
  const session = useSessionStore((state) => state.session);

  if (!session?.id || layers.length === 0) {
    return null;
  }

  return (
    <>
      {layers.map((layer) => {
        if (!layer.visible) return null;

        // Calculate position based on layer transform and canvas layout
        const { transform, width, height } = layer;

        // The layer's position is in scene coordinates
        // Canvas layout gives us the scale and position of the canvas in screen coordinates
        const screenX = canvasLayout.x + transform.pos.x * canvasLayout.scaleX;
        const screenY = canvasLayout.y + transform.pos.y * canvasLayout.scaleY;

        // Apply transform scale
        const screenWidth = width * transform.scale.x * canvasLayout.scaleX;
        const screenHeight = height * transform.scale.y * canvasLayout.scaleY;

        return (
          <div
            key={layer.id}
            style={{
              position: 'absolute',
              left: screenX - screenWidth / 2, // Center-origin transform
              top: screenY - screenHeight / 2,
              width: screenWidth,
              height: screenHeight,
              transform: `rotate(${transform.rot}deg)`,
              opacity: transform.opacity,
              transformOrigin: 'center center',
              pointerEvents: layer.locked ? 'none' : 'auto',
            }}
          >
            <ChatWidget
              sessionId={session.id}
              width={width}
              height={height}
              embedded
            />
          </div>
        );
      })}
    </>
  );
}
