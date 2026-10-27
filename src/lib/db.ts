/**
 * IndexedDB database (via Dexie). All app data lives here, on the device.
 * Structured so a cloud-sync layer can be added later: every class-owned row
 * has a stable string id, a `classId` and an `updatedAt` timestamp.
 */
import Dexie, { type EntityTable } from 'dexie';
import type {
  Assessment,
  AttendanceMonth,
  AttendanceRec,
  Certificate,
  ClassRoom,
  DailyAttendance,
  MetaRow,
  Remark,
  RemarkItem,
  SessionRec,
  Student,
  SyncShadow,
  SyncState,
  User,
} from './types';

export const DB_NAME = 'cce-nondvahi';

export type CceDB = Dexie & {
  meta: EntityTable<MetaRow, 'key'>;
  users: EntityTable<User, 'id'>;
  sessions: EntityTable<SessionRec, 'token'>;
  classes: EntityTable<ClassRoom, 'id'>;
  students: EntityTable<Student, 'id'>;
  assessments: EntityTable<Assessment, 'id'>;
  remarks: EntityTable<Remark, 'id'>;
  attendanceMonths: EntityTable<AttendanceMonth, 'id'>;
  attendance: EntityTable<AttendanceRec, 'id'>;
  dailyAttendance: EntityTable<DailyAttendance, 'id'>;
  remarkLibrary: EntityTable<RemarkItem, 'id'>;
  certificates: EntityTable<Certificate, 'id'>;
  syncState: EntityTable<SyncState, 'acct'>;
  syncShadow: EntityTable<SyncShadow, 'key'>;
};

export function createDb(name = DB_NAME): CceDB {
  const d = new Dexie(name) as CceDB;
  d.version(1).stores({
    meta: 'key',
    users: 'id, &username, role',
    sessions: 'token, userId, expiresAt',
    classes: 'id, year, teacherId, [teacherId+year]',
    students: 'id, classId, [classId+status]',
    assessments: 'id, classId, studentId, [classId+term], [classId+term+subjectId]',
    remarks: 'id, classId, studentId, [classId+term]',
    attendanceMonths: 'id, classId',
    attendance: 'id, classId, studentId, [classId+month]',
    dailyAttendance: 'id, classId, [classId+date]',
    remarkLibrary: 'id, classId, [classId+category]',
    certificates: 'id, classId, studentId',
  });
  // online accounts: per-account sync state and record fingerprints
  d.version(2).stores({
    syncState: 'acct',
    syncShadow: 'key, acct',
  });
  return d;
}

export const db: CceDB = createDb();

/** Tables that hold class-owned data (isolated per teacher/class). */
export const CLASS_TABLES = [
  'students',
  'assessments',
  'remarks',
  'attendanceMonths',
  'attendance',
  'dailyAttendance',
  'remarkLibrary',
  'certificates',
] as const;

export type ClassTable = (typeof CLASS_TABLES)[number];
