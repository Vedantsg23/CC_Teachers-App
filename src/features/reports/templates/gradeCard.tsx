/**
 * प्रगती कार्ड (पिवळे कार्ड) — the one-sided card many schools hand out:
 * शाळा, नाव, माध्यम, रजि. नंबर, वर्ग, जन्म दिनांक and, side by side, the
 * विषयवार श्रेणी and एकूण श्रेणी of प्रथम व द्वितीय सत्र. Two cards per A4
 * landscape sheet (cut along the dashed line). A सत्र that is not chosen is
 * printed blank, as when the card goes home after the first term.
 */
import type { ReactNode } from 'react';
import { fmtDate } from '../../../lib/format';
import { standardNum, TERM_LABEL } from '../../../lib/labels';
import type { Student, Subject, Term } from '../../../lib/types';
import { ReportPage } from '../../../components/report/Report';
import { digitPrinter, fullYear, pickStudents, type ReportCtx, type ReportOpts } from '../common';

type Print = (v: string | number | null | undefined) => string;

/** "प्रथम भाषा (मराठी)" for the languages, as printed on the card; else the subject name. */
export function cardSubjectLabel(s: Pick<Subject, 'name' | 'remarkLabel'>): string[] {
  const m = /^(प्रथम|द्वितीय|तृतीय)\s+भाषा\s*[:：-]/.exec(s.remarkLabel ?? '');
  return m ? [`${m[1]} भाषा`, `(${s.name})`] : [s.name];
}

function Field({ k, v, grow = 1 }: { k: string; v: ReactNode; grow?: number }) {
  return (
    <span className="yc-f" style={{ flexGrow: grow }}>
      <span className="yc-k">{k}</span>
      <span className="yc-v">{v}</span>
    </span>
  );
}

function TermTable({ ctx, st, term, filled, d, rowH }: { ctx: ReportCtx; st: Student; term: Term; filled: boolean; d: Print; rowH: number }) {
  const r = ctx.b.results.get(st.id);
  const det = r?.details[String(term) as '1' | '2'];
  const tr = term === 1 ? r?.t1 : r?.t2;
  // the overall grade only once every subject that counts has its marks
  const overall = filled && tr && (tr.status === 'pass' || tr.status === 'fail') ? tr.grade : '';
  return (
    <div className="yc-term">
      <div className="yc-term-title">* {TERM_LABEL[term]} *</div>
      <table className="rt yc-table">
        <colgroup>
          <col style={{ width: '9mm' }} />
          <col />
          <col style={{ width: '14mm' }} />
        </colgroup>
        <thead>
          <tr>
            <th>अ.नं.</th>
            <th>विषय</th>
            <th>श्रेणी</th>
          </tr>
        </thead>
        <tbody>
          {ctx.cfg.subjects.map((s, i) => {
            const x = det?.[s.id];
            return (
              <tr key={s.id} style={{ height: `${rowH}mm` }}>
                <td>{d(i + 1)}</td>
                <td className="yc-subj">
                  {cardSubjectLabel(s).map((l) => (
                    <div key={l}>{l}</div>
                  ))}
                </td>
                <td className="yc-g">{filled && x?.entered ? d(x.grade) : ''}</td>
              </tr>
            );
          })}
          <tr style={{ height: `${rowH}mm` }}>
            <td />
            <td className="yc-subj yc-total">एकूण श्रेणी</td>
            <td className="yc-g">{d(overall)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function GradeCard({ ctx, st, terms }: { ctx: ReportCtx; st: Student; terms: Term[] }) {
  const { school, cls, cfg } = ctx;
  const d = digitPrinter(ctx);
  const rows = cfg.subjects.length + 1;
  // rows share ~100 mm of the card (the signatures stay inside the frame)
  const rowH = Math.max(7, Math.min(12, Math.floor((100 / rows) * 10) / 10));
  return (
    <div className="yc-card">
      <div className="yc-frame">
        <div className="yc-head">
          <span className="yc-badge">विद्यार्थी प्रगतीपत्रक</span>
          <span className="yc-year">{d(fullYear(cls.year))}</span>
        </div>
        <div className="yc-row">
          <Field k="शाळा :" v={school.name} />
        </div>
        <div className="yc-row">
          <Field k="विद्यार्थ्याचे नांव :" v={st.fullName} />
        </div>
        <div className="yc-row">
          <Field k="माध्यम :" v={school.medium || 'मराठी'} />
          <Field k="रजि. नंबर :" v={d(st.regNo)} />
        </div>
        <div className="yc-row">
          <Field k="वर्ग :" v={d(`${standardNum(cls.standard)} ${cls.section}`.trim())} />
          <Field k="जन्म दिनांक :" v={d(fmtDate(st.dob).replace(/-/g, '/'))} />
        </div>
        <div className="yc-terms">
          {([1, 2] as Term[]).map((t) => (
            <TermTable key={t} ctx={ctx} st={st} term={t} filled={terms.includes(t)} d={d} rowH={rowH} />
          ))}
        </div>
        <div className="yc-signs">
          <span>पालकांची स्वाक्षरी</span>
          <span>वर्गशिक्षक</span>
          <span>मुख्याध्यापक</span>
        </div>
      </div>
    </div>
  );
}

export function GradeCardReport({ ctx, opts }: { ctx: ReportCtx; opts: ReportOpts }) {
  const students = pickStudents(ctx, opts);
  const sheets: Student[][] = [];
  for (let i = 0; i < students.length; i += 2) sheets.push(students.slice(i, i + 2));
  return (
    <>
      {sheets.map((pair) => (
        <ReportPage key={pair[0].id} orientation="landscape" className="yc">
          <div className="yc-sheet">
            <GradeCard ctx={ctx} st={pair[0]} terms={opts.terms} />
            <div className="yc-cut">
              <i />
            </div>
            {pair[1] ? <GradeCard ctx={ctx} st={pair[1]} terms={opts.terms} /> : <div className="yc-card yc-none" />}
          </div>
        </ReportPage>
      ))}
    </>
  );
}
