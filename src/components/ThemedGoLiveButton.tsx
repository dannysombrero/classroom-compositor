// src/components/ThemedGoLiveButton.tsx

import { type CSSProperties } from 'react';

interface ThemedGoLiveButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Themed "Go Live" button using the new design system
 * This is a demo of how the new theme system works
 */
export function ThemedGoLiveButton({ onClick, disabled }: ThemedGoLiveButtonProps) {
  const buttonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'clamp(6px, 1vw, 12px)',
    background: 'var(--color-danger)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-lg)',
    padding: 'clamp(8px, 1.2vh, 12px) clamp(16px, 2vw, 24px)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700,
    fontSize: 'clamp(13px, 1.5vw, 16px)',
    fontFamily: 'var(--font-family)',
    transition: 'all 0.2s ease',
    boxShadow: 'var(--shadow-sm)',
    opacity: disabled ? 0.6 : 1,
  };

  const buttonHoverStyle: CSSProperties = {
    ...buttonStyle,
    background: 'var(--color-danger-hover)',
    boxShadow: 'var(--shadow-md)',
    transform: 'translateY(-1px)',
  };

  const dotStyle: CSSProperties = {
    display: 'inline-flex',
    width: 'clamp(8px, 1vw, 12px)',
    height: 'clamp(8px, 1vw, 12px)',
    borderRadius: 999,
    background: 'white',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={buttonStyle}
      onMouseEnter={(e) => {
        if (!disabled) {
          Object.assign(e.currentTarget.style, buttonHoverStyle);
        }
      }}
      onMouseLeave={(e) => {
        Object.assign(e.currentTarget.style, buttonStyle);
      }}
      title="Start a live session and generate a join code"
    >
      <span style={dotStyle} />
      Go Live
    </button>
  );
}