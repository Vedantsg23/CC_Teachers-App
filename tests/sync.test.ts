/**
 * Online accounts: the same login on two devices, two-way sync, deletions,
 * conflicts, putting a device-only account online — against an in-memory
 * stand-in for the server that behaves like the SQL functions (sequence
 * numbers, JSONB key order, token checks).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/cloud/config', () => ({ CLOUD_ENABLED: true, CLOUD_URL: 'http://fake.invalid', CLOUD_KEY: 'test' }));

import { db } from '../src/lib/db';
import { login, logout, registerTeacher, type RegisterInput } from '../src/lib/auth';
import { api, CloudError, CloudUnavailable, type CloudAccount, type CloudRecord, type Change } from '../src/lib/cloud/api';
import { linkLocalAccount } from '../src/lib/cloud/account';
import { syncAccount } from '../src/lib/cloud/sync';
import { classResults } from '../src/lib/calc';
import * as repo from '../src/lib/repo';
import { seedDemo } from '../src/lib/demo';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
Object.assign(globalThis, { sessionStorage: new MemStorage(), localStorage: new MemStorage() });

/* ------------------------------------------------------------------ */
/* In-memory server                                                     */
/* ------------------------------------------------------------------ */
const sortKeys = (v: unknown): unknown =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(
        Object.keys(v as object)
          .sort((a, b) => a.length - b.length || (a < b ? -1 : 1))
          .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
      )
    : Array.isArray(v)
      ? v.map(sortKeys)
      : v;
const jsonb = <T>(v: T): T => JSON.parse(JSON.stringify(sortKeys(v)));

interface Acc extends CloudAccount {
  password: string;
}
const server = {
  online: true,
  seq: 0,
  accounts: new Map<string, Acc>(),
  tokens: new Map<string, string>(),
  records: new Map<string, CloudRecord & { acct: string }>(),
  reset() {
    this.online = true;
    this.seq = 0;
    this.accounts.clear();
    this.tokens.clear();
    this.records.clear();
  },
};
let n = 0;
const token = (acct: string) => {
  const t = `${String(++n).padStart(8, '0')}${'a'.repeat(56)}`;
  server.tokens.set(t, acct);
  return t;
};
const pub = (a: Acc): CloudAccount => ({
  id: a.id,
  username: a.username,
  displayName: a.displayName,
  phone: a.phone,
  standard: a.standard,
  section: a.section,
  updatedAt: a.updatedAt,
});
function up() {
  if (!server.online) throw new CloudUnavailable('network');
}
function acctOf(t: string): string {
  const a = server.tokens.get(t);
  if (!a) throw new CloudError('bad_token');
  return a;
}

vi.spyOn(api, 'register').mockImplementation(async (a) => {
  up();
  if ([...server.accounts.values()].some((x) => x.username === a.username)) throw new CloudError('username_taken');
  const acc: Acc = {
    id: crypto.randomUUID(),
    username: a.username,
    displayName: a.displayName,
    phone: a.phone,
    standard: a.standard,
    section: a.section,
    updatedAt: new Date().toISOString(),
    password: a.password,
  };
  server.accounts.set(acc.id, acc);
  return { ok: true, token: token(acc.id), account: pub(acc) };
});
vi.spyOn(api, 'login').mockImplementation(async (u, p) => {
  up();
  const acc = [...server.accounts.values()].find((x) => x.username === u.trim().toLowerCase());
  if (!acc || acc.password !== p) throw new CloudError('bad_credentials');
  return { ok: true, token: token(acc.id), account: pub(acc) };
});
vi.spyOn(api, 'push').mockImplementation(async (t, changes: Change[]) => {
  up();
  const acct = acctOf(t);
  for (const c of changes) {
    server.records.set(`${acct}|${c.tbl}|${c.id}`, {
      acct,
      tbl: c.tbl,
      id: c.id,
      data: c.deleted ? null : jsonb(c.data as Record<string, unknown>),
      deleted: !!c.deleted,
      seq: ++server.seq,
    });
  }
  return { ok: true, count: changes.length };
});
vi.spyOn(api, 'pull').mockImplementation(async (t, since, limit = 1000) => {
  up();
  const acct = acctOf(t);
  const list = [...server.records.values()].filter((r) => r.acct === acct && r.seq > since).sort((a, b) => a.seq - b.seq);
  const page = list.slice(0, limit).map(({ acct: _a, ...r }) => jsonb(r));
  const acc = server.accounts.get(acct)!;
  return { ok: true, records: page, next: page.length ? page[page.length - 1].seq : since, more: list.length > limit, account: pub(acc) };
});
vi.spyOn(api, 'updateProfile').mockImplementation(async (t, displayName, section) => {
  up();
  const acc = server.accounts.get(acctOf(t))!;
  Object.assign(acc, { displayName, section, updatedAt: new Date().toISOString() });
  return { ok: true, account: pub(acc) };
});
vi.spyOn(api, 'changePassword').mockImplementation(async (t, cur, next) => {
  up();
  const id = acctOf(t);
  const acc = server.accounts.get(id)!;
  if (acc.password !== cur) throw new CloudError('bad_password');
  acc.password = next;
  for (const [k, v] of server.tokens) if (v === id && k !== t) server.tokens.delete(k);
  return { ok: true };
});

