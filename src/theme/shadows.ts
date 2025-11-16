// src/theme/shadows.ts

/**
 * Soft, friendly shadow definitions
 */
export const shadows = {
  none: 'none',
  xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
  sm: '0 2px 8px rgba(0, 0, 0, 0.15)',
  md: '0 4px 16px rgba(0, 0, 0, 0.25)',
  lg: '0 8px 32px rgba(0, 0, 0, 0.35)',
  xl: '0 12px 48px rgba(0, 0, 0, 0.45)',
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
  glow: '0 0 20px rgba(139, 92, 246, 0.3)', // Adapts to primary color
} as const;