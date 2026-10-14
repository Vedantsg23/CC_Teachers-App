/**
 * Data model for CCE नोंदवही.
 *
 * Every class-owned record carries `classId`. A class belongs to exactly one
 * teacher and one academic year, so `classId` is the isolation boundary that
 * the repository layer (src/lib/repo.ts) enforces on every read and write.
 */

export type Gender = 'M' | 'F';
export type Term = 1 | 2;
/** F = आकारिक (formative), S = संकलित (summative) */
export type AType = 'F' | 'S';
export type Role = 'admin' | 'teacher';
export type Period = 1 | 2 | 'annual';

export type RemarkCategory =
  | 'marathi'
  | 'hindi'
  | 'english'
  | 'math'
  | 'science'
  | 'social'
  | 'art'
  | 'work'
  | 'pe'
  | 'special'
  | 'hobby'
  | 'improve'
  | 'personality';

/** Special (non-subject) remark areas. Subject areas use the subject id. */
export type SpecialArea = 'special' | 'hobby' | 'improve' | 'personality';

/* ------------------------------------------------------------------ */
/* School / app level                                                  */
/* ------------------------------------------------------------------ */

export interface School {
  name: string;
  udise: string;
  orgLine: string; // e.g. "जिल्हा परिषद, पुणे" — printed above report titles
  taluka: string;
  district: string;
  address: string;
  centre: string; // केंद्र
  beat?: string; // बीट
  headmaster: string;
  centreHead?: string; // केंद्रप्रमुख (name, for signatures)
  extOfficer?: string; // विस्तार अधिकारी (name)
  blockOfficer?: string; // गटशिक्षणाधिकारी (name)
  medium: string; // माध्यम
  board: string;
  recognitionNo: string; // मान्यता क्रमांक
  phone: string;
  email: string;
  logo: string; // data URL (JPEG/PNG) or ''
}

export interface AppMeta {
  setupDone: boolean;
  years: string[];
  currentYear: string;
  createdAt: number;
}

export interface LcField {
  key: string;
  label: string;
  enabled: boolean;
}

export interface LcTemplate {
  title: string;
  headerNote: string; // e.g. "(या दाखल्यात कोणताही बदल करू नये.)"
  fields: LcField[];
  certText: string;
  signLabels: string[];
}

/* ------------------------------------------------------------------ */
/* Accounts and sessions                                               */
/* ------------------------------------------------------------------ */

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  /** Teacher assignment (standard 1–8 and division). */
  standard: number | null;
  section: string;
  pwHash: string;
  pwSalt: string;
  pwIter: number;
  mustChangePassword: boolean;
  active: boolean;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
}

export interface SessionRec {
  token: string;
  userId: string;
  year: string;
  createdAt: number;
  expiresAt: number;
}

/* ------------------------------------------------------------------ */
/* Class configuration                                                 */
/* ------------------------------------------------------------------ */

export interface Subject {
  id: string;
  name: string; // full name: "सामान्य विज्ञान"
  short: string; // table header: "सा.वि./ प.अ."
  remarkLabel: string; // remarks report: "सामान्य विज्ञान / परिसर अभ्यास / परिसर अभ्यास 1"
  remarkCat: RemarkCategory;
  /** Include in the overall total / percentage / result. */
  inTotal: boolean;
}

export interface ToolDef {
  key: string;
  label: string;
}

/** Max marks per tool; `null` = tool not used for that subject/term. */
export type ToolMax = Record<string, number | null>;

export interface SubjectWeights {
  F: ToolMax;
  S: ToolMax;
}

/** weights[term][subjectId] */
export type Weights = Record<'1' | '2', Record<string, SubjectWeights>>;

export interface GradeBand {
  label: string;
  min: number; // minimum percentage (inclusive)
}

export interface ResultRules {
  overallMin: number; // minimum overall percentage
  subjectMin: number; // minimum percentage in each counted subject (0 = no rule)
  passLabel: string;
  failLabel: string;
  absentLabel: string;
  incompleteLabel: string;
  roundForGrade: boolean; // round percentage before looking up the grade
}

export interface ReportSettings {
  teacherSignLabel: string;
  headSignLabel: string;
  parentSignLabel: string;
  showPageNumbers: boolean;
  showSchoolOnCards: boolean;
  /** Print १२३ instead of 123 in the result sheet and the संकलन तक्ते (default: yes). */
  marathiDigits?: boolean;
}

export interface ClassConfig {
  subjects: Subject[];
  fTools: ToolDef[];
  sParts: ToolDef[];
  weights: Weights;
  grades: GradeBand[];
  result: ResultRules;
  report: ReportSettings;
}

export interface ClassRoom {
  id: string;
  year: string;
  teacherId: string;
  standard: number;
  section: string;
  config: ClassConfig;
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------ */
/* Class-owned records                                                 */
/* ------------------------------------------------------------------ */

export interface LeavingInfo {
  date: string; // शाळा सोडल्याचा दिनांक (YYYY-MM-DD)
  reason: string;
  lastAttended: string; // शेवटचा उपस्थित दिवस
  conduct: string; // वर्तणूक
  progress: string; // अभ्यासातील प्रगती
  remark: string; // शेरा
}

export interface Student {
  id: string;
  classId: string;
  rollNo: number | null; // हजेरी क्रमांक
  regNo: string; // जनरल रजिस्टर क्रमांक
  saralId: string; // विद्यार्थी आयडी (सरल)
  pen: string; // UDISE PEN
  fullName: string;
  motherName: string;
  fatherName: string;
  guardianName: string;
  gender: Gender;
  dob: string; // YYYY-MM-DD
  birthPlace: string;
  religion: string;
  caste: string;
  category: string; // प्रवर्ग code (see CATEGORIES)
  nationality: string;
  motherTongue: string;
  address: string;
  mobile: string;
  admissionDate: string;
  admissionStd: string;
  previousSchool: string;
  photo: string; // data URL or ''
  status: 'active' | 'left';
  leaving: LeavingInfo | null;
  demo: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Assessment {
  id: string; // `${studentId}|${subjectId}|${term}|${type}`
  classId: string;
  studentId: string;
  subjectId: string;
  term: Term;
  type: AType;
  scores: Record<string, number | null>;
  updatedAt: number;
}

export interface Remark {
  id: string; // `${studentId}|${term}|${area}`
  classId: string;
  studentId: string;
  term: Term;
  area: string; // subject id or SpecialArea
  text: string;
  updatedAt: number;
}

export interface AttendanceMonth {
  id: string; // `${classId}|${month}`
  classId: string;
  month: string; // YYYY-MM
  workingDays: number | null;
  updatedAt: number;
}

export interface AttendanceRec {
  id: string; // `${studentId}|${month}`
  classId: string;
  studentId: string;
  month: string;
  present: number | null;
  updatedAt: number;
}

export interface DailyAttendance {
  id: string; // `${classId}|${date}`
  classId: string;
  date: string; // YYYY-MM-DD
  absent: string[]; // student ids
  updatedAt: number;
}

export interface RemarkItem {
  id: string;
  classId: string;
  category: RemarkCategory;
  text: string; // मुलगा
  textF: string; // मुलगी
  order: number;
  builtin: boolean;
  updatedAt: number;
}

export interface Certificate {
  id: string;
  classId: string;
  studentId: string;
  certNo: string;
  issueDate: string;
  data: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
}
