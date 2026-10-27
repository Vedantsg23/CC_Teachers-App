/**
 * Accounts, first-time setup and sessions (offline-first).
 *
 * - Teacher accounts are online accounts (src/lib/cloud): the same login works
 *   on any phone, tablet or computer, and the class data is synced. Logging in
 *   still works offline on a device where the account was opened before.
 * - Passwords are stored here only as PBKDF2-SHA256 hashes with a random salt.
 * - A session is a random token in localStorage that maps to a row in
 *   IndexedDB; it does not expire — it ends with "बाहेर पडा". The class is
 *   always derived from the user record, never from storage.
 */
import { api, CloudError, CloudUnavailable, cloudMessage } from './cloud/api';
import { adoptAccount, hasSynced, NameClashError, normalizePhone, rememberPassword } from './cloud/account';
import { CLOUD_ENABLED } from './cloud/config';
import { syncAccount } from './cloud/sync';
import { db } from './db';
import { hashPassword, randomBytes, toHex, uid, verifyPassword } from './crypto';
import { DEFAULT_YEAR } from './labels';
import * as repo from './repo';
import type { AppMeta, ClassRoom, Role, School, User } from './types';
import { validatePassword, validateUsername } from './validation';

const TOKEN_KEY = 'cce.session';
/** Sessions end only with "बाहेर पडा" (no time limit). */
const NO_EXPIRY = 8_640_000_000_000_000;
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

