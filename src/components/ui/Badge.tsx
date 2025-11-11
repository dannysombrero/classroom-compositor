// src/components/ui/Badge.tsx

import { type HTMLAttributes, type ReactNode, type CSSProperties } from 'react';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

const baseStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.125rem 0.625rem',
  borderRadius: 'var(--radius-full)',
  fontSize: '0.75rem',
  fontWeight: 500,
  transition: 'colors 0.2s',
  fontFamily: 'var(--font-family)',
};

const variantStyles: Record<BadgeVariant, CSSProperties> = {
  primary: {
    background: 'var(--color-primary-light)',
    color: 'var(--color-primary)',
    border: '1px solid var(--color-primary)',
    borderColor: 'var(--color-primary)',
    opacity: 0.9,
  },
  secondary: {
    background: 'var(--color-secondary-light)',
    color: 'var(--color-secondary)',
    border: '1px solid var(--color-secondary)',
    borderColor: 'var(--color-secondary)',
    opacity: 0.9,
  },
  success: {
    background: 'var(--color-success-light)',
    color: 'var(--color-success)',
    border: '1px solid var(--color-success)',
    borderColor: 'var(--color-success)',
    opacity: 0.9,
  },
  warning: {
    background: 'var(--color-warning-light)',
    color: 'var(--color-warning)',
    border: '1px solid var(--color-warning)',
    borderColor: 'var(--color-warning)',
    opacity: 0.9,
  },
  danger: {
    background: 'var(--color-danger-light)',
    color: 'var(--color-danger)',
    border: '1px solid var(--color-danger)',
    borderColor: 'var(--color-danger)',
    opacity: 0.9,
  },
  neutral: {
    background: 'var(--color-surface-hover)',
    color: 'var(--color-text-muted)',
    border: '1px solid var(--color-border)',
  },
};

export function Badge({ variant = 'neutral', style, children, ...props }: BadgeProps) {
  return (
    <span style={{ ...baseStyles, ...variantStyles[variant], ...style }} {...props}>
      {children}
    </span>
  );
}