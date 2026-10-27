import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { 'virtual:pwa-register': fileURLToPath(new URL('./tests/stubs/pwa-register.ts', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30_000,
    // unit tests never call the online service (sync tests use a fake server)
    env: { VITE_CLOUD_URL: 'off' },
  },
});
