/**
 * डेटा बॅकअप / पुनर्संचयित (JSON).
 *
 * - Class backup (teacher): only that class's data.
 * - Full backup (admin): whole device database, including accounts.
 * - Optional password protection (AES-GCM).
 * Restores validate and whitelist every field, and always re-key class
 * records so a backup can never overwrite another class's data.
 */
import { db, CLASS_TABLES } from './db';
import { assessmentId } from './calc';
import { decryptText, encryptText, uid, type EncryptedBlob } from './crypto';
import { defaultConfig } from './defaults';
import { APP_VERSION } from './labels';
import * as repo from './repo';
import type {
  Assessment,
  AttendanceMonth,
  AttendanceRec,
  Certificate,
  ClassConfig,
  ClassRoom,
  DailyAttendance,
  MetaRow,
  Remark,
  RemarkCategory,
  RemarkItem,
  Student,
  User,
} from './types';
import { REMARK_CATEGORIES } from './labels';

export const BACKUP_FORMAT = 'cce-nondvahi';
export const MAX_BACKUP_BYTES = 30 * 1024 * 1024;

export interface ClassData {
  students: Student[];
  assessments: Assessment[];
  remarks: Remark[];
  attendanceMonths: AttendanceMonth[];
  attendance: AttendanceRec[];
  dailyAttendance: DailyAttendance[];
  remarkLibrary: RemarkItem[];
  certificates: Certificate[];
}

export interface ClassBackup extends ClassData {
  format: typeof BACKUP_FORMAT;
  kind: 'class';
  version: 1;
  app: string;
  exportedAt: string;
  year: string;
  standard: number;
  section: string;
  config: ClassConfig;
}

export interface FullBackup extends ClassData {
  format: typeof BACKUP_FORMAT;
  kind: 'full';
  version: 1;
  app: string;
  exportedAt: string;
  meta: MetaRow[];
  users: User[];
  classes: ClassRoom[];
}

interface EncryptedBackup {
  format: typeof BACKUP_FORMAT;
  kind: 'encrypted';
  version: 1;
  payload: EncryptedBlob;
}

export class BackupError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'BackupError';
  }
}

/* ------------------------------------------------------------------ */
/* Export                                                               */
/* ------------------------------------------------------------------ */

async function classData(classId: string): Promise<ClassData> {
  const get = <T>(t: (typeof CLASS_TABLES)[number]) => db.table(t).where('classId').equals(classId).toArray() as Promise<T[]>;
  return {
    students: await get<Student>('students'),
    assessments: await get<Assessment>('assessments'),
    remarks: await get<Remark>('remarks'),
    attendanceMonths: await get<AttendanceMonth>('attendanceMonths'),
    attendance: await get<AttendanceRec>('attendance'),
    dailyAttendance: await get<DailyAttendance>('dailyAttendance'),
    remarkLibrary: await get<RemarkItem>('remarkLibrary'),
    certificates: await get<Certificate>('certificates'),
  };
}

export async function exportClass(scope: repo.Scope): Promise<ClassBackup> {
  const cls = await repo.getClass(scope);
  return {
    format: BACKUP_FORMAT,
    kind: 'class',
    version: 1,
    app: APP_VERSION,
    exportedAt: new Date().toISOString(),
    year: cls.year,
    standard: cls.standard,
    section: cls.section,
    config: cls.config,
    ...(await classData(cls.id)),
  };
}

export async function exportAll(): Promise<FullBackup> {
  const all = <T>(t: string) => db.table(t).toArray() as Promise<T[]>;
  return {
    format: BACKUP_FORMAT,
    kind: 'full',
    version: 1,
    app: APP_VERSION,
    exportedAt: new Date().toISOString(),
    meta: await all<MetaRow>('meta'),
    users: await all<User>('users'),
    classes: await all<ClassRoom>('classes'),
    students: await all<Student>('students'),
    assessments: await all<Assessment>('assessments'),
    remarks: await all<Remark>('remarks'),
    attendanceMonths: await all<AttendanceMonth>('attendanceMonths'),
    attendance: await all<AttendanceRec>('attendance'),
    dailyAttendance: await all<DailyAttendance>('dailyAttendance'),
    remarkLibrary: await all<RemarkItem>('remarkLibrary'),
    certificates: await all<Certificate>('certificates'),
  };
}

