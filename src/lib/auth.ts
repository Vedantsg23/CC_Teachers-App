/**
 * Accounts, first-time setup and sessions — all local (offline-first).
 *
 * - Passwords are stored only as PBKDF2-SHA256 hashes with a random salt.
 * - A session is a random token kept in sessionStorage (or localStorage when
 *   "मला लॉगिन ठेवा" is ticked); the token maps to a row in IndexedDB, and
 *   the class is always derived from the user record — never from storage.
 */
import { db } from './db';
import { hashPassword, randomBytes, toHex, uid, verifyPassword } from './crypto';
import { DEFAULT_YEAR } from './labels';
import * as repo from './repo';
import type { AppMeta, ClassRoom, Role, School, User } from './types';
import { validatePassword, validateUsername } from './validation';

const TOKEN_KEY = 'cce.session';
const SESSION_HOURS = 12;
const REMEMBER_DAYS = 30;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30_000;

export interface AuthState {
  user: User;
  year: string;
  classRoom: ClassRoom | null; // null for the admin account
  token: string;
}

export interface TeacherSetup {
  username: string;
  displayName: string;
  standard: number;
  section: string;
  password: string;
}

export interface SetupInput {
  school: School;
  year: string;
  adminPassword: string;
  teachers: TeacherSetup[];
}

function storageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageClear(key: string) {
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function storageSet(key: string, value: string, remember: boolean) {
  try {
    storageClear(key);
    (remember ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    /* ignore (private mode) */
  }
}

export async function newUser(input: {
  username: string;
  displayName: string;
  role: Role;
  standard: number | null;
  section: string;
  password: string;
  mustChangePassword?: boolean;
}): Promise<User> {
  const pw = await hashPassword(input.password);
  const t = Date.now();
  return {
    id: uid(),
    username: input.username.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    role: input.role,
    standard: input.standard,
    section: input.section,
    ...pw,
    mustChangePassword: input.mustChangePassword ?? false,
    active: true,
    createdAt: t,
    updatedAt: t,
    lastLoginAt: null,
  };
}

/** First launch: school info, admin + teacher accounts, classes for the year. */
export async function runSetup(input: SetupInput): Promise<void> {
  const errs: string[] = [];
  const pwErr = validatePassword(input.adminPassword);
  if (pwErr) errs.push(pwErr);
  const names = new Set<string>(['admin']);
  for (const t of input.teachers) {
    const u = validateUsername(t.username);
    if (u) errs.push(u);
    const p = validatePassword(t.password);
    if (p) errs.push(p);
    if (names.has(t.username)) errs.push(`"${t.username}" हे वापरकर्ता नाव दोनदा वापरले आहे.`);
    names.add(t.username);
  }
  if (errs.length) throw new Error(errs[0]);
  const existing = await repo.getMeta();
  if (existing?.setupDone) throw new Error('ॲपची प्राथमिक मांडणी आधीच पूर्ण झाली आहे.');

  const admin = await newUser({ username: 'admin', displayName: input.school.headmaster || 'मुख्याध्यापक', role: 'admin', standard: null, section: '', password: input.adminPassword });
  const teachers: User[] = [];
  for (const t of input.teachers) {
    teachers.push(
      await newUser({ username: t.username, displayName: t.displayName, role: 'teacher', standard: t.standard, section: t.section, password: t.password }),
    );
  }
  const year = input.year || DEFAULT_YEAR;
  const meta: AppMeta = { setupDone: true, years: [year], currentYear: year, createdAt: Date.now() };
  await db.transaction('rw', db.users, db.meta, async () => {
    await db.users.bulkAdd([admin, ...teachers]);
    await repo.saveSchool(input.school);
    await repo.saveMeta(meta);
  });
  for (const t of teachers) await repo.getOrCreateClass(t, year);
}

/* ------------------------------------------------------------------ */
/* Login throttling (per username, per device)                         */
/* ------------------------------------------------------------------ */

const attempts = new Map<string, { count: number; until: number }>();

export function lockRemainingMs(username: string): number {
  const a = attempts.get(username);
  if (!a) return 0;
  return Math.max(0, a.until - Date.now());
}

function recordFailure(username: string) {
  const a = attempts.get(username) ?? { count: 0, until: 0 };
  a.count++;
  if (a.count >= MAX_ATTEMPTS) {
    a.until = Date.now() + LOCK_MS;
    a.count = 0;
  }
  attempts.set(username, a);
}

export class LoginError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'LoginError';
  }
}

