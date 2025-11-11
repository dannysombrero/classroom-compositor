// src/theme/typography.ts

export interface TypographyConfig {
  name: string;
  fontFamily: string;
  googleFontsUrl: string;
  weights: number[];
}

/**
 * Font Option 1: DM Sans
 * Friendly, rounded, highly readable - perfect for educators
 */
export const dmSansFont: TypographyConfig = {
  name: 'DM Sans',
  fontFamily: '"DM Sans", system-ui, -apple-system, sans-serif',
  googleFontsUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap',
  weights: [400, 500, 600, 700],
};

/**
 * Font Option 2: Plus Jakarta Sans
 * Modern, geometric, approachable
 */
export const plusJakartaSansFont: TypographyConfig = {
  name: 'Plus Jakarta Sans',
  fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
  googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
  weights: [400, 500, 600, 700],
};

/**
 * Font Option 3: Inter
 * Clean, professional fallback
 */
export const interFont: TypographyConfig = {
  name: 'Inter',
  fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  weights: [400, 500, 600, 700],
};

/**
 * Font Option 4: Comic Sans (Test)
 * Very distinctive for testing - you'll definitely see this change!
 */
export const comicSansFont: TypographyConfig = {
  name: 'Comic Sans (Test)',
  fontFamily: '"Comic Sans MS", "Comic Sans", cursive',
  googleFontsUrl: '', // System font, no need to load
  weights: [400, 700],
};

/**
 * Font Option 5: Courier New (Test)
 * Monospace - very different from others
 */
export const courierFont: TypographyConfig = {
  name: 'Courier (Test)',
  fontFamily: '"Courier New", Courier, monospace',
  googleFontsUrl: '', // System font, no need to load
  weights: [400, 700],
};

export const fonts = {
  dmSans: dmSansFont,
  plusJakartaSans: plusJakartaSansFont,
  inter: interFont,
  comicSans: comicSansFont,
  courier: courierFont,
} as const;

export type FontName = keyof typeof fonts;

/**
 * Typography scale
 */
export const typography = {
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.02em',
    wider: '0.04em',
  },
} as const;