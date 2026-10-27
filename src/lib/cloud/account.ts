/**
 * Online accounts on this device.
 *
 * An online account is a local teacher account whose id equals the server
 * account id (`user.cloud`). The device keeps a PBKDF2 hash of the password so
 * the account also opens offline, and a session token for syncing.
 */
import { db } from '../db';
import { hashPassword, verifyPassword } from '../crypto';
import { DEFAULT_YEAR } from '../labels';
import * as repo from '../repo';
import type { User } from '../types';
import { api, CloudError, type CloudAccount } from './api';

export function normalizePhone(v: string): string | null {
  const d = v.replace(/[०-९]/g, (c) => String('०१२३४५६७८९'.indexOf(c))).replace(/\D/g, '');
  const m = /^(?:91|0)?([6-9]\d{9})$/.exec(d);
  return m ? m[1] : null;
}

/** Point a local account (its classes and sessions) at a new id. */
async function rekey(oldId: string, newId: string): Promise<void> {
  if (oldId === newId) return;
  await db.transaction('rw', [db.users, db.classes, db.sessions], async () => {
    const classes = await db.classes.where('teacherId').equals(oldId).toArray();
    for (const c of classes) await db.classes.put({ ...c, teacherId: newId });
    const sessions = await db.sessions.where('userId').equals(oldId).toArray();
    for (const s of sessions) await db.sessions.put({ ...s, userId: newId });
    const u = await db.users.get(oldId);
    await db.users.delete(oldId);
    if (u) await db.users.put({ ...u, id: newId });
  });
}

export class NameClashError extends Error {
  constructor() {
    super('या उपकरणावर याच वापरकर्ता नावाचे दुसरे (फक्त या उपकरणावरील) खाते आहे. त्या खात्याने लॉगिन करून ते ऑनलाइन जोडा किंवा दुसरे उपकरण वापरा.');
    this.name = 'NameClashError';
  }
}

/**
 * Make the online account usable here: create (or update) the teacher
 * account, store the password hash for offline use and the session token for
 * syncing. `sameName` is a device-only account with the same login whose
 * password matched: its data joins the online account.
 */
export async function adoptAccount(account: CloudAccount, token: string, password: string, sameName?: User): Promise<User> {
  const clash = await repo.getUserByUsername(account.username);
  if (clash && clash.id !== account.id && clash.id !== sameName?.id) throw new NameClashError();
  let existing = await db.users.get(account.id);
  if (!existing && sameName && sameName.role === 'teacher' && sameName.id !== account.id) {
    await rekey(sameName.id, account.id);
    existing = await db.users.get(account.id);
  }
  const pw = existing && (await verifyPassword(password, existing)) ? { pwHash: existing.pwHash, pwSalt: existing.pwSalt, pwIter: existing.pwIter } : await hashPassword(password);
  const t = Date.now();
  const user: User = {
    id: account.id,
    username: account.username,
    displayName: account.displayName || existing?.displayName || '',
    role: 'teacher',
    standard: account.standard ?? existing?.standard ?? null,
    section: account.section || existing?.section || 'अ',
    ...pw,
    mustChangePassword: false,
    active: true,
    createdAt: existing?.createdAt ?? t,
    updatedAt: t,
    lastLoginAt: existing?.lastLoginAt ?? null,
    cloud: true,
    phone: account.phone,
  };
  await db.transaction('rw', [db.users, db.syncState, db.meta], async () => {
    await db.users.put(user);
    const st = await db.syncState.get(account.id);
    await db.syncState.put({ acct: account.id, token, cursor: st?.cursor ?? 0, lastSyncAt: st?.lastSyncAt ?? null, lastError: '', profileDirty: st?.profileDirty });
    const meta = await repo.getMeta();
    if (!meta?.setupDone) await repo.saveMeta({ setupDone: true, years: [DEFAULT_YEAR], currentYear: DEFAULT_YEAR, createdAt: t });
  });
  return user;
}

/** Has this device ever completed a sync for the account? */
export async function hasSynced(acct: string): Promise<boolean> {
  return !!(await db.syncState.get(acct))?.lastSyncAt;
}

/**
 * Put an existing local (device-only) account online: create the online
 * account with the same login and password, or join the online account that
 * already has this username and password.
 */
export async function linkLocalAccount(userId: string, password: string, phoneRaw: string, newUsername?: string): Promise<User> {
  const u = await db.users.get(userId);
  if (!u || u.role !== 'teacher') throw new Error('खाते सापडले नाही.');
  if (!(await verifyPassword(password, u))) throw new CloudError('bad_password');
  const phone = normalizePhone(phoneRaw);
  if (!phone) throw new CloudError('invalid_phone');
  const username = (newUsername ?? u.username).trim().toLowerCase();
  let session;
  try {
    session = await api.register({ username, password, displayName: u.displayName, phone, standard: u.standard ?? 1, section: u.section || 'अ' });
  } catch (e) {
    if (!(e instanceof CloudError) || e.code !== 'username_taken') throw e;
    // the same teacher may have created it on another device already
    try {
      session = await api.login(username, password);
    } catch {
      throw e;
    }
  }
  return adoptAccount(session.account, session.token, password, u);
}

/* ------------------------------------------------------------------ */
/* Password while signed in (kept in memory only, to put an account     */
/* online without asking for it again)                                  */
/* ------------------------------------------------------------------ */
let remembered: { userId: string; password: string } | null = null;

export function rememberPassword(userId: string, password: string): void {
  remembered = { userId, password };
}

export function rememberedPassword(userId: string): string | null {
  return remembered?.userId === userId ? remembered.password : null;
}

export function forgetPassword(): void {
  remembered = null;
}
