/**
 * Central calculation engine — the ONLY place where marks are added up,
 * percentages computed, grades looked up and results decided. Screens and
 * reports call these functions; nothing else re-implements the arithmetic.
 *
 *   आकारिक (अ) = sum of used formative tools
 *   संकलित (ब) = sum of used summative parts
 *   एकूण       = अ + ब
 *   टक्केवारी  = एकूण / कमाल × 100
 *   श्रेणी      = configurable grade bands (सेटिंग्ज → श्रेणी नियम)
 *   वार्षिक    = प्रथम सत्र + द्वितीय सत्र
 */
import type {
  Assessment,
  AType,
  ClassConfig,
  GradeBand,
  Gender,
  Period,
  ResultRules,
  Student,
  Subject,
  Term,
  ToolDef,
  ToolMax,
} from './types';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function assessmentId(studentId: string, subjectId: string, term: Term, type: AType): string {
  return `${studentId}|${subjectId}|${term}|${type}`;
}

export interface ScoreSum {
  obt: number | null; // null when nothing entered
  max: number;
  count: number; // entered tools
  used: number; // tools that have a max
}

/** Add up the used tools (tools with a max) of one assessment. */
export function sumTools(tools: ToolDef[], maxes: ToolMax | undefined, scores: Record<string, number | null> | undefined): ScoreSum {
  let max = 0;
  let obt = 0;
  let count = 0;
  let used = 0;
  for (const t of tools) {
    const m = maxes?.[t.key];
    if (m === null || m === undefined || !(m > 0)) continue;
    used++;
    max += m;
    const v = scores?.[t.key];
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      obt += v;
      count++;
    }
  }
  return { obt: count ? round2(obt) : null, max, count, used };
}

export function gradeFor(pct: number | null, bands: GradeBand[], roundFirst = true): string {
  if (pct === null || Number.isNaN(pct)) return '';
  const p = roundFirst ? Math.round(pct) : pct;
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  for (const b of sorted) if (p >= b.min) return b.label;
  return sorted.length ? sorted[sorted.length - 1].label : '';
}

export function percent(obt: number | null, max: number): number | null {
  if (obt === null || !(max > 0)) return null;
  return round2((obt / max) * 100);
}

/** A subject's marks for one period (term or annual). */
export interface SubjectScore {
  subjectId: string;
  fObt: number | null;
  fMax: number;
  sObt: number | null;
  sMax: number;
  total: number | null;
  max: number;
  pct: number | null;
  grade: string;
  entered: boolean;
  complete: boolean;
  hasSummative: boolean;
  /** Annual only: marks exist for just one of the two terms. */
  partial?: boolean;
}

export interface SubjectTermDetail extends SubjectScore {
  term: Term;
  f: ScoreSum;
  s: ScoreSum;
}

export function subjectTermResult(
  cfg: ClassConfig,
  subject: Subject,
  term: Term,
  fRec: Assessment | undefined,
  sRec: Assessment | undefined,
): SubjectTermDetail {
  const w = cfg.weights[String(term) as '1' | '2']?.[subject.id];
  const f = sumTools(cfg.fTools, w?.F, fRec?.scores);
  const s = sumTools(cfg.sParts, w?.S, sRec?.scores);
  const max = f.max + s.max;
  const entered = f.count + s.count > 0;
  const total = entered ? round2((f.obt ?? 0) + (s.obt ?? 0)) : null;
  const pct = entered ? percent(total, max) : null;
  return {
    subjectId: subject.id,
    term,
    f,
    s,
    fObt: f.obt,
    fMax: f.max,
    sObt: s.obt,
    sMax: s.max,
    total,
    max,
    pct,
    grade: gradeFor(pct, cfg.grades, cfg.result.roundForGrade),
    entered,
    complete: f.used + s.used > 0 && f.count === f.used && s.count === s.used,
    hasSummative: s.used > 0,
  };
}

export function combineAnnual(cfg: ClassConfig, t1: SubjectScore, t2: SubjectScore): SubjectScore {
  const entered = t1.entered || t2.entered;
  const max = t1.max + t2.max;
  const total = entered ? round2((t1.total ?? 0) + (t2.total ?? 0)) : null;
  const pct = entered ? percent(total, max) : null;
  const fEntered = t1.fObt !== null || t2.fObt !== null;
  const sEntered = t1.sObt !== null || t2.sObt !== null;
  return {
    subjectId: t1.subjectId,
    fObt: fEntered ? round2((t1.fObt ?? 0) + (t2.fObt ?? 0)) : null,
    fMax: t1.fMax + t2.fMax,
    sObt: sEntered ? round2((t1.sObt ?? 0) + (t2.sObt ?? 0)) : null,
    sMax: t1.sMax + t2.sMax,
    total,
    max,
    pct,
    grade: gradeFor(pct, cfg.grades, cfg.result.roundForGrade),
    entered,
    complete: t1.complete && t2.complete,
    hasSummative: t1.hasSummative || t2.hasSummative,
    partial: t1.entered !== t2.entered,
  };
}

