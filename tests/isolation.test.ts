import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '../src/lib/db';
import { adminCreateTeacher, login, restoreSession, runSetup, logout, LoginError } from '../src/lib/auth';
import * as repo from '../src/lib/repo';
import { exportClass, parseBackup, restoreClass, serializeBackup } from '../src/lib/backup';
import { seedDemo } from '../src/lib/demo';

// minimal Web Storage for Node
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
Object.assign(globalThis, { sessionStorage: new MemStorage(), localStorage: new MemStorage() });

let s7: repo.Scope;
let s5: repo.Scope;

beforeAll(async () => {
  await db.delete();
  await db.open();
  await runSetup({
    school: { ...repo.emptySchool(), name: 'जिल्हा परिषद प्राथमिक शाळा नमुना', udise: '27250800000', headmaster: 'मुख्याध्यापक' },
    year: '2026-27',
    adminPassword: 'admin123',
    teachers: [
      { username: 'teacher7', displayName: 'सातवी शिक्षक', standard: 7, section: 'ब', password: 'pass7777' },
      { username: 'teacher5', displayName: 'पाचवी शिक्षक', standard: 5, section: 'अ', password: 'pass5555' },
    ],
  });
  const a7 = await login('teacher7', 'pass7777', '2026-27');
  s7 = { classId: a7.classRoom!.id, userId: a7.user.id };
  const a5 = await login('teacher5', 'pass5555', '2026-27');
  s5 = { classId: a5.classRoom!.id, userId: a5.user.id };
});

describe('setup and login', () => {
  it('2026-27 is the default year and both classes exist', async () => {
    const meta = await repo.getMeta();
    expect(meta?.currentYear).toBe('2026-27');
    const c7 = await repo.getClass(s7);
    const c5 = await repo.getClass(s5);
    expect(c7.standard).toBe(7);
    expect(c7.section).toBe('ब');
    expect(c5.standard).toBe(5);
    expect(c7.config.subjects).toHaveLength(9);
  });
  it('rejects a wrong password', async () => {
    await expect(login('teacher7', 'nope', '2026-27')).rejects.toBeInstanceOf(LoginError);
  });
  it('does not store plain-text passwords', async () => {
    const users = await db.users.toArray();
    expect(JSON.stringify(users)).not.toContain('pass7777');
  });
  it('restores and ends sessions', async () => {
    await login('teacher5', 'pass5555', '2026-27');
    const st = await restoreSession();
    expect(st?.user.username).toBe('teacher5');
    await logout();
    expect(await restoreSession()).toBeNull();
  });
});

describe('class isolation', () => {
  let studentOf7: string;

  it('teacher 7 adds a student and marks', async () => {
    const s = await repo.saveStudent(s7, { ...repo.emptyStudent(s7.classId), fullName: 'आरव पाटील', rollNo: 1 });
    studentOf7 = s.id;
    await repo.setScore(s7, { studentId: s.id, subjectId: 'marathi', term: 1, type: 'F', key: 'obs', value: 5 });
    await repo.setRemark(s7, { studentId: s.id, term: 1, area: 'marathi', text: 'कविता तालासुरात म्हणतो.' });
    expect(await repo.listStudents(s7)).toHaveLength(1);
  });

  it('teacher 5 sees none of class 7', async () => {
    expect(await repo.listStudents(s5)).toHaveLength(0);
    expect(await repo.listAssessments(s5)).toHaveLength(0);
    expect(await repo.listRemarks(s5)).toHaveLength(0);
  });

  it('teacher 5 cannot read, edit, mark or delete a class 7 student', async () => {
    await expect(repo.getStudent(s5, studentOf7)).rejects.toBeInstanceOf(repo.AccessError);
    const st = await repo.getStudent(s7, studentOf7);
    await expect(repo.saveStudent(s5, { ...st, fullName: 'बदल' })).rejects.toBeInstanceOf(repo.AccessError);
    await expect(repo.setScore(s5, { studentId: studentOf7, subjectId: 'marathi', term: 1, type: 'F', key: 'obs', value: 1 })).rejects.toBeInstanceOf(repo.AccessError);
    await expect(repo.setRemark(s5, { studentId: studentOf7, term: 1, area: 'marathi', text: 'x' })).rejects.toBeInstanceOf(repo.AccessError);
    await expect(repo.setPresentDays(s5, studentOf7, '2026-06', 10)).rejects.toBeInstanceOf(repo.AccessError);
    await expect(repo.deleteStudent(s5, studentOf7)).rejects.toBeInstanceOf(repo.AccessError);
    expect((await repo.getStudent(s7, studentOf7)).fullName).toBe('आरव पाटील');
  });

  it('a forged scope with another teacher id cannot open the class', async () => {
    await expect(repo.getClass({ classId: s7.classId, userId: s5.userId })).rejects.toBeInstanceOf(repo.AccessError);
  });

  it('class 5 marks do not inherit class 7 subjects', async () => {
    const c5 = await repo.getClass(s5);
    expect(c5.config.subjects.map((s) => s.id)).not.toContain('science');
  });
});

describe('backup / restore', () => {
  it('restores a class backup without touching the other class', async () => {
    await seedDemo(s7);
    const before = await repo.listStudents(s7);
    const text = await serializeBackup(await exportClass(s7), 'bk-pass1');
    // wipe class 7 then restore
    await repo.clearClassData(s7);
    expect(await repo.listStudents(s7)).toHaveLength(0);
    const parsed = await parseBackup(text, 'bk-pass1');
    const r = await restoreClass(s7, parsed as never);
    expect(r.students).toBe(before.length);
    expect((await repo.listAssessments(s7)).length).toBeGreaterThan(0);
    expect(await repo.listStudents(s5)).toHaveLength(0);
  });

  it('refuses a class-7 backup inside class 5', async () => {
    const text = await serializeBackup(await exportClass(s7));
    const parsed = await parseBackup(text);
    await expect(restoreClass(s5, parsed as never)).rejects.toThrow();
    expect(await repo.listStudents(s5)).toHaveLength(0);
  });

  it('keeps student ids on restore, but re-keys ids owned by another class', async () => {
    const before = (await repo.listStudents(s7)).map((s) => s.id).sort();
    const text = await serializeBackup(await exportClass(s7));
    // same class: ids preserved
    await restoreClass(s7, (await parseBackup(text)) as never);
    expect((await repo.listStudents(s7)).map((s) => s.id).sort()).toEqual(before);
    // a second std-7 class restoring the same backup must not reuse class-7 ids
    const admin = (await db.users.where('username').equals('admin').first())!;
    await adminCreateTeacher(admin.id, { username: 'teacher7b', displayName: 'दुसरे सातवी शिक्षक', standard: 7, section: 'क', password: 'pass7b77' });
    const a7b = await login('teacher7b', 'pass7b77', '2026-27');
    const s7b = { classId: a7b.classRoom!.id, userId: a7b.user.id };
    await restoreClass(s7b, (await parseBackup(text)) as never);
    const other = (await repo.listStudents(s7b)).map((s) => s.id);
    expect(other).toHaveLength(before.length);
    expect(other.some((id) => before.includes(id))).toBe(false);
    // class 7 untouched
    expect((await repo.listStudents(s7)).map((s) => s.id).sort()).toEqual(before);
    expect((await repo.listAssessments(s7)).length).toBeGreaterThan(0);
  });

  it('demo data can be removed', async () => {
    const n = await repo.removeDemoData(s7);
    expect(n).toBe(10);
  });
});
