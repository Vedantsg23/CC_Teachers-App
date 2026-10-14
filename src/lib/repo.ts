/**
 * Repository layer — the only module that touches IndexedDB for class data.
 *
 * Every class-owned operation takes a `Scope` (derived from the logged-in
 * session, never from user input) and verifies that each record it reads or
 * writes belongs to `scope.classId`. This is what keeps इयत्ता ७ वी and
 * इयत्ता ५ वी data apart even if someone edits a URL.
 */
import { db, CLASS_TABLES } from './db';
import { assessmentId } from './calc';
import { uid } from './crypto';
import { defaultConfig, defaultLcTemplate, SEED_REMARKS } from './defaults';
import { DEFAULT_YEAR, L } from './labels';
import { toFeminine } from './marathi';
import type {
  AppMeta,
  Assessment,
  AType,
  AttendanceMonth,
  AttendanceRec,
  Certificate,
  ClassConfig,
  ClassRoom,
  DailyAttendance,
  LcTemplate,
  Remark,
  RemarkCategory,
  RemarkItem,
  School,
  Student,
  Term,
  User,
} from './types';

export interface Scope {
  classId: string;
  userId: string;
}

export class AccessError extends Error {
  constructor() {
    super(L.accessDenied);
    this.name = 'AccessError';
  }
}

export class NotFoundError extends Error {
  constructor() {
    super(L.notFound);
    this.name = 'NotFoundError';
  }
}

function own<T extends { classId: string }>(scope: Scope, rec: T | undefined | null): T {
  if (!rec) throw new NotFoundError();
  if (!scope.classId || rec.classId !== scope.classId) throw new AccessError();
  return rec;
}

function assertScope(scope: Scope) {
  if (!scope || !scope.classId) throw new AccessError();
}

const now = () => Date.now();

/* ------------------------------------------------------------------ */
/* App meta, school, templates                                          */
/* ------------------------------------------------------------------ */

export async function getMeta(): Promise<AppMeta | null> {
  const row = await db.meta.get('app');
  return (row?.value as AppMeta) ?? null;
}

export async function saveMeta(meta: AppMeta): Promise<void> {
  await db.meta.put({ key: 'app', value: meta });
}

export function emptySchool(): School {
  return {
    name: '',
    udise: '',
    orgLine: '',
    taluka: '',
    district: '',
    address: '',
    centre: '',
    beat: '',
    headmaster: '',
    centreHead: '',
    extOfficer: '',
    blockOfficer: '',
    medium: 'मराठी',
    board: 'महाराष्ट्र राज्य माध्यमिक व उच्च माध्यमिक शिक्षण मंडळ',
    recognitionNo: '',
    phone: '',
    email: '',
    logo: '',
  };
}

export async function getSchool(): Promise<School> {
  const row = await db.meta.get('school');
  return { ...emptySchool(), ...((row?.value as Partial<School>) ?? {}) };
}

export async function saveSchool(school: School): Promise<void> {
  await db.meta.put({ key: 'school', value: school });
}

export async function getLcTemplate(): Promise<LcTemplate> {
  const row = await db.meta.get('lcTemplate');
  const def = defaultLcTemplate();
  const saved = row?.value as LcTemplate | undefined;
  if (!saved) return def;
  // keep any new default fields that older saved templates do not have
  const keys = new Set(saved.fields.map((f) => f.key));
  return { ...def, ...saved, fields: [...saved.fields, ...def.fields.filter((f) => !keys.has(f.key))] };
}

export async function saveLcTemplate(t: LcTemplate): Promise<void> {
  await db.meta.put({ key: 'lcTemplate', value: t });
}

/** Next leaving-certificate number (school-wide running counter). */
export async function peekNextCertNo(): Promise<string> {
  const row = await db.meta.get('lcCounter');
  return String(((row?.value as number) ?? 0) + 1);
}

export async function commitCertNo(certNo: string): Promise<void> {
  const n = Number(certNo);
  if (!Number.isInteger(n)) return;
  await db.transaction('rw', db.meta, async () => {
    const row = await db.meta.get('lcCounter');
    const cur = (row?.value as number) ?? 0;
    if (n > cur) await db.meta.put({ key: 'lcCounter', value: n });
  });
}

/* ------------------------------------------------------------------ */
/* Users and sessions (used by auth.ts and the admin panel)            */
/* ------------------------------------------------------------------ */