export type ResultStatus = 'pass' | 'fail' | 'absent' | 'incomplete';

export interface StudentPeriodResult {
  period: Period;
  subjects: Record<string, SubjectScore>;
  total: number | null;
  max: number;
  pct: number | null;
  grade: string;
  entered: boolean;
  complete: boolean;
  status: ResultStatus;
  resultLabel: string;
}

export function resultLabel(status: ResultStatus, rules: ResultRules): string {
  switch (status) {
    case 'pass':
      return rules.passLabel;
    case 'fail':
      return rules.failLabel;
    case 'absent':
      return rules.absentLabel;
    default:
      return rules.incompleteLabel;
  }
}

/** Aggregate subject scores into a period result and apply the result rules. */
export function aggregate(cfg: ClassConfig, period: Period, subjects: Record<string, SubjectScore>): StudentPeriodResult {
  const counted = cfg.subjects.filter((s) => s.inTotal).map((s) => subjects[s.id]).filter(Boolean);
  let total = 0;
  let max = 0;
  let anyEntered = false;
  let allEntered = counted.length > 0;
  let allComplete = counted.length > 0;
  for (const r of counted) {
    max += r.max;
    if (r.entered) {
      anyEntered = true;
      total += r.total ?? 0;
    }
    if (!r.entered || r.partial) allEntered = false;
    if (!r.complete) allComplete = false;
  }
  const pct = anyEntered ? percent(round2(total), max) : null;
  let status: ResultStatus;
  if (!anyEntered) status = 'absent';
  else if (!allEntered) status = 'incomplete';
  else {
    const rules = cfg.result;
    const overallOk = (pct ?? 0) >= rules.overallMin;
    const subjectsOk = rules.subjectMin <= 0 || counted.every((r) => (r.pct ?? 0) >= rules.subjectMin);
    status = overallOk && subjectsOk ? 'pass' : 'fail';
  }
  return {
    period,
    subjects,
    total: anyEntered ? round2(total) : null,
    max,
    pct,
    grade: gradeFor(pct, cfg.grades, cfg.result.roundForGrade),
    entered: anyEntered,
    complete: allComplete,
    status,
    resultLabel: resultLabel(status, cfg.result),
  };
}

export type AssessmentIndex = Map<string, Assessment>;

export function indexAssessments(list: Assessment[]): AssessmentIndex {
  const m: AssessmentIndex = new Map();
  for (const a of list) m.set(a.id, a);
  return m;
}

export interface StudentResults {
  studentId: string;
  t1: StudentPeriodResult;
  t2: StudentPeriodResult;
  annual: StudentPeriodResult;
  details: Record<'1' | '2', Record<string, SubjectTermDetail>>;
}

export function studentResults(cfg: ClassConfig, studentId: string, idx: AssessmentIndex): StudentResults {
  const d1: Record<string, SubjectTermDetail> = {};
  const d2: Record<string, SubjectTermDetail> = {};
  const annual: Record<string, SubjectScore> = {};
  for (const subj of cfg.subjects) {
    d1[subj.id] = subjectTermResult(cfg, subj, 1, idx.get(assessmentId(studentId, subj.id, 1, 'F')), idx.get(assessmentId(studentId, subj.id, 1, 'S')));
    d2[subj.id] = subjectTermResult(cfg, subj, 2, idx.get(assessmentId(studentId, subj.id, 2, 'F')), idx.get(assessmentId(studentId, subj.id, 2, 'S')));
    annual[subj.id] = combineAnnual(cfg, d1[subj.id], d2[subj.id]);
  }
  return {
    studentId,
    t1: aggregate(cfg, 1, d1),
    t2: aggregate(cfg, 2, d2),
    annual: aggregate(cfg, 'annual', annual),
    details: { '1': d1, '2': d2 },
  };
}

export function classResults(cfg: ClassConfig, students: Student[], assessments: Assessment[]): Map<string, StudentResults> {
  const idx = indexAssessments(assessments);
  const out = new Map<string, StudentResults>();
  for (const s of students) out.set(s.id, studentResults(cfg, s.id, idx));
  return out;
}

export function pickPeriod(r: StudentResults, period: Period): StudentPeriodResult {
  return period === 1 ? r.t1 : period === 2 ? r.t2 : r.annual;
}

/* ------------------------------------------------------------------ */
/* Class-level statistics                                              */
/* ------------------------------------------------------------------ */

export interface GenderCount {
  M: number;
  F: number;
  T: number;
}

const zero = (): GenderCount => ({ M: 0, F: 0, T: 0 });

function bump(c: GenderCount, g: Gender) {
  c[g]++;
  c.T++;
}

/** Grade distribution of one subject (or overall when subjectId is null). */
export function gradeDistribution(
  cfg: ClassConfig,
  students: Student[],
  results: Map<string, StudentResults>,
  period: Period,
  subjectId: string | null,
): Record<string, GenderCount> {
  const out: Record<string, GenderCount> = {};
  for (const b of cfg.grades) out[b.label] = zero();
  for (const st of students) {
    const r = results.get(st.id);
    if (!r) continue;
    const pr = pickPeriod(r, period);
    const g = subjectId ? pr.subjects[subjectId]?.grade : pr.grade;
    if (!g) continue;
    if (!out[g]) out[g] = zero();
    bump(out[g], st.gender);
  }
  return out;
}

