/** Global autosave status ("जतन झाले ✓") shown in the top bar. */
import { useSyncExternalStore } from 'react';

export type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: number } | { kind: 'error'; message: string };

let state: SaveState = { kind: 'idle' };
const listeners = new Set<() => void>();
let pending = 0;

function emit(s: SaveState) {
  state = s;
  for (const l of listeners) l();
}

/** Wrap any local write: shows saving → saved / error. */
export async function track<T>(p: Promise<T>): Promise<T> {
  pending++;
  emit({ kind: 'saving' });
  try {
    const r = await p;
    pending--;
    if (pending === 0) emit({ kind: 'saved', at: Date.now() });
    return r;
  } catch (e) {
    pending--;
    emit({ kind: 'error', message: e instanceof Error ? e.message : 'माहिती जतन करताना अडचण आली.' });
    throw e;
  }
}

export function useSaveStatus(): SaveState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
