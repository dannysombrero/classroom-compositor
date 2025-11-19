/**
 * MonitorDetectionTestPanel - Development tool for testing monitor detection
 * Shows test results and allows manual testing
 */

import { useState } from 'react';
import { runAllTests, logDetectionState, type TestResult } from '../utils/monitorDetectionTests';
import { detectMonitors } from '../utils/monitorDetection';
import { useAppStore } from '../app/store';

export function MonitorDetectionTestPanel() {
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const monitorMode = useAppStore((state) => state.monitorMode);
  const effectiveScreenCount = useAppStore((state) => state.effectiveScreenCount);

  const handleRunTests = async () => {
    setIsRunning(true);
    const results = await runAllTests();
    setTestResults(results);
    setIsRunning(false);
    setIsExpanded(true);
  };

  const handleDetect = async () => {
    const result = await detectMonitors();
    if (result) {
      useAppStore.getState().updateMonitorDetection(result);
      await logDetectionState();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 10000,
        background: 'rgba(15, 15, 15, 0.95)',
        border: '1px solid rgba(147, 51, 234, 0.3)',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(12px)',
        minWidth: '300px',
        maxWidth: isExpanded ? '500px' : '300px',
        transition: 'max-width 0.3s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(147, 51, 234, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#c084fc',
              letterSpacing: '0.02em',
            }}
          >
            🧪 Monitor Detection Tests
          </div>
          <div
            style={{
              fontSize: '10px',
              color: 'rgba(255, 255, 255, 0.4)',
              marginTop: '2px',
            }}
          >
            Development Tool
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.4)',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px',
          }}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div style={{ padding: '16px' }}>
          {/* Current State */}
          <div
            style={{
              marginBottom: '16px',
              padding: '10px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '6px',
              fontSize: '11px',
            }}
          >
            <div style={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
              Current State:
            </div>
            <div style={{ color: '#f5f5f5', marginBottom: '4px' }}>
              Mode: <strong>{monitorMode}</strong>
            </div>
            <div style={{ color: '#f5f5f5' }}>
              Effective Screens: <strong>{effectiveScreenCount}</strong>
            </div>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <button
              onClick={handleRunTests}
              disabled={isRunning}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#9333ea',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isRunning ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                opacity: isRunning ? 0.6 : 1,
              }}
            >
              {isRunning ? 'Running...' : 'Run All Tests'}
            </button>
            <button
              onClick={handleDetect}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Detect Now
            </button>
          </div>

          {/* Test Results */}
          {testResults && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: '4px',
                }}
              >
                Test Results:
              </div>
              {testResults.map((result, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '8px 10px',
                    background: result.passed
                      ? 'rgba(34, 197, 94, 0.1)'
                      : 'rgba(239, 68, 68, 0.1)',
                    border: result.passed
                      ? '1px solid rgba(34, 197, 94, 0.2)'
                      : '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '6px',
                    fontSize: '11px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '4px',
                    }}
                  >
                    <span>{result.passed ? '✅' : '❌'}</span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: result.passed ? '#86efac' : '#fca5a5',
                      }}
                    >
                      {result.name}
                    </span>
                  </div>
                  <div
                    style={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '10px',
                      paddingLeft: '22px',
                    }}
                  >
                    {result.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collapsed State */}
      {!isExpanded && (
        <div
          style={{
            padding: '12px 16px',
            textAlign: 'center',
          }}
        >
          <button
            onClick={handleDetect}
            style={{
              width: '100%',
              padding: '8px',
              background: 'rgba(147, 51, 234, 0.2)',
              color: '#c084fc',
              border: '1px solid rgba(147, 51, 234, 0.4)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            🖥️ Quick Detect
          </button>
        </div>
      )}
    </div>
  );
}
