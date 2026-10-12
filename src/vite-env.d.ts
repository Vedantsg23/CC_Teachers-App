/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** HarfBuzz Emscripten factory (aliased in vite.config.ts). */
declare module 'hb-emscripten' {
  const createHarfBuzz: (opts?: { locateFile?: (path: string) => string }) => Promise<unknown>;
  export default createHarfBuzz;
}
