/**
 * MonitorSettings component - Advanced settings for monitor detection
 * Allows users to configure auto-detect vs manual monitor mode
 */

import { useAppStore, type MonitorMode } from "../app/store";
import { getMonitorSetupDescription } from "../utils/monitorDetection";

export function MonitorSettings() {
  const monitorMode = useAppStore((state) => state.monitorMode);
  const lastMonitorDetection = useAppStore((state) => state.lastMonitorDetection);
  const effectiveScreenCount = useAppStore((state) => state.effectiveScreenCount);
  const setMonitorMode = useAppStore((state) => state.setMonitorMode);

  const handleModeChange = (mode: MonitorMode) => {
    setMonitorMode(mode);
    console.log("🖥️ [Monitor Settings] Mode changed to:", mode);
  };

  const setupDescription = lastMonitorDetection
    ? getMonitorSetupDescription(lastMonitorDetection)
    : "Detecting monitors...";

  const flowDescription = effectiveScreenCount < 3
    ? "Delayed activation (compact controls appear first)"
    : "Immediate activation";

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>Monitor Detection</span>
        <span style={badgeStyle}>Advanced</span>
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Current Setup</div>
        <div style={infoBoxStyle}>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>Detected:</span>
            <span style={infoValueStyle}>{setupDescription}</span>
          </div>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>Effective:</span>
            <span style={infoValueStyle}>{effectiveScreenCount} monitor{effectiveScreenCount !== 1 ? 's' : ''}</span>
          </div>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>Screen share:</span>
            <span style={infoValueStyle}>{flowDescription}</span>
          </div>
        </div>

        {lastMonitorDetection && lastMonitorDetection.screens.length > 0 && (
          <div style={screensListStyle}>
            {lastMonitorDetection.screens.map((screen, idx) => (
              <div key={screen.id} style={screenItemStyle}>
                <div style={screenIconStyle}>
                  {screen.isPrimary ? "🖥️" : "💻"}
                </div>
                <div style={screenDetailsStyle}>
                  <div style={screenLabelStyle}>{screen.label}</div>
                  <div style={screenResStyle}>
                    {screen.width} × {screen.height}
                    {screen.isPrimary && <span style={primaryTagStyle}>Primary</span>}
                    {screen.isInternal && <span style={internalTagStyle}>Internal</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={sectionStyle}>
        <div style={labelStyle}>Detection Mode</div>

        <label style={radioLabelStyle}>
          <input
            type="radio"
            name="monitorMode"
            checked={monitorMode === 'auto'}
            onChange={() => handleModeChange('auto')}
            style={radioInputStyle}
          />
          <div style={radioContentStyle}>
            <span style={radioTitleStyle}>Auto-detect</span>
            <span style={radioDescStyle}>
              Automatically detect monitor count and adjust screen share behavior
            </span>
          </div>
        </label>

        <label style={radioLabelStyle}>
          <input
            type="radio"
            name="monitorMode"
            checked={monitorMode === 'manual-1-2'}
            onChange={() => handleModeChange('manual-1-2')}
            style={radioInputStyle}
          />
          <div style={radioContentStyle}>
            <span style={radioTitleStyle}>Manual: 1-2 Monitors</span>
            <span style={radioDescStyle}>
              Delayed screen share (compact controls appear first to prevent feedback loop)
            </span>
          </div>
        </label>

        <label style={radioLabelStyle}>
          <input
            type="radio"
            name="monitorMode"
            checked={monitorMode === 'manual-3+'}
            onChange={() => handleModeChange('manual-3+')}
            style={radioInputStyle}
          />
          <div style={radioContentStyle}>
            <span style={radioTitleStyle}>Manual: 3+ Monitors</span>
            <span style={radioDescStyle}>
              Immediate screen share activation (you can use a separate monitor for preview)
            </span>
          </div>
        </label>
      </div>

      <div style={helpBoxStyle}>
        <div style={helpTitleStyle}>ℹ️ Why this matters</div>
        <div style={helpTextStyle}>
          <strong>1-2 Monitors:</strong> Screen share prompts after compact controls appear, preventing a feedback loop where your screen share captures itself.
        </div>
        <div style={helpTextStyle}>
          <strong>3+ Monitors:</strong> Screen share prompts immediately since you can use one monitor for the editor, one for compact controls, and share a different one.
        </div>
      </div>
    </div>
  );
}

// Styles
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
  padding: '20px',
  backgroundColor: 'rgba(18, 18, 18, 0.95)',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  color: '#f5f5f5',
  maxWidth: '600px',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  paddingBottom: '12px',
  borderBottom: '2px solid rgba(255, 255, 255, 0.12)',
};

const titleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  letterSpacing: '0.02em',
};

const badgeStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '2px 8px',
  borderRadius: '4px',
  backgroundColor: 'rgba(147, 51, 234, 0.2)',
  border: '1px solid rgba(147, 51, 234, 0.4)',
  color: '#c084fc',
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'rgba(255, 255, 255, 0.65)',
};

const infoBoxStyle: React.CSSProperties = {
  padding: '12px',
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  borderRadius: '8px',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const infoRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'rgba(255, 255, 255, 0.6)',
};

const infoValueStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#f5f5f5',
};

const screensListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginTop: '4px',
};

const screenItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px 12px',
  backgroundColor: 'rgba(0, 0, 0, 0.25)',
  borderRadius: '6px',
  border: '1px solid rgba(255, 255, 255, 0.06)',
};

const screenIconStyle: React.CSSProperties = {
  fontSize: '24px',
};

const screenDetailsStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const screenLabelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#f5f5f5',
};

const screenResStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'rgba(255, 255, 255, 0.55)',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const primaryTagStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  padding: '1px 4px',
  borderRadius: '3px',
  backgroundColor: 'rgba(34, 197, 94, 0.15)',
  border: '1px solid rgba(34, 197, 94, 0.3)',
  color: '#86efac',
};

const internalTagStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  padding: '1px 4px',
  borderRadius: '3px',
  backgroundColor: 'rgba(59, 130, 246, 0.15)',
  border: '1px solid rgba(59, 130, 246, 0.3)',
  color: '#93c5fd',
};

const radioLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  padding: '12px',
  cursor: 'pointer',
  borderRadius: '8px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
  transition: 'all 0.2s ease',
};

const radioInputStyle: React.CSSProperties = {
  marginTop: '3px',
  cursor: 'pointer',
  accentColor: '#3b82f6',
};

const radioContentStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const radioTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#f5f5f5',
};

const radioDescStyle: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '1.4',
  color: 'rgba(255, 255, 255, 0.6)',
};

const helpBoxStyle: React.CSSProperties = {
  padding: '14px',
  backgroundColor: 'rgba(59, 130, 246, 0.08)',
  borderRadius: '8px',
  border: '1px solid rgba(59, 130, 246, 0.2)',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const helpTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#93c5fd',
};

const helpTextStyle: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '1.5',
  color: 'rgba(255, 255, 255, 0.75)',
};
