/**
 * MonitorDetectionToast - Shows a temporary notification with monitor detection results
 */

import { useEffect, useState } from 'react';
import type { MonitorDetectionResult } from '../utils/monitorDetection';

interface MonitorDetectionToastProps {
  result: MonitorDetectionResult | null;
  onClose: () => void;
}

export function MonitorDetectionToast({ result, onClose }: MonitorDetectionToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (result) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300); // Wait for fade out
      }, 4000); // Show for 4 seconds

      return () => clearTimeout(timer);
    }
  }, [result, onClose]);

  if (!result || !visible) return null;

  const { screenCount, supported, screens } = result;
  const mode = supported ? 'Window Management API' : 'Fallback Mode';
  const flow = screenCount < 3 ? 'Delayed Activation' : 'Immediate Activation';
  const flowIcon = screenCount < 3 ? '⏱️' : '⚡';

  return (
    <div
      style={{
        position: 'fixed',
        top: 80,
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? '0' : '-20px'})`,
        zIndex: 10002,
        opacity: visible ? 1 : 0,
        transition: 'all 0.3s ease-out',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          background: 'rgba(15, 15, 15, 0.95)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(59, 130, 246, 0.1)',
          backdropFilter: 'blur(12px)',
          minWidth: '320px',
          maxWidth: '500px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              fontSize: '24px',
            }}
          >
            🖥️
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: '#60a5fa',
                letterSpacing: '0.02em',
              }}
            >
              Monitor Detection Complete
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginTop: '2px',
              }}
            >
              {mode}
            </div>
          </div>
          <button
            onClick={() => {
              setVisible(false);
              setTimeout(onClose, 300);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.4)',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '4px',
              lineHeight: 1,
            }}
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Monitor Count */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '8px',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              fontSize: '32px',
              fontWeight: 700,
              color: '#60a5fa',
            }}
          >
            {screenCount}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#f5f5f5',
              }}
            >
              Monitor{screenCount !== 1 ? 's' : ''} Detected
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.6)',
                marginTop: '2px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{flowIcon}</span>
              <span>Screen share: {flow}</span>
            </div>
          </div>
        </div>

        {/* Screen List */}
        {screens.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {screens.map((screen, idx) => (
              <div
                key={screen.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 8px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '6px',
                  fontSize: '11px',
                }}
              >
                <span style={{ fontSize: '16px' }}>
                  {screen.isPrimary ? '🖥️' : '💻'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      color: '#f5f5f5',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {screen.label}
                  </div>
                  <div
                    style={{
                      color: 'rgba(255, 255, 255, 0.5)',
                      fontSize: '10px',
                      marginTop: '1px',
                    }}
                  >
                    {screen.width} × {screen.height}
                  </div>
                </div>
                {screen.isPrimary && (
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      background: 'rgba(34, 197, 94, 0.15)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      color: '#86efac',
                    }}
                  >
                    Primary
                  </span>
                )}
                {screen.isInternal && (
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: '#93c5fd',
                    }}
                  >
                    Built-in
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
