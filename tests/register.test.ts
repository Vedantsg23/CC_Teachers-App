import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import { login, registerTeacher, RegisterError, runSetup, type RegisterInput } from '../src/lib/auth';
import * as repo from '../src/lib/repo';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
Object.assign(globalThis, { sessionStorage: new MemStorage(), localStorage: new MemStorage() });

const base: RegisterInput = { standard: 6, section: 'अ', displayName: 'श्रीम. नमुना शिक्षिका', username: 'shinde6', password: 'pass6666', confirm: 'pass6666', schoolName: 'नमुना प्राथमिक शाळा' };

async function fieldOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'no error';
  } catch (e) {
    return e instanceof RegisterError ? String(e.field) : `other: ${String(e)}`;
  }
}

beforeAll(async () => {
  await db.delete();
  await db.open();
});

describe('teacher self-registration', () => {
  let s6: repo.Scope;

  it('works on a brand-new device: picks the standard, creates the class, saves the school name', async () => {
    expect((await repo.getMeta())?.setupDone ?? false).toBe(false);
    const u = await registerTeacher(base);
    expect(u.role).toBe('teacher');
    expect(u.standard).toBe(6);
    const meta = await repo.getMeta();
    expect(meta?.setupDone).toBe(true);
    expect(meta?.currentYear).toBe('2026-27');
    expect((await repo.getSchool()).name).toBe('नमुना प्राथमिक शाळा');
    const st = await login('shinde6', 'pass6666', '2026-27', false);
    expect(st.classRoom?.standard).toBe(6);
    expect(st.classRoom?.section).toBe('अ');
    expect(st.classRoom?.config.subjects.map((s) => s.id)).toContain('science');
    s6 = { classId: st.classRoom!.id, userId: st.user.id };
  });

  it('never stores the password itself', async () => {
    expect(JSON.stringify(await db.users.toArray())).not.toContain('pass6666');
  });

  it('validates every field with a Marathi message', async () => {
    expect(await fieldOf(registerTeacher({ ...base, username: 'shinde6' }))).toBe('username'); // taken
    expect(await fieldOf(registerTeacher({ ...base, username: 'SHINDE6' }))).toBe('username'); // case-insensitive
    expect(await fieldOf(registerTeacher({ ...base, username: 'admin' }))).toBe('username');
    expect(await fieldOf(registerTeacher({ ...base, username: 'अ ब' }))).toBe('username');
    expect(await fieldOf(registerTeacher({ ...base, username: 'new1', standard: 0 }))).toBe('standard');
    expect(await fieldOf(registerTeacher({ ...base, username: 'new1', standard: 9 }))).toBe('standard');
    expect(await fieldOf(registerTeacher({ ...base, username: 'new1', displayName: ' ' }))).toBe('displayName');
    expect(await fieldOf(registerTeacher({ ...base, username: 'new1', password: '123', confirm: '123' }))).toBe('password');
    expect(await fieldOf(registerTeacher({ ...base, username: 'new1', confirm: 'different' }))).toBe('confirm');
    expect(await repo.getUserByUsername('new1')).toBeUndefined();
  });

  it('a second teacher gets an isolated class of their own standard', async () => {
    const stu = await repo.saveStudent(s6, { ...repo.emptyStudent(s6.classId), fullName: 'नमुना विद्यार्थी', rollNo: 1 });
    await registerTeacher({ ...base, standard: 5, section: 'ब', username: 'patil5', password: 'pass5555', confirm: 'pass5555', schoolName: 'दुसरे नाव' });
    const st5 = await login('patil5', 'pass5555', '2026-27', false);
    const s5 = { classId: st5.classRoom!.id, userId: st5.user.id };
    expect(st5.classRoom?.standard).toBe(5);
    expect(await repo.listStudents(s5)).toHaveLength(0);
    await expect(repo.getStudent(s5, stu.id)).rejects.toBeInstanceOf(repo.AccessError);
    await expect(repo.getClass({ classId: s6.classId, userId: s5.userId })).rejects.toBeInstanceOf(repo.AccessError);
    // the school name set by the first teacher is kept
    expect((await repo.getSchool()).name).toBe('नमुना प्राथमिक शाळा');
  });

  it('the headmaster set-up is only possible on a fresh device', async () => {
    await expect(runSetup({ school: repo.emptySchool(), year: '2026-27', adminPassword: 'admin123', teachers: [] })).rejects.toThrow();
  });
});
