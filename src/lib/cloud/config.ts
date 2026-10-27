/**
 * Online service (Supabase project "cc-teachers-app", Mumbai region).
 * The publishable key is meant to be public: it only lets the browser call
 * the `api_*` database functions, which check every session token themselves.
 * Builds for the end-to-end tests point VITE_CLOUD_URL at a local stand-in.
 */
const env = import.meta.env as Record<string, string | undefined>;

export const CLOUD_URL: string = (env.VITE_CLOUD_URL ?? 'https://lwwroelwrxkmcgdlqlqe.supabase.co').replace(/\/+$/, '');
export const CLOUD_KEY: string = env.VITE_CLOUD_KEY ?? 'sb_publishable__uzXLd-izc3hb72U_rp1tg_3u2t1nuQ';

/** Online accounts can be switched off at build time (VITE_CLOUD_URL=off). */
export const CLOUD_ENABLED = CLOUD_URL !== 'off' && CLOUD_URL !== '';