export interface ResultSummary {
  total: GenderCount;
  appeared: GenderCount;
  absent: GenderCount;
  pass: GenderCount;
  fail: GenderCount;
  incomplete: GenderCount;
}

export function resultSummary(students: Student[], results: Map<string, StudentResults>, period: Period): ResultSummary {
  const s: ResultSummary = { total: zero(), appeared: zero(), absent: zero(), pass: zero(), fail: zero(), incomplete: zero() };
  for (const st of students) {
    const r = results.get(st.id);
    if (!r) continue;
    const pr = pickPeriod(r, period);
    bump(s.total, st.gender);
    if (pr.status === 'absent') bump(s.absent, st.gender);
    else {
      bump(s.appeared, st.gender);
      if (pr.status === 'pass') bump(s.pass, st.gender);
      else if (pr.status === 'fail') bump(s.fail, st.gender);
      else bump(s.incomplete, st.gender);
    }
  }
  return s;
}

export interface GroupRow {
  key: string;
  boys: number;
  girls: number;
  total: number;
  appeared: number;
  pass: number;
  passPct: number | null;
}

/** Category-wise (प्रवर्गनिहाय) or caste-wise (जातनिहाय) result. */
export function groupResult(
  students: Student[],
  results: Map<string, StudentResults>,
  period: Period,
  keyOf: (s: Student) => string,
): GroupRow[] {
  const rows = new Map<string, GroupRow>();
  for (const st of students) {
    const key = keyOf(st) || '—';
    let row = rows.get(key);
    if (!row) {
      row = { key, boys: 0, girls: 0, total: 0, appeared: 0, pass: 0, passPct: null };
      rows.set(key, row);
    }
    if (st.gender === 'M') row.boys++;
    else row.girls++;
    row.total++;
    const r = results.get(st.id);
    if (r) {
      const pr = pickPeriod(r, period);
      if (pr.status !== 'absent') row.appeared++;
      if (pr.status === 'pass') row.pass++;
    }
  }
  for (const row of rows.values()) row.passPct = row.appeared ? round2((row.pass / row.appeared) * 100) : null;
  return [...rows.values()];
}

export interface GroupGradeRow {
  key: string;
  /** पटसंख्या — every student of the group. */
  pat: GenderCount;
  /** मूल्यमापनासाठी उपस्थित — students with any marks in the period. */
  appeared: GenderCount;
  /** Students per overall grade of the period. */
  grades: Record<string, GenderCount>;
}

/**
 * जातीनिहाय / श्रेणीनिहाय संकलन: per group, the strength, the students
 * assessed and how many got each overall grade — boys and girls separately.
 */
export function groupGradeTable(
  cfg: ClassConfig,
  students: Student[],
  results: Map<string, StudentResults>,
  period: Period,
  keyOf: (s: Student) => string,
): Map<string, GroupGradeRow> {
  const out = new Map<string, GroupGradeRow>();
  const row = (key: string) => {
    let r = out.get(key);
    if (!r) {
      r = { key, pat: zero(), appeared: zero(), grades: {} };
      for (const b of cfg.grades) r.grades[b.label] = zero();
      out.set(key, r);
    }
    return r;
  };
  for (const st of students) {
    const r = row(keyOf(st));
    bump(r.pat, st.gender);
    const res = results.get(st.id);
    if (!res) continue;
    const pr = pickPeriod(res, period);
    if (pr.status === 'absent') continue;
    bump(r.appeared, st.gender);
    if (pr.grade) {
      if (!r.grades[pr.grade]) r.grades[pr.grade] = zero();
      bump(r.grades[pr.grade], st.gender);
    }
  }
  return out;
}

/** Share of expected assessment entries (student × subject × type) that have marks. */
export function entryCompletion(
  cfg: ClassConfig,
  students: Student[],
  idx: AssessmentIndex,
  term: Term,
): { done: number; total: number; pct: number } {
  let done = 0;
  let total = 0;
  const w = cfg.weights[String(term) as '1' | '2'] ?? {};
  for (const subj of cfg.subjects) {
    const sw = w[subj.id];
    const types: AType[] = [];
    if (sumTools(cfg.fTools, sw?.F, undefined).used) types.push('F');
    if (sumTools(cfg.sParts, sw?.S, undefined).used) types.push('S');
    for (const st of students) {
      for (const t of types) {
        total++;
        const rec = idx.get(assessmentId(st.id, subj.id, term, t));
        if (rec && Object.values(rec.scores).some((v) => v !== null && v !== undefined)) done++;
      }
    }
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Attendance percentage. */
export function attendancePct(present: number | null, working: number | null): number | null {
  if (present === null || working === null || !(working > 0)) return null;
  return round2((present / working) * 100);
}