export async function serializeBackup(data: ClassBackup | FullBackup, password?: string): Promise<string> {
  const json = JSON.stringify(data);
  if (!password) return json;
  const enc: EncryptedBackup = { format: BACKUP_FORMAT, kind: 'encrypted', version: 1, payload: await encryptText(json, password) };
  return JSON.stringify(enc);
}

/* ------------------------------------------------------------------ */
/* Parse + validate                                                     */
/* ------------------------------------------------------------------ */

const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : typeof v === 'number' ? String(v) : '');
const numN = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bool = (v: unknown): boolean => v === true;
const term = (v: unknown): 1 | 2 => (v === 2 ? 2 : 1);
const isoDate = (v: unknown): string => {
  const s = str(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};
const photo = (v: unknown): string => {
  const s = str(v, 3_000_000);
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : '';
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function cleanScores(v: unknown): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [k, val] of Object.entries(obj(v))) {
    if (!/^[\w-]{1,40}$/.test(k)) continue;
    const n = numN(val);
    out[k] = n !== null && n >= 0 && n <= 1000 ? n : null;
  }
  return out;
}

function cleanStudent(r: unknown, classId: string): Student {
  const o = obj(r);
  const lv = obj(o.leaving);
  return {
    id: str(o.id, 64),
    classId,
    rollNo: numN(o.rollNo),
    regNo: str(o.regNo, 40),
    saralId: str(o.saralId, 40),
    pen: str(o.pen, 40),
    fullName: str(o.fullName, 200),
    motherName: str(o.motherName, 120),
    fatherName: str(o.fatherName, 120),
    guardianName: str(o.guardianName, 120),
    gender: o.gender === 'F' ? 'F' : 'M',
    dob: isoDate(o.dob),
    birthPlace: str(o.birthPlace, 200),
    religion: str(o.religion, 60),
    caste: str(o.caste, 80),
    category: str(o.category, 20),
    nationality: str(o.nationality, 40),
    motherTongue: str(o.motherTongue, 40),
    address: str(o.address, 400),
    mobile: str(o.mobile, 20),
    admissionDate: isoDate(o.admissionDate),
    admissionStd: str(o.admissionStd, 40),
    previousSchool: str(o.previousSchool, 200),
    photo: photo(o.photo),
    status: o.status === 'left' ? 'left' : 'active',
    leaving: o.leaving
      ? {
          date: isoDate(lv.date),
          reason: str(lv.reason, 300),
          lastAttended: isoDate(lv.lastAttended),
          conduct: str(lv.conduct, 100),
          progress: str(lv.progress, 100),
          remark: str(lv.remark, 300),
        }
      : null,
    demo: bool(o.demo),
    createdAt: num(o.createdAt, Date.now()),
    updatedAt: num(o.updatedAt, Date.now()),
  };
}

function cleanConfig(v: unknown, standard: number): ClassConfig {
  const def = defaultConfig(standard);
  const o = obj(v);
  if (!Array.isArray(o.subjects) || !o.weights) return def;
  try {
    const cfg = structuredClone(o) as unknown as ClassConfig;
    cfg.subjects = arr(o.subjects).map((s) => {
      const so = obj(s);
      const cat = REMARK_CATEGORIES.includes(so.remarkCat as RemarkCategory) ? (so.remarkCat as RemarkCategory) : 'special';
      return { id: str(so.id, 40) || uid(), name: str(so.name, 80), short: str(so.short, 40), remarkLabel: str(so.remarkLabel, 160), remarkCat: cat, inTotal: so.inTotal !== false };
    });
    cfg.fTools = arr(o.fTools).map((t) => ({ key: str(obj(t).key, 40), label: str(obj(t).label, 40) })).filter((t) => t.key);
    cfg.sParts = arr(o.sParts).map((t) => ({ key: str(obj(t).key, 40), label: str(obj(t).label, 40) })).filter((t) => t.key);
    cfg.grades = arr(o.grades).map((g) => ({ label: str(obj(g).label, 10), min: num(obj(g).min) }));
    cfg.result = { ...def.result, ...(obj(o.result) as Partial<ClassConfig['result']>) };
    cfg.report = { ...def.report, ...(obj(o.report) as Partial<ClassConfig['report']>) };
    if (!cfg.fTools.length) cfg.fTools = def.fTools;
    if (!cfg.sParts.length) cfg.sParts = def.sParts;
    if (!cfg.grades.length) cfg.grades = def.grades;
    const w = obj(o.weights);
    cfg.weights = { '1': {}, '2': {} };
    for (const t of ['1', '2'] as const) {
      for (const [sid, sw] of Object.entries(obj(w[t]))) {
        cfg.weights[t][sid] = { F: cleanScores(obj(sw).F), S: cleanScores(obj(sw).S) };
      }
    }
    return cfg;
  } catch {
    return def;
  }
}

