// src/components/ui/Input.tsx

import { type InputHTMLAttributes, forwardRef, type CSSProperties } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  fullWidth?: boolean;
}

const baseStyles: CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  fontSize: '1rem',
  transition: 'all 0.2s',
  outline: 'none',
  fontFamily: 'var(--font-family)',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, fullWidth, style, disabled, onFocus, onBlur, ...props }, ref) => {
    const inputStyle: CSSProperties = {
      ...baseStyles,
      ...(error && { borderColor: 'var(--color-danger)' }),
      ...(fullWidth && { width: '100%' }),
      ...(disabled && { opacity: 0.5, cursor: 'not-allowed' }),
      ...style,
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = error ? 'var(--color-danger)' : 'var(--color-border-focus)';
      e.currentTarget.style.boxShadow = error 
        ? '0 0 0 3px var(--color-danger-light)' 
        : '0 0 0 3px var(--color-primary-light)';
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = error ? 'var(--color-danger)' : 'var(--color-border)';
      e.currentTarget.style.boxShadow = 'none';
      onBlur?.(e);
    };

    return (
      <input
        ref={ref}
        style={inputStyle}
        disabled={disabled}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';