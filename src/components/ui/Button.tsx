// src/components/ui/Button.tsx

import { type ButtonHTMLAttributes, type ReactNode, type CSSProperties } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  fullWidth?: boolean;
}

const baseStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  fontWeight: 600,
  borderRadius: 'var(--radius-lg)',
  transition: 'all 0.2s',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--font-family)',
};

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: 'var(--color-primary)',
    color: 'white',
    boxShadow: 'var(--shadow-sm)',
  },
  secondary: {
    background: 'var(--color-secondary)',
    color: 'white',
    boxShadow: 'var(--shadow-sm)',
  },
  success: {
    background: 'var(--color-success)',
    color: 'white',
    boxShadow: 'var(--shadow-sm)',
  },
  danger: {
    background: 'var(--color-danger)',
    color: 'white',
    boxShadow: 'var(--shadow-sm)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-text)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
  },
};

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.875rem',
  },
  md: {
    padding: '0.5rem 1rem',
    fontSize: '1rem',
  },
  lg: {
    padding: '0.75rem 1.5rem',
    fontSize: '1.125rem',
  },
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  style,
  children,
  disabled,
  onMouseEnter,
  onMouseLeave,
  ...props
}: ButtonProps) {
  const buttonStyle: CSSProperties = {
    ...baseStyles,
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...(fullWidth && { width: '100%' }),
    ...(disabled && { opacity: 0.5, cursor: 'not-allowed' }),
    ...style,
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      const hoverColors: Record<ButtonVariant, string> = {
        primary: 'var(--color-primary-hover)',
        secondary: 'var(--color-secondary-hover)',
        success: 'var(--color-success-hover)',
        danger: 'var(--color-danger-hover)',
        ghost: 'var(--color-surface-hover)',
        outline: 'var(--color-surface-hover)',
      };
      e.currentTarget.style.background = hoverColors[variant];
      if (variant !== 'ghost' && variant !== 'outline') {
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }
    }
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      e.currentTarget.style.background = (variantStyles[variant].background as string) || 'transparent';
      if (variant !== 'ghost' && variant !== 'outline') {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }
    }
    onMouseLeave?.(e);
  };

  return (
    <button
      style={buttonStyle}
      disabled={disabled}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </button>
  );
}