/* ------------------------------------------------------------------ */
/* Devices: the device database is swapped in and out                  */
/* ------------------------------------------------------------------ */
type Snapshot = Record<string, unknown[]>;
async function snapshot(): Promise<Snapshot> {
  const out: Snapshot = {};
  for (const t of db.tables) out[t.name] = await t.toArray();
  return out;
}
async function restore(s: Snapshot | null) {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      await t.clear();
      if (s?.[t.name]?.length) await t.bulkAdd(s[t.name]);
    }
  });
}
const devices: Record<string, Snapshot | null> = { A: null, B: null };
let current: 'A' | 'B' = 'A';
async function use(d: 'A' | 'B') {
  devices[current] = await snapshot();
  current = d;
  await restore(devices[d]);
  sessionStorage.clear();
  localStorage.clear();
}

const reg: RegisterInput = {
  standard: 7,
  section: 'ब',
  displayName: 'सौ. नमुना शिक्षिका',
  username: 'kale7',
  password: 'pass7777',
  confirm: 'pass7777',
  phone: '9876543210',
  schoolName: 'नमुना शाळा',
};

beforeAll(async () => {
  await db.delete();
  await db.open();
  server.reset();
});

describe('online account on two devices', () => {
  let acct = '';
  let scopeA: repo.Scope;

  it('registers online and keeps a class on device A', async () => {
    const r = await registerTeacher(reg);
    expect(r.online).toBe(true);
    expect(r.user.cloud).toBe(true);
    acct = r.user.id;
    expect(server.accounts.get(acct)?.username).toBe('kale7');
    const st = await login('kale7', 'pass7777', '2026-27');
    scopeA = { classId: st.classRoom!.id, userId: st.user.id };
    await seedDemo(scopeA);
    const res = await syncAccount(acct);
    expect(res.ok).toBe(true);
    const tbls = new Set([...server.records.values()].map((x) => x.tbl));
    for (const t of ['classes', 'students', 'assessments', 'remarks', 'remarkLibrary', 'meta']) expect(tbls.has(t), t).toBe(true);
  });

  it('a second sync sends nothing (fingerprints match, also after the JSONB echo)', async () => {
    const before = server.seq;
    const r = await syncAccount(acct);
    expect(r.pushed).toBe(0);
    expect(server.seq).toBe(before);
  });

  it('device B: the same login brings every record', async () => {
    const studentsA = await repo.listStudents(scopeA, { includeLeft: true });
    const resultsA = classResults((await repo.getClass(scopeA)).config, studentsA, await db.assessments.where('classId').equals(scopeA.classId).toArray());
    await use('B');
    expect(await db.users.count()).toBe(0);
    const st = await login('kale7', 'pass7777', '2026-27');
    expect(st.classRoom!.id).toBe(scopeA.classId); // the same class, not a new one
    const scopeB = { classId: st.classRoom!.id, userId: st.user.id };
    const studentsB = await repo.listStudents(scopeB, { includeLeft: true });
    expect(studentsB.map((s) => s.id).sort()).toEqual(studentsA.map((s) => s.id).sort());
    const resultsB = classResults(st.classRoom!.config, studentsB, await db.assessments.where('classId').equals(scopeB.classId).toArray());
    for (const s of studentsA) expect(resultsB.get(s.id)?.annual.total).toBe(resultsA.get(s.id)?.annual.total);
    expect((await repo.getSchool()).name).toBe('नमुना शाळा');
    // nothing to send back
    expect((await syncAccount(acct)).pushed).toBe(0);
  });

  it('edits and deletions travel both ways', async () => {
    const scope = { classId: scopeA.classId, userId: acct };
    const [s1, s2] = await repo.listStudents(scope);
    await repo.saveStudent(scope, { ...s1, fullName: 'बदललेले नाव बी', aadhaar: '234123412346' });
    await repo.deleteStudent(scope, s2.id);
    expect((await syncAccount(acct)).ok).toBe(true);
    await use('A');
    expect((await syncAccount(acct)).ok).toBe(true);
    expect((await repo.getStudent(scope, s1.id)).fullName).toBe('बदललेले नाव बी');
    expect((await repo.getStudent(scope, s1.id)).aadhaar).toBe('234123412346');
    await expect(repo.getStudent(scope, s2.id)).rejects.toBeTruthy();
    expect(await db.assessments.where('studentId').equals(s2.id).count()).toBe(0);
  });

  it('when both devices change the same record offline, the later edit wins', async () => {
    const scope = { classId: scopeA.classId, userId: acct };
    const [s1] = await repo.listStudents(scope);
    server.online = false;
    await repo.saveStudent(scope, { ...s1, address: 'A चा पत्ता' }); // device A, earlier
    expect((await syncAccount(acct)).ok).toBe(false);
    await use('B');
    await new Promise((r) => setTimeout(r, 5));
    await repo.saveStudent(scope, { ...(await repo.getStudent(scope, s1.id)), address: 'B चा पत्ता' }); // device B, later
    server.online = true;
    expect((await syncAccount(acct)).ok).toBe(true);
    await use('A');
    expect((await syncAccount(acct)).ok).toBe(true); // A's older edit loses
    expect((await repo.getStudent(scope, s1.id)).address).toBe('B चा पत्ता');
    await use('B');
    expect((await syncAccount(acct)).ok).toBe(true);
    expect((await repo.getStudent(scope, s1.id)).address).toBe('B चा पत्ता');
  });

  it('works offline on a device where the account was opened before', async () => {
    server.online = false;
    await logout();
    const st = await login('kale7', 'pass7777', '2026-27');
    expect(st.classRoom!.id).toBe(scopeA.classId);
    server.online = true;
  });

  it('a password changed on one device signs the other out of syncing', async () => {
    await use('A');
    await login('kale7', 'pass7777', '2026-27');
    await use('B');
    const { changeOwnPassword } = await import('../src/lib/auth');
    await changeOwnPassword(acct, 'pass7777', 'newpass77', 'newpass77');
    await use('A');
    const r = await syncAccount(acct);
    expect(r.ok).toBe(false);
    expect((await db.syncState.get(acct))?.token).toBe('');
    // the old password no longer opens it while online
    await expect(login('kale7', 'pass7777', '2026-27')).rejects.toThrow();
    await login('kale7', 'newpass77', '2026-27');
    expect((await syncAccount(acct)).ok).toBe(true);
  });
});

