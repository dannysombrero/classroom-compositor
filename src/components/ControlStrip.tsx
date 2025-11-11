interface ControlStripProps {
  visible: boolean;
  onTogglePresentation: () => void;
  presentationActive: boolean;
  onToggleConfidence: () => void;
  confidenceActive: boolean;
  onOpenViewer: () => void;
  viewerOpen: boolean;
}

export function ControlStrip({
  visible,
  onTogglePresentation,
  presentationActive,
  onToggleConfidence,
  confidenceActive,
  onOpenViewer,
  viewerOpen,
}: ControlStripProps) {
  const opacity = visible ? 1 : 0;
  const pointerEvents = visible ? 'auto' : 'none';

  const buttonStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '12px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '10px 16px',
    cursor: 'pointer',
    transition: 'background 0.2s, border-color 0.2s',
  };

  const activeButtonStyle: React.CSSProperties = {
    background: 'rgba(0, 166, 255, 0.25)',
    borderColor: 'rgba(0, 166, 255, 0.8)',
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: '24px',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '12px',
        padding: '12px 20px',
        borderRadius: '999px',
        background: 'rgba(20, 20, 20, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
        opacity,
        pointerEvents,
        transition: 'opacity 0.3s ease',
        zIndex: 56,
      }}
    >
      <button
        type="button"
        onClick={onTogglePresentation}
        style={{
          ...buttonStyle,
          ...(presentationActive ? activeButtonStyle : null),
        }}
      >
        {presentationActive ? 'Exit Presentation' : 'Start Presentation'}
      </button>
      <button
        type="button"
        onClick={onToggleConfidence}
        style={{
          ...buttonStyle,
          ...(confidenceActive ? activeButtonStyle : null),
        }}
      >
        {confidenceActive ? 'Hide Mini Preview' : 'Show Mini Preview'}
      </button>
      <button
        type="button"
        onClick={onOpenViewer}
        style={{
          ...buttonStyle,
          ...(viewerOpen ? activeButtonStyle : null),
        }}
      >
        {viewerOpen ? 'Viewer Open' : 'Open Viewer'}
      </button>
    </div>
  );
}

