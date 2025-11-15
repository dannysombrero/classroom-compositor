import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'jsdom',
    include: [
      'packages/video-effects/src/tests/**/*.test.ts',
      'src/**/*.test.{ts,tsx}',
    ],
    coverage: {
      enabled: false,
    },
  },
});