export async function parseBackup(text: string, password?: string): Promise<ClassBackup | FullBackup> {
  if (text.length > MAX_BACKUP_BYTES) throw new BackupError('फाइल खूप मोठी आहे.');
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('ही बॅकअप फाइल वाचता आली नाही. योग्य .json फाइल निवडा.');
  }
  if (data?.format !== BACKUP_FORMAT) throw new BackupError('ही CCE नोंदवहीची बॅकअप फाइल नाही.');
  if (data.kind === 'encrypted') {
    if (!password) throw new BackupError('PASSWORD_REQUIRED');
    try {
      data = JSON.parse(await decryptText(data.payload as EncryptedBlob, password));
    } catch {
      throw new BackupError('बॅकअपचा पासवर्ड चुकीचा आहे.');
    }
    if (data?.format !== BACKUP_FORMAT) throw new BackupError('ही CCE नोंदवहीची बॅकअप फाइल नाही.');
  }
  if (data.kind !== 'class' && data.kind !== 'full') throw new BackupError('बॅकअप फाइलचा प्रकार ओळखता आला नाही.');
  return data as unknown as ClassBackup | FullBackup;
}

/**
 * Sanitize class records for a target class. Student ids are kept (so links
 * stay valid) unless `keepId` says the id is already used by another class,
 * in which case the student gets a fresh id and every reference is re-keyed.
 */
