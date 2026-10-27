/**
 * Two-way sync of one online account's data between this device and the
 * server. The device database stays the working copy (the app keeps working
 * offline); the server keeps every record of the account:
 *
 *   classes + all class-owned tables of the account's classes, and the
 *   school-level settings (school, दाखला नमुना, दाखला क्रमांक).
 *
 * Change detection uses a fingerprint of each record as last exchanged with
 * the server (`syncShadow`): a different fingerprint means "edited here", a
 * fingerprint without a record means "deleted here". Pull first (newer edit
 * wins when both sides changed the same record), then push.
 */
import Dexie, { type Table } from 'dexie';
import { useSyncExternalStore } from 'react';
import { CLASS_TABLES, db } from '../db';
import type { AppMeta, SyncState, User } from '../types';
import { api, CloudError, CloudUnavailable, type Change, type CloudAccount, type CloudRecord } from './api';
import { fingerprint } from './canon';

export const META_KEYS = ['school', 'lcTemplate', 'lcCounter'] as const;
const DATA_TABLES = ['classes', ...CLASS_TABLES] as const;
const ALLOWED = new Set<string>(['meta', ...DATA_TABLES]);

type Row = Record<string, unknown>;
interface Rec {
  tbl: string;
  id: string;
  data: Row;
}

/* ------------------------------------------------------------------ */
/* Status (shown in the top bar)                                        */
/* ------------------------------------------------------------------ */
export type SyncStatus =
  | { kind: 'local' } // not an online account
  | { kind: 'syncing' }
  | { kind: 'ok'; at: number }
  | { kind: 'offline'; at: number | null }
  | { kind: 'auth' } // must log in online again
  | { kind: 'error'; message: string };

let status: SyncStatus = { kind: 'local' };
const listeners = new Set<() => void>();
function setStatus(s: SyncStatus) {
  status = s;
  for (const l of listeners) l();
}
export function getSyncStatus(): SyncStatus {
  return status;
}
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

/* ------------------------------------------------------------------ */
/* Local records of an account                                          */
/* ------------------------------------------------------------------ */
const shadowKey = (acct: string, tbl: string, id: string) => `${acct}|${tbl}|${id}`;

function tableOf(tbl: string): Table {
  return db.table(tbl);
}

/** What is sent for a row (student photos are no longer used and stay on the device). */
function outgoing(tbl: string, row: Row): Row {
  if (tbl === 'students' && row.photo) return { ...row, photo: '' };
  return row;
}

