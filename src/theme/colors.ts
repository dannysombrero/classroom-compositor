// src/theme/colors.ts

export interface ColorPalette {
  name: string;
  primary: string;
  primaryHover: string;
  primaryLight: string;
  secondary: string;
  secondaryHover: string;
  secondaryLight: string;
  success: string;
  successHover: string;
  successLight: string;
  warning: string;
  warningHover: string;
  warningLight: string;
  danger: string;
  dangerHover: string;
  dangerLight: string;
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceHover: string;
  surfaceActive: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  borderHover: string;
  borderFocus: string;
}

/**
 * Palette A: "Warm Educator"
 * Friendly, creative, approachable with purple and orange accents
 */
export const warmEducatorPalette: ColorPalette = {
  name: 'Warm Educator',
  primary: '#8b5cf6',
  primaryHover: '#7c3aed',
  primaryLight: 'rgba(139, 92, 246, 0.15)',
  secondary: '#f59e0b',
  secondaryHover: '#d97706',
  secondaryLight: 'rgba(245, 158, 11, 0.15)',
  success: '#10b981',
  successHover: '#059669',
  successLight: 'rgba(16, 185, 129, 0.15)',
  warning: '#f59e0b',
  warningHover: '#d97706',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  danger: '#ef4444',
  dangerHover: '#dc2626',
  dangerLight: 'rgba(239, 68, 68, 0.15)',
  background: '#0f1117',
  backgroundAlt: '#0b0b0f',
  surface: '#1a1d29',
  surfaceHover: '#22262f',
  surfaceActive: '#2a2e3a',
  text: '#e5e7eb',
  textMuted: '#9ca3af',
  textSubtle: '#6b7280',
  border: 'rgba(255, 255, 255, 0.08)',
  borderHover: 'rgba(255, 255, 255, 0.12)',
  borderFocus: 'rgba(139, 92, 246, 0.5)',
};

/**
 * Palette B: "Fresh & Modern"
 * Clean, energetic, professional with teal and coral accents
 */
export const freshModernPalette: ColorPalette = {
  name: 'Fresh & Modern',
  primary: '#14b8a6',
  primaryHover: '#0d9488',
  primaryLight: 'rgba(20, 184, 166, 0.15)',
  secondary: '#f97316',
  secondaryHover: '#ea580c',
  secondaryLight: 'rgba(249, 115, 22, 0.15)',
  success: '#34d399',
  successHover: '#10b981',
  successLight: 'rgba(52, 211, 153, 0.15)',
  warning: '#fbbf24',
  warningHover: '#f59e0b',
  warningLight: 'rgba(251, 191, 36, 0.15)',
  danger: '#f43f5e',
  dangerHover: '#e11d48',
  dangerLight: 'rgba(244, 63, 94, 0.15)',
  background: '#0f1117',
  backgroundAlt: '#0b0b0f',
  surface: '#1a1d29',
  surfaceHover: '#22262f',
  surfaceActive: '#2a2e3a',
  text: '#e5e7eb',
  textMuted: '#9ca3af',
  textSubtle: '#6b7280',
  border: 'rgba(255, 255, 255, 0.08)',
  borderHover: 'rgba(255, 255, 255, 0.12)',
  borderFocus: 'rgba(20, 184, 166, 0.5)',
};

/**
 * Palette C: "Playful Classroom"
 * Fun, vibrant, engaging with blue and pink accents
 */
export const playfulClassroomPalette: ColorPalette = {
  name: 'Playful Classroom',
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  primaryLight: 'rgba(59, 130, 246, 0.15)',
  secondary: '#ec4899',
  secondaryHover: '#db2777',
  secondaryLight: 'rgba(236, 72, 153, 0.15)',
  success: '#84cc16',
  successHover: '#65a30d',
  successLight: 'rgba(132, 204, 22, 0.15)',
  warning: '#f59e0b',
  warningHover: '#d97706',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  danger: '#ef4444',
  dangerHover: '#dc2626',
  dangerLight: 'rgba(239, 68, 68, 0.15)',
  background: '#0f1117',
  backgroundAlt: '#0b0b0f',
  surface: '#1a1d29',
  surfaceHover: '#22262f',
  surfaceActive: '#2a2e3a',
  text: '#e5e7eb',
  textMuted: '#9ca3af',
  textSubtle: '#6b7280',
  border: 'rgba(255, 255, 255, 0.08)',
  borderHover: 'rgba(255, 255, 255, 0.12)',
  borderFocus: 'rgba(59, 130, 246, 0.5)',
};

/**
 * Palette D: "Midnight Scholar"
 * Deep, sophisticated with indigo and amber accents
 */
export const midnightScholarPalette: ColorPalette = {
  name: 'Midnight Scholar',
  primary: '#6366f1',
  primaryHover: '#4f46e5',
  primaryLight: 'rgba(99, 102, 241, 0.15)',
  secondary: '#f59e0b',
  secondaryHover: '#d97706',
  secondaryLight: 'rgba(245, 158, 11, 0.15)',
  success: '#22c55e',
  successHover: '#16a34a',
  successLight: 'rgba(34, 197, 94, 0.15)',
  warning: '#eab308',
  warningHover: '#ca8a04',
  warningLight: 'rgba(234, 179, 8, 0.15)',
  danger: '#ef4444',
  dangerHover: '#dc2626',
  dangerLight: 'rgba(239, 68, 68, 0.15)',
  background: '#0f1117',
  backgroundAlt: '#0b0b0f',
  surface: '#1a1d29',
  surfaceHover: '#22262f',
  surfaceActive: '#2a2e3a',
  text: '#e5e7eb',
  textMuted: '#9ca3af',
  textSubtle: '#6b7280',
  border: 'rgba(255, 255, 255, 0.08)',
  borderHover: 'rgba(255, 255, 255, 0.12)',
  borderFocus: 'rgba(99, 102, 241, 0.5)',
};

/**
 * Palette E: "Forest Academy"
 * Natural, calming with green and earth tones
 */
export const forestAcademyPalette: ColorPalette = {
  name: 'Forest Academy',
  primary: '#059669',
  primaryHover: '#047857',
  primaryLight: 'rgba(5, 150, 105, 0.15)',
  secondary: '#ea580c',
  secondaryHover: '#c2410c',
  secondaryLight: 'rgba(234, 88, 12, 0.15)',
  success: '#10b981',
  successHover: '#059669',
  successLight: 'rgba(16, 185, 129, 0.15)',
  warning: '#f59e0b',
  warningHover: '#d97706',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  danger: '#dc2626',
  dangerHover: '#b91c1c',
  dangerLight: 'rgba(220, 38, 38, 0.15)',
  background: '#0f1117',
  backgroundAlt: '#0b0b0f',
  surface: '#1a1d29',
  surfaceHover: '#22262f',
  surfaceActive: '#2a2e3a',
  text: '#e5e7eb',
  textMuted: '#9ca3af',
  textSubtle: '#6b7280',
  border: 'rgba(255, 255, 255, 0.08)',
  borderHover: 'rgba(255, 255, 255, 0.12)',
  borderFocus: 'rgba(5, 150, 105, 0.5)',
};

export const palettes = {
  warmEducator: warmEducatorPalette,
  freshModern: freshModernPalette,
  playfulClassroom: playfulClassroomPalette,
  midnightScholar: midnightScholarPalette,
  forestAcademy: forestAcademyPalette,
} as const;

export type PaletteName = keyof typeof palettes;