export function rekeyClassData(src: ClassData, targetClassId: string, keepId: (id: string) => boolean = () => false): ClassData {
  const idMap = new Map<string, string>();
  const students = arr(src.students)
    .map((r) => cleanStudent(r, targetClassId))
    .filter((s) => s.id && s.fullName)
    .map((s) => {
      const nid = /^[\w-]{8,64}$/.test(s.id) && keepId(s.id) && !idMap.has(s.id) ? s.id : uid();
      idMap.set(s.id, nid);
      return { ...s, id: nid };
    });
  const sid = (v: unknown) => idMap.get(str(v, 64));

  const assessments: Assessment[] = [];
  for (const r of arr(src.assessments)) {
    const o = obj(r);
    const studentId = sid(o.studentId);
    if (!studentId) continue;
    const subjectId = str(o.subjectId, 40);
    const t = term(o.term);
    const type = o.type === 'S' ? 'S' : 'F';
    assessments.push({ id: assessmentId(studentId, subjectId, t, type), classId: targetClassId, studentId, subjectId, term: t, type, scores: cleanScores(o.scores), updatedAt: num(o.updatedAt, Date.now()) });
  }
  const remarks: Remark[] = [];
  for (const r of arr(src.remarks)) {
    const o = obj(r);
    const studentId = sid(o.studentId);
    if (!studentId) continue;
    const t = term(o.term);
    const area = str(o.area, 40);
    remarks.push({ id: repo.remarkId(studentId, t, area), classId: targetClassId, studentId, term: t, area, text: str(o.text, 1000), updatedAt: num(o.updatedAt, Date.now()) });
  }
  const attendanceMonths: AttendanceMonth[] = arr(src.attendanceMonths)
    .map((r) => obj(r))
    .filter((o) => /^\d{4}-\d{2}$/.test(str(o.month)))
    .map((o) => ({ id: `${targetClassId}|${str(o.month)}`, classId: targetClassId, month: str(o.month), workingDays: numN(o.workingDays), updatedAt: num(o.updatedAt, Date.now()) }));
  const attendance: AttendanceRec[] = [];
  for (const r of arr(src.attendance)) {
    const o = obj(r);
    const studentId = sid(o.studentId);
    const month = str(o.month);
    if (!studentId || !/^\d{4}-\d{2}$/.test(month)) continue;
    attendance.push({ id: `${studentId}|${month}`, classId: targetClassId, studentId, month, present: numN(o.present), updatedAt: num(o.updatedAt, Date.now()) });
  }
  const dailyAttendance: DailyAttendance[] = arr(src.dailyAttendance)
    .map((r) => obj(r))
    .filter((o) => isoDate(o.date))
    .map((o) => ({
      id: `${targetClassId}|${isoDate(o.date)}`,
      classId: targetClassId,
      date: isoDate(o.date),
      absent: arr(o.absent).map((x) => sid(x)).filter((x): x is string => !!x),
      updatedAt: num(o.updatedAt, Date.now()),
    }));
  const remarkLibrary: RemarkItem[] = arr(src.remarkLibrary)
    .map((r) => obj(r))
    .filter((o) => str(o.text) && REMARK_CATEGORIES.includes(o.category as RemarkCategory))
    .map((o, i) => ({
      id: uid(),
      classId: targetClassId,
      category: o.category as RemarkCategory,
      text: str(o.text, 500),
      textF: str(o.textF, 500),
      order: num(o.order, i),
      builtin: bool(o.builtin),
      updatedAt: num(o.updatedAt, Date.now()),
    }));
  const certificates: Certificate[] = [];
  for (const r of arr(src.certificates)) {
    const o = obj(r);
    const studentId = sid(o.studentId);
    if (!studentId) continue;
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj(o.data))) if (/^\w{1,40}$/.test(k)) data[k] = str(v, 500);
    certificates.push({ id: uid(), classId: targetClassId, studentId, certNo: str(o.certNo, 30), issueDate: isoDate(o.issueDate), data, createdAt: num(o.createdAt, Date.now()), updatedAt: num(o.updatedAt, Date.now()) });
  }
  return { students, assessments, remarks, attendanceMonths, attendance, dailyAttendance, remarkLibrary, certificates };
}

/** Teacher restore: replaces the current class's data with the backup. */
export async function restoreClass(scope: repo.Scope, backup: ClassBackup): Promise<{ students: number }> {
  if (backup.kind !== 'class') throw new BackupError('ही वर्गाची बॅकअप फाइल नाही. (संपूर्ण बॅकअप मुख्याध्यापक खात्यातून पुनर्संचयित करा.)');
  const cls = await repo.getClass(scope);
  if (num(backup.standard) !== cls.standard) {
    throw new BackupError(`हा बॅकअप इयत्ता ${num(backup.standard)} चा आहे; तुमचा वर्ग इयत्ता ${cls.standard} आहे. वेगळ्या वर्गाचा बॅकअप येथे पुनर्संचयित करता येणार नाही.`);
  }
  // ids already used by other classes on this device must not be reused
  const foreign = new Set((await db.students.where('classId').notEqual(cls.id).primaryKeys()) as string[]);
  const data = rekeyClassData(backup, cls.id, (id) => !foreign.has(id));
  const config = cleanConfig(backup.config, cls.standard);
  await db.transaction('rw', [db.classes, ...CLASS_TABLES.map((t) => db.table(t))], async () => {
    for (const t of CLASS_TABLES) await db.table(t).where('classId').equals(cls.id).delete();
    await db.classes.put({ ...cls, config, section: str(backup.section, 10) || cls.section, updatedAt: Date.now() });
    await db.students.bulkAdd(data.students);
    await db.assessments.bulkPut(data.assessments);
    await db.remarks.bulkPut(data.remarks);
    await db.attendanceMonths.bulkPut(data.attendanceMonths);
    await db.attendance.bulkPut(data.attendance);
    await db.dailyAttendance.bulkPut(data.dailyAttendance);
    await db.remarkLibrary.bulkAdd(data.remarkLibrary);
    await db.certificates.bulkAdd(data.certificates);
  });
  return { students: data.students.length };
}

