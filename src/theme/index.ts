// src/theme/index.ts

import { palettes, type PaletteName, type ColorPalette } from './colors';
import { fonts, type FontName, type TypographyConfig, typography } from './typography';
import { spacing } from './spacing';
import { shadows } from './shadows';
import { radius } from './radius';

/**
 * Active theme configuration
 * Change these to switch palettes/fonts instantly!
 */
let activePaletteName: PaletteName = 'warmEducator';
let activeFontName: FontName = 'plusJakartaSans';

/**
 * Get current active palette
 */
export function getActivePalette(): ColorPalette {
  return palettes[activePaletteName];
}

/**
 * Get current active font
 */
export function getActiveFont(): TypographyConfig {
  return fonts[activeFontName];
}

/**
 * Set active palette
 */
export function setActivePalette(name: PaletteName): void {
  activePaletteName = name;
  applyThemeToDOM();
}

/**
 * Set active font
 */
export function setActiveFont(name: FontName): void {
  console.log('🎨 setActiveFont called with:', name);
  activeFontName = name;
  const fontConfig = fonts[name];
  console.log('📝 Font config:', fontConfig);
  applyThemeToDOM();
  console.log('✅ Applied font family:', fontConfig.fontFamily);
  console.log('🔍 CSS variable value:', document.documentElement.style.getPropertyValue('--font-family'));
}

/**
 * Get current palette name
 */
export function getActivePaletteName(): PaletteName {
  return activePaletteName;
}

/**
 * Get current font name
 */
export function getActiveFontName(): FontName {
  return activeFontName;
}

/**
 * Apply theme to DOM via CSS variables
 */
export function applyThemeToDOM(): void {
  const palette = getActivePalette();
  const font = getActiveFont();
  const root = document.documentElement;

  // Apply color variables
  root.style.setProperty('--color-primary', palette.primary);
  root.style.setProperty('--color-primary-hover', palette.primaryHover);
  root.style.setProperty('--color-primary-light', palette.primaryLight);
  root.style.setProperty('--color-secondary', palette.secondary);
  root.style.setProperty('--color-secondary-hover', palette.secondaryHover);
  root.style.setProperty('--color-secondary-light', palette.secondaryLight);
  root.style.setProperty('--color-success', palette.success);
  root.style.setProperty('--color-success-hover', palette.successHover);
  root.style.setProperty('--color-success-light', palette.successLight);
  root.style.setProperty('--color-warning', palette.warning);
  root.style.setProperty('--color-warning-hover', palette.warningHover);
  root.style.setProperty('--color-warning-light', palette.warningLight);
  root.style.setProperty('--color-danger', palette.danger);
  root.style.setProperty('--color-danger-hover', palette.dangerHover);
  root.style.setProperty('--color-danger-light', palette.dangerLight);
  root.style.setProperty('--color-background', palette.background);
  root.style.setProperty('--color-background-alt', palette.backgroundAlt);
  root.style.setProperty('--color-surface', palette.surface);
  root.style.setProperty('--color-surface-hover', palette.surfaceHover);
  root.style.setProperty('--color-surface-active', palette.surfaceActive);
  root.style.setProperty('--color-text', palette.text);
  root.style.setProperty('--color-text-muted', palette.textMuted);
  root.style.setProperty('--color-text-subtle', palette.textSubtle);
  root.style.setProperty('--color-border', palette.border);
  root.style.setProperty('--color-border-hover', palette.borderHover);
  root.style.setProperty('--color-border-focus', palette.borderFocus);

  // Apply font family
  const oldFont = root.style.getPropertyValue('--font-family');
  root.style.setProperty('--font-family', font.fontFamily);
  console.log('🔄 Font changed from:', oldFont, 'to:', font.fontFamily);
  
  // Also apply directly to body as fallback
  document.body.style.fontFamily = font.fontFamily;
  console.log('📌 Applied font directly to body');
}

/**
 * Unified theme object
 */
export const theme = {
  get colors() {
    return getActivePalette();
  },
  get font() {
    return getActiveFont();
  },
  typography,
  spacing,
  shadows,
  radius,
  palettes,
  fonts,
  setActivePalette,
  setActiveFont,
  getActivePaletteName,
  getActiveFontName,
} as const;

// Initialize theme on load
if (typeof window !== 'undefined') {
  applyThemeToDOM();
}

// Export everything
export * from './colors';
export * from './typography';
export * from './spacing';
export * from './shadows';
export * from './radius';