import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['packages/video-effects/src/tests/**/*.test.ts'],
    coverage: {
      enabled: false,
    },
  },
});