/** Admin restore: replaces the whole device database. */
export async function restoreAll(backup: FullBackup): Promise<{ classes: number; students: number }> {
  if (backup.kind !== 'full') throw new BackupError('ही संपूर्ण (सर्व वर्ग) बॅकअप फाइल नाही.');
  const users: User[] = arr(backup.users)
    .map((r) => obj(r))
    .filter((o) => str(o.id) && str(o.username) && str(o.pwHash) && str(o.pwSalt))
    .map((o) => ({
      id: str(o.id, 64),
      username: str(o.username, 20).toLowerCase(),
      displayName: str(o.displayName, 120),
      role: o.role === 'admin' ? 'admin' : 'teacher',
      standard: numN(o.standard),
      section: str(o.section, 10),
      pwHash: str(o.pwHash, 200),
      pwSalt: str(o.pwSalt, 200),
      pwIter: num(o.pwIter, 150000),
      mustChangePassword: bool(o.mustChangePassword),
      active: o.active !== false,
      createdAt: num(o.createdAt, Date.now()),
      updatedAt: num(o.updatedAt, Date.now()),
      lastLoginAt: numN(o.lastLoginAt),
    }));
  if (!users.some((u) => u.role === 'admin')) throw new BackupError('या बॅकअपमध्ये मुख्याध्यापक खाते नाही.');
  const userIds = new Set(users.map((u) => u.id));
  const classes: ClassRoom[] = arr(backup.classes)
    .map((r) => obj(r))
    .filter((o) => str(o.id) && userIds.has(str(o.teacherId)))
    .map((o) => {
      const standard = num(o.standard, 1);
      return { id: str(o.id, 64), year: str(o.year, 10), teacherId: str(o.teacherId, 64), standard, section: str(o.section, 10), config: cleanConfig(o.config, standard), createdAt: num(o.createdAt), updatedAt: num(o.updatedAt) };
    });
  const allowedMeta = new Set(['app', 'school', 'lcTemplate', 'lcCounter']);
  const meta: MetaRow[] = arr(backup.meta)
    .map((r) => obj(r))
    .filter((o) => allowedMeta.has(str(o.key)))
    .map((o) => ({ key: str(o.key), value: o.value }));

  // Each record keeps pointing at its own class; ids are kept unless duplicated.
  const seen = new Set<string>();
  const perClass = classes.map((c) => {
    const pick = <T>(list: unknown) => arr(list).filter((r) => str(obj(r).classId) === c.id) as T[];
    const src: ClassData = {
      students: pick(backup.students),
      assessments: pick(backup.assessments),
      remarks: pick(backup.remarks),
      attendanceMonths: pick(backup.attendanceMonths),
      attendance: pick(backup.attendance),
      dailyAttendance: pick(backup.dailyAttendance),
      remarkLibrary: pick(backup.remarkLibrary),
      certificates: pick(backup.certificates),
    };
    return rekeyClassData(src, c.id, (id) => !seen.has(id) && (seen.add(id), true));
  });

  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
    await db.meta.bulkPut(meta);
    await db.users.bulkPut(users);
    await db.classes.bulkPut(classes);
    for (const d of perClass) {
      await db.students.bulkAdd(d.students);
      await db.assessments.bulkPut(d.assessments);
      await db.remarks.bulkPut(d.remarks);
      await db.attendanceMonths.bulkPut(d.attendanceMonths);
      await db.attendance.bulkPut(d.attendance);
      await db.dailyAttendance.bulkPut(d.dailyAttendance);
      await db.remarkLibrary.bulkAdd(d.remarkLibrary);
      await db.certificates.bulkAdd(d.certificates);
    }
  });
  return { classes: classes.length, students: perClass.reduce((n, d) => n + d.students.length, 0) };
}

export function backupFileName(kind: 'class' | 'full', label: string): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  return `CCE-backup-${kind === 'full' ? 'sarva' : label}-${stamp}.json`;
}