export async function listUsers(): Promise<User[]> {
  return (await db.users.toArray()).sort((a, b) => (a.role === b.role ? a.username.localeCompare(b.username) : a.role === 'admin' ? -1 : 1));
}

export async function getUser(id: string): Promise<User | undefined> {
  return db.users.get(id);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  return db.users.where('username').equals(username.trim().toLowerCase()).first();
}

export async function putUser(u: User): Promise<void> {
  await db.users.put(u);
}

/* ------------------------------------------------------------------ */
/* Classes                                                              */
/* ------------------------------------------------------------------ */

export async function findClass(teacherId: string, year: string): Promise<ClassRoom | undefined> {
  return db.classes.where('[teacherId+year]').equals([teacherId, year]).first();
}

/** Get (or create on first login of a year) the teacher's class. */
export async function getOrCreateClass(teacher: User, year: string): Promise<ClassRoom> {
  if (teacher.role !== 'teacher' || !teacher.standard) throw new AccessError();
  const existing = await findClass(teacher.id, year);
  if (existing) return existing;
  // copy configuration from the teacher's most recent class (same standard), if any
  const previous = (await db.classes.where('teacherId').equals(teacher.id).toArray())
    .filter((c) => c.standard === teacher.standard)
    .sort((a, b) => b.year.localeCompare(a.year))[0];
  const cls: ClassRoom = {
    id: uid(),
    year,
    teacherId: teacher.id,
    standard: teacher.standard,
    section: teacher.section || 'अ',
    config: previous ? structuredClone(previous.config) : defaultConfig(teacher.standard),
    createdAt: now(),
    updatedAt: now(),
  };
  await db.classes.add(cls);
  await seedLibrary({ classId: cls.id, userId: teacher.id }, previous?.id);
  return cls;
}

export async function getClass(scope: Scope): Promise<ClassRoom> {
  assertScope(scope);
  const c = await db.classes.get(scope.classId);
  if (!c) throw new NotFoundError();
  if (c.teacherId !== scope.userId) throw new AccessError();
  return c;
}

export async function saveClassConfig(scope: Scope, config: ClassConfig): Promise<void> {
  const c = await getClass(scope);
  await db.classes.put({ ...c, config, updatedAt: now() });
}

export async function saveClassSection(scope: Scope, section: string): Promise<void> {
  const c = await getClass(scope);
  await db.transaction('rw', db.classes, db.users, async () => {
    await db.classes.put({ ...c, section, updatedAt: now() });
    const u = await db.users.get(scope.userId);
    if (u) await db.users.put({ ...u, section, updatedAt: now() });
  });
}

/* ------------------------------------------------------------------ */
/* Students                                                             */
/* ------------------------------------------------------------------ */

