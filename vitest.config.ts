import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
    // Vitest blanks CSS by default, which turns `index.css?raw` into "". The app
    // reads the theme base values from that text (ADR-018 decision 3), so let
    // this one request through to Vite's own `?raw` handling, as in dev and build.
    css: { include: [/index\.css\?raw$/] },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
