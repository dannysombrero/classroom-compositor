// src/utils/cn.ts

/**
 * Utility to merge class names conditionally
 * Useful for combining Tailwind classes with conditional logic
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}