export async function collectLocal(acct: string): Promise<Map<string, Rec>> {
  const out = new Map<string, Rec>();
  const classes = await db.classes.where('teacherId').equals(acct).toArray();
  for (const c of classes) out.set(`classes|${c.id}`, { tbl: 'classes', id: c.id, data: c as unknown as Row });
  const ids = classes.map((c) => c.id);
  if (ids.length) {
    for (const t of CLASS_TABLES) {
      const rows = (await tableOf(t).where('classId').anyOf(ids).toArray()) as Row[];
      for (const r of rows) out.set(`${t}|${String(r.id)}`, { tbl: t, id: String(r.id), data: outgoing(t, r) });
    }
  }
  for (const k of META_KEYS) {
    const row = await db.meta.get(k);
    if (row) out.set(`meta|${k}`, { tbl: 'meta', id: k, data: { key: k, value: row.value } });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Pull                                                                 */
/* ------------------------------------------------------------------ */
const updatedAt = (r: Row | undefined): number => (typeof r?.updatedAt === 'number' ? r.updatedAt : 0);

/** Apply server records; returns the number of local rows written/deleted. */
export async function applyRemote(acct: string, recs: CloudRecord[]): Promise<number> {
  const byTbl = new Map<string, CloudRecord[]>();
  for (const r of recs) {
    if (!ALLOWED.has(r.tbl)) continue;
    const list = byTbl.get(r.tbl) ?? [];
    list.push(r);
    byTbl.set(r.tbl, list);
  }
  let n = 0;
  const years = new Set<string>();
  await db.transaction('rw', [db.syncShadow, db.meta, ...DATA_TABLES.map(tableOf)], async () => {
    for (const [tbl, list] of byTbl) {
      const table = tableOf(tbl);
      const ids = list.map((r) => r.id);
      const locals = (await table.bulkGet(ids)) as (Row | undefined)[];
      const keys = ids.map((id) => shadowKey(acct, tbl, id));
      const shadows = await db.syncShadow.bulkGet(keys);
      const puts: Row[] = [];
      const dels: string[] = [];
      const shPut: { key: string; acct: string; hash: string }[] = [];
      const shDel: string[] = [];
      list.forEach((r, i) => {
        const raw = locals[i];
        const local = raw ? (tbl === 'meta' ? { key: raw.key, value: raw.value } : outgoing(tbl, raw)) : undefined;
        const sh = shadows[i]?.hash;
        const localHash = local ? fingerprint(local) : undefined;
        // edited here, or deleted here, since the last exchange
        const dirty = local ? localHash !== sh : sh !== undefined;
        if (r.deleted || !r.data) {
          if (local && dirty) return; // the local edit wins and is sent again
          if (raw) dels.push(r.id);
          if (sh !== undefined) shDel.push(keys[i]);
          return;
        }
        const data = r.data;
        const remoteHash = fingerprint(data);
        if (local && localHash === remoteHash) {
          if (sh !== remoteHash) shPut.push({ key: keys[i], acct, hash: remoteHash });
          return;
        }
        if (local && dirty && (tbl === 'meta' || updatedAt(local) >= updatedAt(data))) return; // newer local edit
        puts.push(tbl === 'meta' ? { key: r.id, value: data.value } : data);
        shPut.push({ key: keys[i], acct, hash: remoteHash });
        if (tbl === 'classes' && typeof data.year === 'string') years.add(data.year);
      });
      if (puts.length) await table.bulkPut(puts);
      if (dels.length) await table.bulkDelete(dels);
      if (shPut.length) await db.syncShadow.bulkPut(shPut);
      if (shDel.length) await db.syncShadow.bulkDelete(shDel);
      n += puts.length + dels.length;
    }
    if (years.size) {
      // a class of another सन arrived: make the year selectable on this device
      const row = await db.meta.get('app');
      const meta = row?.value as AppMeta | undefined;
      if (meta) {
        const all = [...new Set([...meta.years, ...years])].sort();
        if (all.length !== meta.years.length) await db.meta.put({ key: 'app', value: { ...meta, years: all } });
      }
    }
  });
  return n;
}

async function pull(st: SyncState): Promise<{ applied: number; account: CloudAccount | null }> {
  let cursor = st.cursor || 0;
  let applied = 0;
  let account: CloudAccount | null = null;
  for (let guard = 0; guard < 500; guard++) {
    const r = await api.pull(st.token, cursor, 1000);
    account = r.account;
    if (r.records.length) applied += await applyRemote(st.acct, r.records);
    if (r.next !== cursor) {
      cursor = r.next;
      await db.syncState.update(st.acct, { cursor });
    }
    if (!r.more) break;
  }
  return { applied, account };
}

/* ------------------------------------------------------------------ */
/* Push                                                                 */
/* ------------------------------------------------------------------ */
async function push(st: SyncState): Promise<number> {
  const local = await collectLocal(st.acct);
  const shadows = await db.syncShadow.where('acct').equals(st.acct).toArray();
  const known = new Map(shadows.map((s) => [s.key, s.hash]));
  const out: { change: Change; key: string; hash: string | null }[] = [];
  for (const [k, r] of local) {
    const key = `${st.acct}|${k}`;
    const h = fingerprint(r.data);
    if (known.get(key) !== h) out.push({ change: { tbl: r.tbl, id: r.id, data: r.data }, key, hash: h });
    known.delete(key);
  }
  for (const key of known.keys()) {
    const [, tbl, ...rest] = key.split('|');
    out.push({ change: { tbl, id: rest.join('|'), deleted: true }, key, hash: null });
  }
  let i = 0;
  while (i < out.length) {
    const batch: typeof out = [];
    let size = 0;
    while (i < out.length && batch.length < 400 && size < 1_500_000) {
      size += JSON.stringify(out[i].change).length;
      batch.push(out[i++]);
    }
    await api.push(
      st.token,
      batch.map((b) => b.change),
    );
    await db.transaction('rw', db.syncShadow, async () => {
      const put = batch.filter((b) => b.hash !== null).map((b) => ({ key: b.key, acct: st.acct, hash: b.hash as string }));
      if (put.length) await db.syncShadow.bulkPut(put);
      const del = batch.filter((b) => b.hash === null).map((b) => b.key);
      if (del.length) await db.syncShadow.bulkDelete(del);
    });
  }
  return out.length;
}

/* ------------------------------------------------------------------ */
/* Profile (वर्गशिक्षकाचे नाव, तुकडी, मोबाईल)                               */
/* ------------------------------------------------------------------ */
async function syncProfile(st: SyncState, account: CloudAccount | null): Promise<void> {
  const user = await db.users.get(st.acct);
  if (!user) return;
  if (st.profileDirty) {
    const r = await api.updateProfile(st.token, user.displayName, user.section || 'अ');
    await db.syncState.update(st.acct, { profileDirty: false });
    account = r.account;
  }
  if (!account) return;
  const patch: Partial<User> = {};
  if (account.displayName && account.displayName !== user.displayName) patch.displayName = account.displayName;
  if (account.section && account.section !== user.section) patch.section = account.section;
  if (account.phone && account.phone !== user.phone) patch.phone = account.phone;
  if (account.username && account.username !== user.username) patch.username = account.username;
  if (Object.keys(patch).length) await db.users.update(st.acct, { ...patch, updatedAt: Date.now() });
}

/** Remember that the profile changed here (sent with the next sync). */
export async function markProfileDirty(acct: string): Promise<void> {
  if (await db.syncState.get(acct)) await db.syncState.update(acct, { profileDirty: true });
}

/* ------------------------------------------------------------------ */
/* One sync round                                                       */
/* ------------------------------------------------------------------ */
let chain: Promise<unknown> = Promise.resolve();

export interface SyncResult {
  ok: boolean;
  pulled: number;
  pushed: number;
}

export function syncAccount(acct: string): Promise<SyncResult> {
  const run = async (): Promise<SyncResult> => {
    const st = await db.syncState.get(acct);
    if (!st) {
      setStatus({ kind: 'local' });
      return { ok: false, pulled: 0, pushed: 0 };
    }
    if (!st.token) {
      setStatus({ kind: 'auth' });
      return { ok: false, pulled: 0, pushed: 0 };
    }
    setStatus({ kind: 'syncing' });
    try {
      const { applied, account } = await pull(st);
      await syncProfile((await db.syncState.get(acct)) ?? st, account);
      const pushed = await push(st);
      const at = Date.now();
      await db.syncState.update(acct, { lastSyncAt: at, lastError: '' });
      setStatus({ kind: 'ok', at });
      return { ok: true, pulled: applied, pushed };
    } catch (e) {
      if (e instanceof CloudError && e.code === 'bad_token') {
        await db.syncState.update(acct, { token: '', lastError: 'bad_token' });
        setStatus({ kind: 'auth' });
      } else if (e instanceof CloudUnavailable) {
        setStatus({ kind: 'offline', at: st.lastSyncAt });
      } else {
        const message = e instanceof Error ? e.message : String(e);
        await db.syncState.update(acct, { lastError: message }).catch(() => undefined);
        setStatus({ kind: 'error', message });
      }
      return { ok: false, pulled: 0, pushed: 0 };
    }
  };
  const p = chain.then(run, run);
  chain = p.catch(() => undefined);
  return p;
}

/* ------------------------------------------------------------------ */
/* Automatic sync while an online account is signed in                 */
/* ------------------------------------------------------------------ */
let stopFn: (() => void) | null = null;

const IGNORE = new Set(['syncState', 'syncShadow', 'sessions', 'users']);

export function startAutoSync(acct: string, opts: { intervalMs?: number; debounceMs?: number } = {}): void {
  stopAutoSync();
  const debounceMs = opts.debounceMs ?? 2500;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const kick = (delay = debounceMs) => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!stopped) void syncAccount(acct);
    }, delay);
  };
  // React to changes of the class data, not to the sync bookkeeping. Rows
  // written by a pull cause one more (quiet) round, which writes no data.
  const onMutate = (parts: Record<string, unknown>) => {
    const touched = Object.keys(parts)
      .map((p) => p.split('/')[3])
      .filter(Boolean);
    if (touched.some((t) => !IGNORE.has(t))) kick();
  };
  const onOnline = () => kick(500);
  const onVisible = () => {
    if (document.visibilityState === 'visible') kick(500);
  };
  Dexie.on.storagemutated.subscribe(onMutate);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const iv = setInterval(() => void syncAccount(acct), opts.intervalMs ?? 120_000);
  void syncAccount(acct);
  stopFn = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    clearInterval(iv);
    Dexie.on.storagemutated.unsubscribe(onMutate);
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export function stopAutoSync(): void {
  stopFn?.();
  stopFn = null;
  setStatus({ kind: 'local' });
}

/** Wait for any running sync round (used before signing out). */
export async function settle(): Promise<void> {
  await chain;
}