export async function login(usernameRaw: string, password: string, year: string, remember: boolean): Promise<AuthState> {
  const username = usernameRaw.trim().toLowerCase();
  const wait = lockRemainingMs(username);
  if (wait > 0) throw new LoginError(`अनेक चुकीचे प्रयत्न झाले. कृपया ${Math.ceil(wait / 1000)} सेकंदांनी पुन्हा प्रयत्न करा.`);
  const user = await repo.getUserByUsername(username);
  const ok = user ? await verifyPassword(password, user) : false;
  if (!user || !ok) {
    recordFailure(username);
    throw new LoginError('वापरकर्ता नाव किंवा पासवर्ड चुकीचा आहे.');
  }
  if (!user.active) throw new LoginError('हे खाते बंद केले आहे. कृपया मुख्याध्यापकांशी संपर्क साधा.');
  attempts.delete(username);

  const meta = await repo.getMeta();
  const useYear = meta?.years.includes(year) ? year : (meta?.currentYear ?? DEFAULT_YEAR);
  const classRoom = user.role === 'teacher' ? await repo.getOrCreateClass(user, useYear) : null;

  const token = toHex(randomBytes(32));
  const ttl = remember ? REMEMBER_DAYS * 86400_000 : SESSION_HOURS * 3600_000;
  await db.sessions.put({ token, userId: user.id, year: useYear, createdAt: Date.now(), expiresAt: Date.now() + ttl });
  await db.users.put({ ...user, lastLoginAt: Date.now() });
  storageSet(TOKEN_KEY, token, remember);
  return { user, year: useYear, classRoom, token };
}

/** Restore a session after refresh (works offline). */
export async function restoreSession(): Promise<AuthState | null> {
  const token = storageGet(TOKEN_KEY);
  if (!token) return null;
  const s = await db.sessions.get(token);
  if (!s || s.expiresAt < Date.now()) {
    if (s) await db.sessions.delete(token);
    storageClear(TOKEN_KEY);
    return null;
  }
  const user = await repo.getUser(s.userId);
  if (!user || !user.active) {
    await logout();
    return null;
  }
  const classRoom = user.role === 'teacher' ? await repo.getOrCreateClass(user, s.year) : null;
  return { user, year: s.year, classRoom, token };
}

export async function logout(): Promise<void> {
  const token = storageGet(TOKEN_KEY);
  storageClear(TOKEN_KEY);
  if (token) await db.sessions.delete(token);
  await db.sessions.where('expiresAt').below(Date.now()).delete();
}

export async function changeOwnPassword(userId: string, current: string, next: string, confirm: string): Promise<void> {
  const user = await repo.getUser(userId);
  if (!user) throw new Error('खाते सापडले नाही.');
  if (!(await verifyPassword(current, user))) throw new Error('सध्याचा पासवर्ड चुकीचा आहे.');
  const err = validatePassword(next, confirm);
  if (err) throw new Error(err);
  const pw = await hashPassword(next);
  await db.users.put({ ...user, ...pw, mustChangePassword: false, updatedAt: Date.now() });
}

/** Admin: set a new password for any account (the user must change it at next login). */
export async function adminResetPassword(adminId: string, userId: string, next: string): Promise<void> {
  const admin = await repo.getUser(adminId);
  if (!admin || admin.role !== 'admin') throw new Error('ही क्रिया फक्त मुख्याध्यापक/प्रशासक करू शकतात.');
  const err = validatePassword(next);
  if (err) throw new Error(err);
  const user = await repo.getUser(userId);
  if (!user) throw new Error('खाते सापडले नाही.');
  const pw = await hashPassword(next);
  await db.users.put({ ...user, ...pw, mustChangePassword: user.id !== adminId, updatedAt: Date.now() });
  // end that user's sessions
  await db.sessions.where('userId').equals(userId).delete();
}

export async function adminCreateTeacher(adminId: string, t: TeacherSetup): Promise<User> {
  const admin = await repo.getUser(adminId);
  if (!admin || admin.role !== 'admin') throw new Error('ही क्रिया फक्त मुख्याध्यापक/प्रशासक करू शकतात.');
  const uErr = validateUsername(t.username.trim().toLowerCase());
  if (uErr) throw new Error(uErr);
  const pErr = validatePassword(t.password);
  if (pErr) throw new Error(pErr);
  if (await repo.getUserByUsername(t.username)) throw new Error('हे वापरकर्ता नाव आधीच वापरले आहे.');
  if (!(t.standard >= 1 && t.standard <= 8)) throw new Error('कृपया इयत्ता निवडा.');
  const user = await newUser({ ...t, role: 'teacher', mustChangePassword: true });
  await db.users.add(user);
  return user;
}

export async function adminUpdateTeacher(adminId: string, userId: string, patch: { displayName?: string; section?: string; active?: boolean }): Promise<void> {
  const admin = await repo.getUser(adminId);
  if (!admin || admin.role !== 'admin') throw new Error('ही क्रिया फक्त मुख्याध्यापक/प्रशासक करू शकतात.');
  const user = await repo.getUser(userId);
  if (!user || user.role !== 'teacher') throw new Error('खाते सापडले नाही.');
  await db.users.put({ ...user, ...patch, updatedAt: Date.now() });
  if (patch.section) {
    const classes = await db.classes.where('teacherId').equals(userId).toArray();
    for (const c of classes) await db.classes.put({ ...c, section: patch.section, updatedAt: Date.now() });
  }
  if (patch.active === false) await db.sessions.where('userId').equals(userId).delete();
}
