/** PWA: service-worker registration, update prompt, install prompt, online state. */
import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  needRefresh: boolean;
  offlineReady: boolean;
  canInstall: boolean;
  installed: boolean;
}

let state: PwaState = { needRefresh: false, offlineReady: false, canInstall: false, installed: false };
const listeners = new Set<() => void>();
function set(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function initPwa() {
  set({ installed: isStandalone() });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    set({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    set({ canInstall: false, installed: true });
  });
  if ('serviceWorker' in navigator) {
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        set({ needRefresh: true });
      },
      onOfflineReady() {
        set({ offlineReady: true });
      },
    });
  }
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  set({ canInstall: false });
  return choice.outcome;
}

export async function applyUpdate() {
  if (updateSW) await updateSW(true);
  else window.location.reload();
}

export function dismissUpdate() {
  set({ needRefresh: false });
}

export function usePwa(): PwaState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/* online / offline */
let online = typeof navigator === 'undefined' ? true : navigator.onLine;
const onlineListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  const upd = () => {
    online = navigator.onLine;
    for (const l of onlineListeners) l();
  };
  window.addEventListener('online', upd);
  window.addEventListener('offline', upd);
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (l) => {
      onlineListeners.add(l);
      return () => onlineListeners.delete(l);
    },
    () => online,
  );
}

/** Ask the browser not to evict our IndexedDB data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}

export async function storageInfo(): Promise<{ persisted: boolean; usage: number; quota: number }> {
  try {
    const persisted = (await navigator.storage?.persisted?.()) ?? false;
    const est = (await navigator.storage?.estimate?.()) ?? {};
    return { persisted, usage: est.usage ?? 0, quota: est.quota ?? 0 };
  } catch {
    return { persisted: false, usage: 0, quota: 0 };
  }
}
