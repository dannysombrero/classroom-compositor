/**
 * LiveControlPanel - Minimal control interface shown when streaming is live.
 * This is a placeholder component designed to be easily replaced with Figma designs.
 */

import { useAppStore } from "../app/store";
import { useSessionStore } from "../stores/sessionStore";
import { pauseAllBots } from "../ai";

export function LiveControlPanel() {
  const compactPresenter = useAppStore((state) => state.compactPresenter);
  const setCompactPresenter = useAppStore((state) => state.setCompactPresenter);
  const setStreamingStatus = useAppStore((state) => state.setStreamingStatus);
  const currentScene = useAppStore((state) => state.getCurrentScene());
  const updateLayer = useAppStore((state) => state.updateLayer);
  const joinCode = useSessionStore((state) => state.joinCode);

  const handlePauseStream = () => {
    // Pause: hide compact controls, show full editor, keep stream alive
    setStreamingStatus('paused');
    setCompactPresenter(false);

    // Restore visibility of screen share layers (they were hidden to avoid feedback loop)
    if (currentScene) {
      const screenLayers = currentScene.layers.filter(
        (layer) => layer.type === 'screen' && layer.streamId
      );
      if (screenLayers.length > 0) {
        console.log(`▶️ [PAUSE] Restoring ${screenLayers.length} screen share(s) visibility`);
        screenLayers.forEach(layer => {
          updateLayer(layer.id, { visible: true }, { recordHistory: false });
        });
      }
    }

    // Pause all active bots
    pauseAllBots();

    console.log("⏸️ Stream paused - showing full editor");
  };

  const handleStopStream = () => {
    // TODO: Add actual stream stop logic here when implemented
    setStreamingStatus('idle');
    setCompactPresenter(false);
    console.log("🛑 Stream stopped");
  };

  const handleOpenFullConsole = () => {
    setCompactPresenter(false);
  };

  if (!compactPresenter) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#eaeaea',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          background: '#242424',
        }}
      >
        {/* Header with LIVE indicator and full console link */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#ef4444',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
            <span style={{ fontWeight: 700, fontSize: '16px' }}>LIVE</span>
          </div>
          <button
            onClick={handleOpenFullConsole}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              fontSize: '12px',
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            Open full console
          </button>
        </div>

        {/* Join Code Display */}
        {joinCode && (
          <div style={{ fontSize: '14px' }}>
            <div style={{ opacity: 0.7, marginBottom: '4px' }}>Join Code</div>
            <code
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '0.1em',
              }}
            >
              {joinCode}
            </code>
          </div>
        )}

        {/* Current Scene */}
        <div style={{ fontSize: '14px' }}>
          <div style={{ opacity: 0.7, marginBottom: '4px' }}>Current Scene</div>
          <div style={{ fontWeight: 500 }}>{currentScene?.name || 'Untitled Scene'}</div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <button
            onClick={handlePauseStream}
            style={{
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Pause Stream
          </button>
          <button
            onClick={handleStopStream}
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Stop Stream
          </button>
        </div>
      </div>

      {/* Simple CSS animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
