// src/components/ui/Card.tsx

import { type HTMLAttributes, type ReactNode, type CSSProperties } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const baseStyles: CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-md)',
};

const paddingStyles: Record<'none' | 'sm' | 'md' | 'lg', CSSProperties> = {
  none: {},
  sm: { padding: '1rem' },
  md: { padding: '1.5rem' },
  lg: { padding: '2rem' },
};

export function Card({ children, padding = 'md', style, ...props }: CardProps) {
  return (
    <div style={{ ...baseStyles, ...paddingStyles[padding], ...style }} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div style={{ marginBottom: '1rem', ...style }} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, style, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 
      style={{ 
        fontSize: '1.25rem', 
        fontWeight: 600, 
        color: 'var(--color-text)',
        margin: 0,
        fontFamily: 'var(--font-family)',
        ...style 
      }} 
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ children, style, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p 
      style={{ 
        fontSize: '0.875rem', 
        color: 'var(--color-text-muted)', 
        marginTop: '0.25rem',
        margin: 0,
        fontFamily: 'var(--font-family)',
        ...style 
      }} 
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({ children, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div style={style} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        marginTop: '1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}