describe('a device-only account goes online', () => {
  it('created without internet, linked later with the same login; its data is sent', async () => {
    await db.delete();
    await db.open();
    server.online = false;
    const r = await registerTeacher({ ...reg, username: 'jadhav5', standard: 5, section: 'अ', phone: '9123456789' });
    expect(r.online).toBe(false);
    expect(r.user.pendingPhone).toBe('9123456789');
    const st = await login('jadhav5', 'pass7777', '2026-27'); // offline login
    const scope = { classId: st.classRoom!.id, userId: st.user.id };
    await repo.saveStudent(scope, { ...repo.emptyStudent(scope.classId), fullName: 'ऑफलाइन विद्यार्थी', rollNo: 1 });
    server.online = true;
    const linked = await linkLocalAccount(st.user.id, 'pass7777', '9123456789');
    expect(linked.cloud).toBe(true);
    expect(linked.id).not.toBe(st.user.id); // now the online id
    expect((await db.classes.get(scope.classId))?.teacherId).toBe(linked.id);
    expect((await syncAccount(linked.id)).ok).toBe(true);
    const names = [...server.records.values()].filter((x) => x.tbl === 'students').map((x) => (x.data as { fullName?: string } | null)?.fullName);
    expect(names).toContain('ऑफलाइन विद्यार्थी');
  });

  it('a taken username is reported so another can be chosen', async () => {
    await db.delete();
    await db.open();
    server.online = false;
    const r = await registerTeacher({ ...reg, username: 'jadhav5', standard: 5, section: 'अ', phone: '9000000001', password: 'other111', confirm: 'other111' });
    server.online = true;
    await expect(linkLocalAccount(r.user.id, 'other111', '9000000001')).rejects.toMatchObject({ code: 'username_taken' });
    const linked = await linkLocalAccount(r.user.id, 'other111', '9000000001', 'jadhav5b');
    expect(linked.username).toBe('jadhav5b');
    expect(await repo.getUserByUsername('jadhav5')).toBeUndefined();
  });

  it('a same-named device account of someone else is never merged into an online account', async () => {
    await db.delete();
    await db.open();
    server.online = false;
    await registerTeacher({ ...reg, username: 'kale7', phone: '9000000002', password: 'mine1234', confirm: 'mine1234' });
    server.online = true;
    // the online kale7 has a different password: logging in with it must not take over this device account
    await expect(login('kale7', 'newpass77', '2026-27')).rejects.toThrow(/या उपकरणावर/);
    // its owner still opens it
    const st = await login('kale7', 'mine1234', '2026-27');
    expect(st.user.cloud).toBeFalsy();
  });
});