function storageSet(key: string, value: string) {
  try {
    storageClear(key);
    localStorage.setItem(key, value);
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

export interface RegisterInput extends TeacherSetup {
  confirm: string;
  /** Mobile number: password / login-ID recovery by OTP. */
  phone: string;
  /** Asked only while this device has no school name yet. */
  schoolName?: string;
}

/** Field-level registration errors (Marathi), keyed by form field. */
export class RegisterError extends Error {
  field: keyof RegisterInput | '';
  constructor(field: keyof RegisterInput | '', msg: string) {
    super(msg);
    this.name = 'RegisterError';
    this.field = field;
  }
}

const CLOUD_FIELD: Record<string, keyof RegisterInput> = {
  invalid_username: 'username',
  username_taken: 'username',
  invalid_password: 'password',
  invalid_phone: 'phone',
  phone_limit: 'phone',
  invalid_name: 'displayName',
  invalid_standard: 'standard',
  invalid_section: 'section',
};

/**
 * A teacher creates their own account: choose the standard (इयत्ता 1–8) and
 * section, then a username, password and mobile number. The account sees only
 * its own class. Online, the account is created on the server (usable on any
 * device); without internet it is kept on this device and goes online at the
 * next login with internet (`online: false`).
 */
export async function registerTeacher(input: RegisterInput): Promise<{ user: User; online: boolean }> {
  const username = input.username.trim().toLowerCase();
  if (!(Number.isInteger(input.standard) && input.standard >= 1 && input.standard <= 8)) throw new RegisterError('standard', 'कृपया इयत्ता निवडा.');
  if (!input.section.trim()) throw new RegisterError('section', 'कृपया तुकडी निवडा.');
  if (!input.displayName.trim()) throw new RegisterError('displayName', 'कृपया वर्गशिक्षकाचे नाव भरा.');
  const uErr = validateUsername(username);
  if (uErr) throw new RegisterError('username', uErr);
  if (username === 'admin') throw new RegisterError('username', 'हे वापरकर्ता नाव आधीच वापरले आहे.');
  const phone = normalizePhone(input.phone ?? '');
  if (!phone) throw new RegisterError('phone', 'मोबाईल नंबर 10 अंकी असावा (उदा. 9876543210).');
  const pErr = validatePassword(input.password);
  if (pErr) throw new RegisterError('password', pErr);
  if (input.password !== input.confirm) throw new RegisterError('confirm', 'दोन्ही पासवर्ड सारखे नाहीत.');
  if (await repo.getUserByUsername(username)) throw new RegisterError('username', 'हे वापरकर्ता नाव आधीच वापरले आहे. दुसरे नाव निवडा.');

  let user: User | null = null;
  if (CLOUD_ENABLED) {
    try {
      const s = await api.register({ username, password: input.password, displayName: input.displayName.trim(), phone, standard: input.standard, section: input.section.trim() });
      user = await adoptAccount(s.account, s.token, input.password);
      await syncAccount(user.id); // nothing to fetch yet; confirms the token
    } catch (e) {
      if (e instanceof CloudError) throw new RegisterError(CLOUD_FIELD[e.code] ?? '', cloudMessage(e));
      if (!(e instanceof CloudUnavailable)) throw e;
    }
  }
  const online = !!user;
  if (!user) {
    // no internet: a device account that goes online at the next login
    user = { ...(await newUser({ username, displayName: input.displayName, role: 'teacher', standard: input.standard, section: input.section.trim(), password: input.password })), pendingPhone: phone };
  }
  let year = DEFAULT_YEAR;
  const u = user;
  await db.transaction('rw', db.users, db.meta, async () => {
    const meta = await repo.getMeta();
    if (!meta?.setupDone) {
      await repo.saveMeta({ setupDone: true, years: [DEFAULT_YEAR], currentYear: DEFAULT_YEAR, createdAt: Date.now() });
    } else {
      year = meta.currentYear;
    }
    const schoolName = input.schoolName?.trim();
    if (schoolName) {
      const school = await repo.getSchool();
      if (!school.name.trim()) await repo.saveSchool({ ...school, name: schoolName });
    }
    if (!online) await db.users.add(u);
  });
  await repo.getOrCreateClass(u, year);
  // lets a device-only account go online later in this session without asking again
  rememberPassword(u.id, input.password);
  return { user: u, online };
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

/** Start a session for an account that has been verified. */
export async function openSession(user: User, year: string): Promise<AuthState> {
  const meta = await repo.getMeta();
  const useYear = meta?.years.includes(year) ? year : (meta?.currentYear ?? DEFAULT_YEAR);
  const classRoom = user.role === 'teacher' ? await repo.getOrCreateClass(user, useYear) : null;
  const token = toHex(randomBytes(32));
  await db.sessions.put({ token, userId: user.id, year: useYear, createdAt: Date.now(), expiresAt: NO_EXPIRY });
  await db.users.update(user.id, { lastLoginAt: Date.now() });
  storageSet(TOKEN_KEY, token);
  return { user, year: useYear, classRoom, token };
}

/**
 * Teachers: the online account first (works on any device, brings the class
 * data to this device); without internet, the copy kept on this device.
 * The headmaster (admin) account is local to its device.
 */
export async function login(usernameRaw: string, password: string, year: string): Promise<AuthState> {
  const username = usernameRaw.trim().toLowerCase();
  const wait = lockRemainingMs(username);
  if (wait > 0) throw new LoginError(`अनेक चुकीचे प्रयत्न झाले. कृपया ${Math.ceil(wait / 1000)} सेकंदांनी पुन्हा प्रयत्न करा.`);
  const local = await repo.getUserByUsername(username);
  const localOk = local ? await verifyPassword(password, local) : false;

  if (CLOUD_ENABLED && local?.role !== 'admin') {
    try {
      const s = await api.login(username, password);
      // a device-only account with this login joins the online account only if its password matches too
      if (local && !local.cloud && local.id !== s.account.id && !localOk) throw new NameClashError();
      const user = await adoptAccount(s.account, s.token, password, local && localOk ? local : undefined);
      const fresh = !(await hasSynced(user.id));
      const r = await syncAccount(user.id);
      if (!r.ok && fresh && !(await db.classes.where('teacherId').equals(user.id).count())) {
        throw new LoginError('तुमची माहिती आणता आली नाही. इंटरनेट तपासून पुन्हा लॉगिन करा.');
      }
      attempts.delete(username);
      rememberPassword(user.id, password);
      return openSession((await repo.getUser(user.id)) ?? user, year);
    } catch (e) {
      if (e instanceof LoginError) throw e;
      if (e instanceof NameClashError) throw new LoginError(e.message);
      if (e instanceof CloudError) {
        if (e.code === 'bad_credentials') {
          // not (yet) an online account: a device-only account opens with its own password
          if (local && !local.cloud && localOk) return localLogin(local, password, year);
          recordFailure(username);
          throw new LoginError(
            local?.cloud && localOk ? 'हा पासवर्ड बदलला आहे. नवीन पासवर्ड वापरा (विसरल्यास “पासवर्ड विसरलात?”).' : 'वापरकर्ता नाव किंवा पासवर्ड चुकीचा आहे.',
          );
        }
        throw new LoginError(cloudMessage(e));
      }
      if (!(e instanceof CloudUnavailable)) throw e;
      // no internet / service unreachable: continue with this device's copy
      if (!local) {
        recordFailure(username);
        throw new LoginError(
          typeof navigator !== 'undefined' && navigator.onLine === false
            ? 'इंटरनेट नाही. हे खाते या उपकरणावर पहिल्यांदा उघडण्यासाठी इंटरनेट सुरू करा.'
            : 'ऑनलाइन सेवेशी संपर्क होऊ शकला नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.',
        );
      }
    }
  }
  if (!local || !localOk) {
    recordFailure(username);
    throw new LoginError('वापरकर्ता नाव किंवा पासवर्ड चुकीचा आहे.');
  }
  return localLogin(local, password, year);
}

async function localLogin(user: User, password: string, year: string): Promise<AuthState> {
  if (!user.active) throw new LoginError('हे खाते बंद केले आहे. कृपया मुख्याध्यापकांशी संपर्क साधा.');
  attempts.delete(user.username);
  if (user.role === 'teacher') rememberPassword(user.id, password);
  return openSession(user, year);
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
  if (user.cloud) {
    // the online account has one password for every device
    const st = await db.syncState.get(user.id);
    if (!st?.token) throw new Error('पासवर्ड बदलण्यासाठी आधी इंटरनेटसह पुन्हा लॉगिन करा.');
    try {
      await api.changePassword(st.token, current, next);
    } catch (e) {
      throw new Error(e instanceof CloudUnavailable ? 'पासवर्ड बदलण्यासाठी इंटरनेट आवश्यक आहे.' : cloudMessage(e), { cause: e });
    }
    rememberPassword(user.id, next);
  }
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
  if (user.cloud) throw new Error('हे ऑनलाइन खाते आहे — शिक्षकांनी लॉगिन पानावरील “पासवर्ड विसरलात?” वापरून मोबाईल OTP ने नवीन पासवर्ड ठेवावा.');
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
