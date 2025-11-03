import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(__dirname),
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'esnext'
  },
  server: {
    fs: {
      allow: [resolve(__dirname, '..'), resolve(__dirname, '..', '..', '..')]
    }
  },
  esbuild: {
    target: 'es2022'
  }
});