export function emptyStudent(classId: string): Student {
  return {
    id: '',
    classId,
    rollNo: null,
    regNo: '',
    saralId: '',
    pen: '',
    fullName: '',
    motherName: '',
    fatherName: '',
    guardianName: '',
    gender: 'M',
    dob: '',
    birthPlace: '',
    religion: '',
    caste: '',
    category: '',
    nationality: 'भारतीय',
    motherTongue: 'मराठी',
    address: '',
    mobile: '',
    admissionDate: '',
    admissionStd: '',
    previousSchool: '',
    photo: '',
    status: 'active',
    leaving: null,
    demo: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

export async function listStudents(scope: Scope, opts: { includeLeft?: boolean } = {}): Promise<Student[]> {
  assertScope(scope);
  const all = await db.students.where('classId').equals(scope.classId).toArray();
  return opts.includeLeft ? all : all.filter((s) => s.status === 'active');
}

export async function getStudent(scope: Scope, id: string): Promise<Student> {
  return own(scope, await db.students.get(id));
}

export async function saveStudent(scope: Scope, s: Student): Promise<Student> {
  assertScope(scope);
  const t = now();
  if (s.id) {
    const existing = own(scope, await db.students.get(s.id));
    const rec: Student = { ...existing, ...s, classId: scope.classId, updatedAt: t };
    await db.students.put(rec);
    return rec;
  }
  const rec: Student = { ...s, id: uid(), classId: scope.classId, createdAt: t, updatedAt: t };
  await db.students.add(rec);
  return rec;
}

export async function bulkAddStudents(scope: Scope, list: Student[]): Promise<number> {
  assertScope(scope);
  const t = now();
  const recs = list.map((s) => ({ ...s, id: uid(), classId: scope.classId, createdAt: t, updatedAt: t }));
  await db.students.bulkAdd(recs);
  return recs.length;
}

/** Delete a student and everything recorded for them. */
export async function deleteStudent(scope: Scope, id: string): Promise<void> {
  own(scope, await db.students.get(id));
  await db.transaction('rw', [db.students, db.assessments, db.remarks, db.attendance, db.certificates, db.dailyAttendance], async () => {
    await db.assessments.where('studentId').equals(id).delete();
    await db.remarks.where('studentId').equals(id).delete();
    await db.attendance.where('studentId').equals(id).delete();
    await db.certificates.where('studentId').equals(id).delete();
    const days = await db.dailyAttendance.where('classId').equals(scope.classId).toArray();
    for (const d of days) {
      if (d.absent.includes(id)) await db.dailyAttendance.put({ ...d, absent: d.absent.filter((x) => x !== id) });
    }
    await db.students.delete(id);
  });
}

/* ------------------------------------------------------------------ */
/* Assessments                                                          */
/* ------------------------------------------------------------------ */

export async function listAssessments(scope: Scope, term?: Term): Promise<Assessment[]> {
  assertScope(scope);
  if (term) return db.assessments.where('[classId+term]').equals([scope.classId, term]).toArray();
  return db.assessments.where('classId').equals(scope.classId).toArray();
}

export interface ScoreChange {
  studentId: string;
  subjectId: string;
  term: Term;
  type: AType;
  key: string;
  value: number | null;
}

/** Set one tool score (autosave). Read-modify-write inside one transaction. */
export async function setScore(scope: Scope, ch: ScoreChange): Promise<Assessment> {
  assertScope(scope);
  const id = assessmentId(ch.studentId, ch.subjectId, ch.term, ch.type);
  return db.transaction('rw', db.assessments, db.students, async () => {
    own(scope, await db.students.get(ch.studentId));
    const existing = await db.assessments.get(id);
    if (existing) own(scope, existing);
    const rec: Assessment = existing
      ? { ...existing, scores: { ...existing.scores, [ch.key]: ch.value }, updatedAt: now() }
      : {
          id,
          classId: scope.classId,
          studentId: ch.studentId,
          subjectId: ch.subjectId,
          term: ch.term,
          type: ch.type,
          scores: { [ch.key]: ch.value },
          updatedAt: now(),
        };
    await db.assessments.put(rec);
    return rec;
  });
}

/** Fill a tool for many students at once (only empty cells unless overwrite). */
export async function fillScores(
  scope: Scope,
  args: { studentIds: string[]; subjectId: string; term: Term; type: AType; key: string; value: number; overwrite: boolean },
): Promise<number> {
  assertScope(scope);
  let n = 0;
  await db.transaction('rw', db.assessments, db.students, async () => {
    for (const sid of args.studentIds) {
      own(scope, await db.students.get(sid));
      const id = assessmentId(sid, args.subjectId, args.term, args.type);
      const existing = await db.assessments.get(id);
      if (existing) own(scope, existing);
      const cur = existing?.scores[args.key];
      if (!args.overwrite && cur !== null && cur !== undefined) continue;
      await db.assessments.put(
        existing
          ? { ...existing, scores: { ...existing.scores, [args.key]: args.value }, updatedAt: now() }
          : {
              id,
              classId: scope.classId,
              studentId: sid,
              subjectId: args.subjectId,
              term: args.term,
              type: args.type,
              scores: { [args.key]: args.value },
              updatedAt: now(),
            },
      );
      n++;
    }
  });
  return n;
}

/* ------------------------------------------------------------------ */
/* Descriptive remarks                                                  */
/* ------------------------------------------------------------------ */

export function remarkId(studentId: string, term: Term, area: string): string {
  return `${studentId}|${term}|${area}`;
}

export async function listRemarks(scope: Scope, term?: Term): Promise<Remark[]> {
  assertScope(scope);
  if (term) return db.remarks.where('[classId+term]').equals([scope.classId, term]).toArray();
  return db.remarks.where('classId').equals(scope.classId).toArray();
}

export async function setRemark(scope: Scope, r: { studentId: string; term: Term; area: string; text: string }): Promise<void> {
  assertScope(scope);
  const id = remarkId(r.studentId, r.term, r.area);
  await db.transaction('rw', db.remarks, db.students, async () => {
    own(scope, await db.students.get(r.studentId));
    const existing = await db.remarks.get(id);
    if (existing) own(scope, existing);
    const text = r.text.trim();
    if (!text) {
      if (existing) await db.remarks.delete(id);
      return;
    }
    await db.remarks.put({ id, classId: scope.classId, studentId: r.studentId, term: r.term, area: r.area, text, updatedAt: now() });
  });
}

/* ------------------------------------------------------------------ */
/* Remark library (वर्णनात्मक नोंद संच)                                   */
/* ------------------------------------------------------------------ */

export async function listLibrary(scope: Scope): Promise<RemarkItem[]> {
  assertScope(scope);
  const items = await db.remarkLibrary.where('classId').equals(scope.classId).toArray();
  return items.sort((a, b) => a.order - b.order);
}

export async function addRemarkItem(scope: Scope, category: RemarkCategory, text: string, textF?: string): Promise<RemarkItem> {
  assertScope(scope);
  const clean = text.trim();
  const existing = await db.remarkLibrary.where('[classId+category]').equals([scope.classId, category]).toArray();
  const dup = existing.find((i) => i.text === clean);
  if (dup) return dup;
  const item: RemarkItem = {
    id: uid(),
    classId: scope.classId,
    category,
    text: clean,
    textF: (textF ?? toFeminine(clean, category)).trim(),
    order: existing.reduce((m, i) => Math.max(m, i.order), 0) + 1,
    builtin: false,
    updatedAt: now(),
  };
  await db.remarkLibrary.add(item);
  return item;
}

export async function updateRemarkItem(scope: Scope, item: RemarkItem): Promise<void> {
  const existing = own(scope, await db.remarkLibrary.get(item.id));
  await db.remarkLibrary.put({ ...existing, text: item.text.trim(), textF: item.textF.trim(), category: item.category, updatedAt: now() });
}

export async function deleteRemarkItem(scope: Scope, id: string): Promise<void> {
  own(scope, await db.remarkLibrary.get(id));
  await db.remarkLibrary.delete(id);
}

/** Seed a class's library — copy from a previous class or from the built-in set. */
export async function seedLibrary(scope: Scope, fromClassId?: string): Promise<void> {
  assertScope(scope);
  let items: RemarkItem[];
  if (fromClassId) {
    const prev = await db.remarkLibrary.where('classId').equals(fromClassId).toArray();
    items = prev.map((i) => ({ ...i, id: uid(), classId: scope.classId, updatedAt: now() }));
  } else {
    items = [];
    let order = 1;
    for (const [cat, list] of Object.entries(SEED_REMARKS) as [RemarkCategory, string[]][]) {
      for (const text of list) {
        items.push({ id: uid(), classId: scope.classId, category: cat, text, textF: toFeminine(text, cat), order: order++, builtin: true, updatedAt: now() });
      }
    }
  }
  if (items.length) await db.remarkLibrary.bulkAdd(items);
}

export async function resetLibrary(scope: Scope): Promise<void> {
  assertScope(scope);
  await db.remarkLibrary.where('classId').equals(scope.classId).delete();
  await seedLibrary(scope);
}

/* ------------------------------------------------------------------ */
/* Attendance                                                           */
/* ------------------------------------------------------------------ */

export async function listAttendance(scope: Scope): Promise<{ months: AttendanceMonth[]; recs: AttendanceRec[] }> {
  assertScope(scope);
  const [months, recs] = await Promise.all([
    db.attendanceMonths.where('classId').equals(scope.classId).toArray(),
    db.attendance.where('classId').equals(scope.classId).toArray(),
  ]);
  return { months, recs };
}

export async function setWorkingDays(scope: Scope, month: string, days: number | null): Promise<void> {
  assertScope(scope);
  const id = `${scope.classId}|${month}`;
  await db.attendanceMonths.put({ id, classId: scope.classId, month, workingDays: days, updatedAt: now() });
}

export async function setPresentDays(scope: Scope, studentId: string, month: string, present: number | null): Promise<void> {
  assertScope(scope);
  await db.transaction('rw', db.attendance, db.students, async () => {
    own(scope, await db.students.get(studentId));
    const id = `${studentId}|${month}`;
    const existing = await db.attendance.get(id);
    if (existing) own(scope, existing);
    await db.attendance.put({ id, classId: scope.classId, studentId, month, present, updatedAt: now() });
  });
}

export async function getDaily(scope: Scope, date: string): Promise<DailyAttendance | undefined> {
  assertScope(scope);
  const rec = await db.dailyAttendance.get(`${scope.classId}|${date}`);
  return rec ? own(scope, rec) : undefined;
}

export async function listDaily(scope: Scope): Promise<DailyAttendance[]> {
  assertScope(scope);
  return db.dailyAttendance.where('classId').equals(scope.classId).toArray();
}

export async function setDaily(scope: Scope, date: string, absent: string[]): Promise<void> {
  assertScope(scope);
  const students = await listStudents(scope, { includeLeft: true });
  const ids = new Set(students.map((s) => s.id));
  const clean = [...new Set(absent)].filter((id) => ids.has(id));
  await db.dailyAttendance.put({ id: `${scope.classId}|${date}`, classId: scope.classId, date, absent: clean, updatedAt: now() });
}

export async function deleteDaily(scope: Scope, date: string): Promise<void> {
  assertScope(scope);
  await db.dailyAttendance.delete(`${scope.classId}|${date}`);
}

/** Fill a month's working/present days from the daily register. */
export async function monthFromDaily(scope: Scope, month: string): Promise<{ days: number }> {
  assertScope(scope);
  const daily = (await listDaily(scope)).filter((d) => d.date.startsWith(month));
  const students = await listStudents(scope);
  const days = daily.length;
  await db.transaction('rw', db.attendanceMonths, db.attendance, async () => {
    await db.attendanceMonths.put({ id: `${scope.classId}|${month}`, classId: scope.classId, month, workingDays: days, updatedAt: now() });
    for (const s of students) {
      const absent = daily.filter((d) => d.absent.includes(s.id)).length;
      await db.attendance.put({ id: `${s.id}|${month}`, classId: scope.classId, studentId: s.id, month, present: days - absent, updatedAt: now() });
    }
  });
  return { days };
}

/* ------------------------------------------------------------------ */
/* Leaving certificates                                                 */
/* ------------------------------------------------------------------ */

export async function listCertificates(scope: Scope): Promise<Certificate[]> {
  assertScope(scope);
  const list = await db.certificates.where('classId').equals(scope.classId).toArray();
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getCertificate(scope: Scope, id: string): Promise<Certificate> {
  return own(scope, await db.certificates.get(id));
}

export async function saveCertificate(scope: Scope, c: Certificate): Promise<Certificate> {
  assertScope(scope);
  own(scope, await db.students.get(c.studentId));
  if (c.id) {
    const existing = own(scope, await db.certificates.get(c.id));
    const rec = { ...existing, ...c, classId: scope.classId, updatedAt: now() };
    await db.certificates.put(rec);
    return rec;
  }
  const rec: Certificate = { ...c, id: uid(), classId: scope.classId, createdAt: now(), updatedAt: now() };
  await db.certificates.add(rec);
  await commitCertNo(rec.certNo);
  return rec;
}

export async function deleteCertificate(scope: Scope, id: string): Promise<void> {
  own(scope, await db.certificates.get(id));
  await db.certificates.delete(id);
}

/* ------------------------------------------------------------------ */
/* Bulk removal (demo data / class data)                                */
/* ------------------------------------------------------------------ */

export async function removeDemoData(scope: Scope): Promise<number> {
  const demo = (await listStudents(scope, { includeLeft: true })).filter((s) => s.demo);
  for (const s of demo) await deleteStudent(scope, s.id);
  return demo.length;
}

export async function clearClassData(scope: Scope): Promise<void> {
  assertScope(scope);
  await db.transaction('rw', CLASS_TABLES.map((t) => db.table(t)), async () => {
    for (const t of CLASS_TABLES) {
      if (t === 'remarkLibrary') continue;
      await db.table(t).where('classId').equals(scope.classId).delete();
    }
  });
}

export const DEFAULT_META: AppMeta = { setupDone: false, years: [DEFAULT_YEAR], currentYear: DEFAULT_YEAR, createdAt: 0 };
