/** Marks export (Excel / CSV) built from the central calculation engine. */
import { assessmentId, pickPeriod, type AssessmentIndex, type StudentResults } from './calc';
import { fmtNum, fmtPct } from './format';
import { periodLabel, GENDER_LABEL, TERM_LABEL } from './labels';
import type { ClassConfig, Period, Student, Term } from './types';
import type { Cell, SheetSpec } from './sheet';

export function summarySheet(cfg: ClassConfig, students: Student[], results: Map<string, StudentResults>, period: Period): SheetSpec {
  const head: Cell[] = ['हजेरी क्र.', 'विद्यार्थ्याचे नाव', 'लिंग'];
  for (const s of cfg.subjects) head.push(`${s.short} अ`, `${s.short} ब`, `${s.short} एकूण`, `${s.short} श्रेणी`);
  head.push('एकूण गुण', 'कमाल गुण', 'टक्केवारी', 'श्रेणी', 'निकाल');
  const rows: Cell[][] = [head];
  for (const st of students) {
    const r = results.get(st.id);
    if (!r) continue;
    const pr = pickPeriod(r, period);
    const row: Cell[] = [st.rollNo, st.fullName, GENDER_LABEL[st.gender]];
    for (const s of cfg.subjects) {
      const x = pr.subjects[s.id];
      row.push(x?.fObt ?? null, x?.hasSummative ? (x.sObt ?? null) : null, x?.total ?? null, x?.grade || null);
    }
    row.push(pr.total, pr.max, pr.pct === null ? null : Number(fmtPct(pr.pct)), pr.grade || null, pr.resultLabel);
    rows.push(row);
  }
  return { name: periodLabel(period), rows, widths: [8, 28, 8] };
}

export function detailSheet(cfg: ClassConfig, students: Student[], idx: AssessmentIndex): SheetSpec {
  const head: Cell[] = ['हजेरी क्र.', 'विद्यार्थ्याचे नाव', 'सत्र', 'विषय', 'प्रकार', ...cfg.fTools.map((t) => t.label), ...cfg.sParts.map((t) => `${t.label} (संकलित)`)];
  const rows: Cell[][] = [head];
  for (const st of students) {
    for (const term of [1, 2] as Term[]) {
      for (const subj of cfg.subjects) {
        for (const type of ['F', 'S'] as const) {
          const rec = idx.get(assessmentId(st.id, subj.id, term, type));
          if (!rec) continue;
          const row: Cell[] = [st.rollNo, st.fullName, TERM_LABEL[term], subj.name, type === 'F' ? 'आकारिक' : 'संकलित'];
          for (const t of cfg.fTools) row.push(type === 'F' ? (rec.scores[t.key] ?? null) : null);
          for (const t of cfg.sParts) row.push(type === 'S' ? (rec.scores[t.key] ?? null) : null);
          rows.push(row);
        }
      }
    }
  }
  return { name: 'तपशीलवार गुण', rows, widths: [8, 28, 12, 18, 10] };
}

export function marksWorkbook(cfg: ClassConfig, students: Student[], results: Map<string, StudentResults>, idx: AssessmentIndex): SheetSpec[] {
  return [summarySheet(cfg, students, results, 1), summarySheet(cfg, students, results, 2), summarySheet(cfg, students, results, 'annual'), detailSheet(cfg, students, idx)];
}

export { fmtNum };
