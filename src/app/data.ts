/** Live data hooks for the logged-in teacher's class. */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { classResults, indexAssessments, type AssessmentIndex, type StudentResults } from '../lib/calc';
import { byRoll } from '../lib/format';
import * as repo from '../lib/repo';
import type { Assessment, AttendanceMonth, AttendanceRec, DailyAttendance, Remark, RemarkItem, Student } from '../lib/types';
import { useTeacher } from './session';

export function useStudents(includeLeft = false): Student[] | undefined {
  const { scope } = useTeacher();
  return useLiveQuery(async () => (await repo.listStudents(scope, { includeLeft })).sort(byRoll), [scope.classId, includeLeft]);
}

export function useLibrary(): RemarkItem[] | undefined {
  const { scope } = useTeacher();
  return useLiveQuery(() => repo.listLibrary(scope), [scope.classId]);
}

export interface ClassBundle {
  students: Student[]; // active, sorted by roll
  allStudents: Student[];
  assessments: Assessment[];
  idx: AssessmentIndex;
  remarks: Remark[];
  remarkMap: Map<string, Remark>;
  attMonths: AttendanceMonth[];
  attRecs: AttendanceRec[];
  /** attendance by `${studentId}|${month}` and working days by month */
  attById: Map<string, AttendanceRec>;
  workingByMonth: Map<string, number | null>;
  daily: DailyAttendance[];
  results: Map<string, StudentResults>;
}

export function useClassBundle(): ClassBundle | undefined {
  const { scope, cfg } = useTeacher();
  const raw = useLiveQuery(async () => {
    const [all, assessments, remarks, att, daily] = await Promise.all([
      repo.listStudents(scope, { includeLeft: true }),
      repo.listAssessments(scope),
      repo.listRemarks(scope),
      repo.listAttendance(scope),
      repo.listDaily(scope),
    ]);
    return { all, assessments, remarks, att, daily };
  }, [scope.classId]);

  return useMemo(() => {
    if (!raw) return undefined;
    const allStudents = [...raw.all].sort(byRoll);
    const students = allStudents.filter((s) => s.status === 'active');
    return {
      students,
      allStudents,
      assessments: raw.assessments,
      idx: indexAssessments(raw.assessments),
      remarks: raw.remarks,
      remarkMap: new Map(raw.remarks.map((r) => [r.id, r])),
      attMonths: raw.att.months,
      attRecs: raw.att.recs,
      attById: new Map(raw.att.recs.map((r) => [r.id, r])),
      workingByMonth: new Map(raw.att.months.map((m) => [m.month, m.workingDays])),
      daily: raw.daily,
      results: classResults(cfg, allStudents, raw.assessments),
    };
  }, [raw, cfg]);
}

/** Present / working days of a student for a set of months. */
export function attendanceTotals(b: Pick<ClassBundle, 'attById' | 'workingByMonth'>, studentId: string, months: string[]): { present: number; working: number; entered: boolean } {
  let present = 0;
  let working = 0;
  let entered = false;
  for (const m of months) {
    const wm = b.workingByMonth.get(m);
    if (wm === null || wm === undefined) continue;
    const rec = b.attById.get(`${studentId}|${m}`);
    working += wm;
    if (rec && rec.present !== null) {
      present += rec.present;
      entered = true;
    }
  }
  return { present, working, entered };
}
