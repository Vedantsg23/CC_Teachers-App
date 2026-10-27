/** Stand-in for vite-plugin-pwa's virtual module in unit tests. */
export function registerSW(): (reload?: boolean) => Promise<void> {
  return async () => undefined;
}
