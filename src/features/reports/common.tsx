import type { ReactNode } from 'react';
import { attendanceTotals, type ClassBundle } from '../../app/data';
import { gradeDistribution } from '../../lib/calc';
import { termOfMonth, yearMonths } from '../../lib/format';
import { standardLabel, TERM_LABEL } from '../../lib/labels';
import type { ClassConfig, ClassRoom, LcTemplate, Period, School, Student, Term } from '../../lib/types';
import type { SignItem } from '../../components/report/Report';

export interface ReportCtx {
  school: School;
  cls: ClassRoom;
  cfg: ClassConfig;
  teacher: string;
  b: ClassBundle;
  lc: LcTemplate;
}

export interface ReportOpts {
  term: Term;
  period: Period;
  subject: string; // subject id or 'all'
  student: string; // student id or 'all'
  group: 'category' | 'caste';
  orientation: 'portrait' | 'landscape';
}

export const B = ({ children }: { children: ReactNode }) => <b>{children}</b>;

export function classCell(ctx: ReportCtx): ReactNode {
  return (
    <>
      इयत्ता: <b>{standardLabel(ctx.cls.standard)}</b>, तुकडी: <b>{ctx.cls.section}</b>
    </>
  );
}

export function yearCell(ctx: ReportCtx): ReactNode {
  return (
    <>
      सन : <b>{ctx.cls.year}</b>
    </>
  );
}

export function udiseCell(ctx: ReportCtx): ReactNode {
  return (
    <>
      युडायस: <b>{ctx.school.udise || '—'}</b>
    </>
  );
}

export function schoolCell(ctx: ReportCtx): ReactNode {
  return (
    <>
      शाळा: <b>{ctx.school.name}</b>
    </>
  );
}

export function termText(t: Term): string {
  return TERM_LABEL[t];
}

export function signs(ctx: ReportCtx, withParent = false): SignItem[] {
  const r = ctx.cfg.report;
  const out: SignItem[] = [
    { label: r.teacherSignLabel, name: ctx.teacher },
    { label: r.headSignLabel, name: ctx.school.headmaster },
  ];
  if (withParent) out.push({ label: r.parentSignLabel, name: '' });
  return out;
}

export function pickStudents(ctx: ReportCtx, opts: ReportOpts): Student[] {
  if (opts.student && opts.student !== 'all') return ctx.b.allStudents.filter((s) => s.id === opts.student);
  return ctx.b.students;
}

export function termMonths(year: string, t: Term): string[] {
  return yearMonths(year).filter((m) => termOfMonth(m) === t);
}

export const yearMonthsOf = yearMonths;

export function periodMonths(year: string, p: Period): string[] {
  return p === 'annual' ? yearMonths(year) : termMonths(year, p);
}

export function presentDays(ctx: ReportCtx, studentId: string, months: string[]): { present: number; working: number; entered: boolean } {
  return attendanceTotals(ctx.b, studentId, months);
}

export const dash = (v: ReactNode): ReactNode => (v === null || v === undefined || v === '' ? '-' : v);

/** Grade distribution (count of students per grade, per subject) — reference footer table. */
export function GradeDistTable({ ctx, period, fontPt = 7.5 }: { ctx: ReportCtx; period: Period; fontPt?: number }) {
  const grades = [...ctx.cfg.grades].sort((a, z) => z.min - a.min).map((g) => g.label);
  return (
    <table className="rt" style={{ fontSize: `${fontPt}pt`, width: 'auto' }}>
      <thead>
        <tr>
          <th>अ.नं</th>
          <th>विषय</th>
          {grades.map((g) => (
            <th key={g} style={{ minWidth: '8mm' }}>
              {g}
            </th>
          ))}
          <th>एकूण</th>
        </tr>
      </thead>
      <tbody>
        {ctx.cfg.subjects.map((s, i) => {
          const d = gradeDistribution(ctx.cfg, ctx.b.students, ctx.b.results, period, s.id);
          const total = Object.values(d).reduce((a, c) => a + c.T, 0);
          return (
            <tr key={s.id}>
              <td>{i + 1}</td>
              <td className="l" style={{ whiteSpace: 'nowrap' }}>
                {s.short}
              </td>
              {grades.map((g) => (
                <td key={g}>{d[g]?.T ?? 0}</td>
              ))}
              <td className="b">{total}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Our own neutral emblem for the cover page (an open register with a tick). */
export function Emblem({ className = 'cover-emblem' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="60" cy="60" r="57" fill="#eef3fa" stroke="#1e3a6e" strokeWidth="3" />
      <path d="M22 38 Q40 32 58 40 L58 92 Q40 84 22 90 Z" fill="#ffffff" stroke="#1e3a6e" strokeWidth="3" strokeLinejoin="round" />
      <path d="M98 38 Q80 32 62 40 L62 92 Q80 84 98 90 Z" fill="#ffffff" stroke="#1e3a6e" strokeWidth="3" strokeLinejoin="round" />
      <line x1="31" y1="40" x2="31" y2="86" stroke="#c2362f" strokeWidth="2" />
      <line x1="35" y1="52" x2="52" y2="54" stroke="#9bb3d3" strokeWidth="2.2" />
      <line x1="35" y1="62" x2="52" y2="64" stroke="#9bb3d3" strokeWidth="2.2" />
      <line x1="35" y1="72" x2="52" y2="74" stroke="#9bb3d3" strokeWidth="2.2" />
      <path d="M70 64 L78 72 L92 54" fill="none" stroke="#1f7a4a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
