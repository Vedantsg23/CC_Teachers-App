import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const hbEmscripten = fileURLToPath(
  new URL('./node_modules/harfbuzzjs/dist/harfbuzz.js', import.meta.url),
);

export default defineConfig({
  // Relative base: the built app works from any folder or sub-path
  // (Vercel, Netlify, GitHub Pages, a school's local server).
  base: './',
  resolve: {
    alias: [
      // The raw Emscripten factory of HarfBuzz (not exported by the package's
      // "exports" map). We wrap it ourselves in src/lib/pdf/hb.ts so the
      // WebAssembly file is loaded lazily and precached for offline use.
      { find: /^hb-emscripten$/, replacement: hbEmscripten },
    ],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'CCE नोंदवही',
        short_name: 'CCE',
        description: 'सातत्यपूर्ण सर्वंकष मूल्यमापन — शिक्षकांसाठी मराठी डिजिटल नोंदवही (ऑफलाइन)',
        lang: 'mr',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#F2F5F9',
        theme_color: '#1D4A86',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,ttf,woff2,wasm,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
      },
      devOptions: { enabled: false },
    }),
  ],
  optimizeDeps: { exclude: ['harfbuzzjs'] },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  server: { host: true },
});
