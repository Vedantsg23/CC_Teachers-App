/**
 * Final result reports in the formats used by schools (both सत्र together):
 *  - निकाल पत्रक: per subject, प्रथम व द्वितीय सत्र — आकारिक, संकलित, एकूण, श्रेणी
 *  - विषयनिहाय / श्रेणीनिहाय संकलन तक्ता
 *  - जातीनिहाय / श्रेणीनिहाय संकलन तक्ता
 */
import type { ReactNode } from 'react';
import { gradeDistribution, groupGradeTable, type GenderCount } from '../../../lib/calc';
import { fmtNum } from '../../../lib/format';
import { CASTE_GROUPS, casteGroupOf, categoryShort, NO_GROUP, TERM_LABEL } from '../../../lib/labels';
import type { Subject, Term, ToolMax } from '../../../lib/types';
import { PagedTable, ReportPage, Signatures } from '../../../components/report/Report';
import { digitPrinter, fullYear, officialSigns, presentDays, schoolLine, yearMonthsOf, type ReportCtx } from '../common';

const TERMS: Term[] = [1, 2];
const sumMax = (m: ToolMax | undefined) => Object.values(m ?? {}).reduce<number>((a, v) => a + (v ?? 0), 0);
const n = (v: number | null | undefined) => (v === null || v === undefined ? '' : fmtNum(v));
type Print = (v: string | number | null | undefined) => string;

function sortedGrades(ctx: ReportCtx): string[] {
  return [...ctx.cfg.grades].sort((a, z) => z.min - a.min).map((g) => g.label);
}

/** Title + "सन" on one line, school details on the next. */
function FinalHead({ ctx, d, title, big }: { ctx: ReportCtx; d: Print; title: string; big?: boolean }) {
  return (
    <div className="fr-head">
      <div className={`fr-title ${big ? 'big' : ''}`}>
        <span>{title}</span>
        <span className="fr-year">सन : {d(fullYear(ctx.cls.year))}</span>
      </div>
      <div className="fr-sub">
        {schoolLine(ctx, (v) => d(v)).map((p) => (
          <span key={p.k}>
            {p.k} : {p.v}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* निकाल पत्रक — दोन्ही सत्रे                                              */
/* ------------------------------------------------------------------ */
export function ResultBothTermsReport({ ctx }: { ctx: ReportCtx }) {
  const { cfg, b, cls } = ctx;
  const d = digitPrinter(ctx);
  const subjects = cfg.subjects;
  const wOf = (t: Term, s: Subject) => cfg.weights[String(t) as '1' | '2']?.[s.id];
  const scholastic = new Set(subjects.filter((s) => TERMS.some((t) => sumMax(wOf(t, s)?.S) > 0)).map((s) => s.id));
  const perTerm = (s: Subject) => (scholastic.has(s.id) ? 4 : 2);
  const months = yearMonthsOf(cls.year);

  // fixed column widths (landscape A4, 277 mm usable)
  const fixed = [5, 21, 7.5, 6.5];
  const numCols = subjects.reduce((a, s) => a + (scholastic.has(s.id) ? 3 : 1) * 2, 0);
  const gradeCols = subjects.length * 2;
  const unit = (277 - fixed.reduce((a, v) => a + v, 0)) / (numCols + gradeCols * 1.15);
  const colgroup = (
    <colgroup>
      {fixed.map((w, i) => (
        <col key={`f${i}`} style={{ width: `${w}mm` }} />
      ))}
      {subjects.flatMap((s) =>
        TERMS.flatMap((t) => [
          ...Array.from({ length: scholastic.has(s.id) ? 3 : 1 }, (_, i) => <col key={`${s.id}${t}${i}`} style={{ width: `${unit.toFixed(2)}mm` }} />),
          <col key={`${s.id}${t}g`} style={{ width: `${(unit * 1.15).toFixed(2)}mm` }} />,
        ]),
      )}
    </colgroup>
  );

  const header = <FinalHead ctx={ctx} d={d} title="सातत्यपूर्ण सर्वंकष मूल्यमापन" />;
  const thead = (
    <>
      <tr>
        <th rowSpan={4}>अ. क्र.</th>
        <th rowSpan={4}>विद्यार्थी नावे</th>
        <th rowSpan={4} className="fr-xs">
          जात/ संवर्ग
        </th>
        <th rowSpan={4} className="fr-xs">
          उप स्थित दिवस
        </th>
        {subjects.map((s) => (
          <th key={s.id} colSpan={perTerm(s) * 2} className="fr-subj">
            {d(scholastic.has(s.id) ? s.name : s.short || s.name)}
          </th>
        ))}
      </tr>
      <tr>
        {subjects.flatMap((s) =>
          TERMS.map((t) => (
            <th key={`${s.id}${t}`} colSpan={perTerm(s)} className="fr-term">
              {TERM_LABEL[t]}
            </th>
          )),
        )}
      </tr>
      <tr className="fr-cap">
        {subjects.flatMap((s) =>
          TERMS.flatMap((t) =>
            // zero-width spaces let the narrow caption cells wrap between syllables
            (scholastic.has(s.id) ? ['आका​रिक', 'संक​लित', 'ए​कूण', 'श्रेणी'] : ['आका​रिक', 'श्रेणी']).map((label) => <th key={`${s.id}${t}${label}`}>{label}</th>),
          ),
        )}
      </tr>
      <tr className="fr-max">
        {subjects.flatMap((s) =>
          TERMS.flatMap((t) => {
            const w = wOf(t, s);
            const f = sumMax(w?.F);
            const sm = sumMax(w?.S);
            const vals = scholastic.has(s.id) ? [f, sm, f + sm, '-'] : [f + sm, '-'];
            return vals.map((v, i) => <th key={`${s.id}${t}${i}`}>{v === 0 ? '-' : d(v)}</th>);
          }),
        )}
      </tr>
    </>
  );

  const rows = b.students.map((st, i) => {
    const r = b.results.get(st.id);
    const att = presentDays(ctx, st.id, months);
    const cells: ReactNode[] = [];
    for (const s of subjects) {
      for (const t of TERMS) {
        const x = r?.details[String(t) as '1' | '2'][s.id];
        const e = !!x?.entered;
        const v = (val: number | null | undefined) => (e ? d(n(val)) : '');
        const k = `${s.id}${t}`;
        if (scholastic.has(s.id)) {
          cells.push(<td key={`${k}f`}>{v(x?.fObt)}</td>, <td key={`${k}s`}>{v(x?.sObt)}</td>, <td key={`${k}t`}>{v(x?.total)}</td>);
        } else {
          cells.push(<td key={`${k}t`}>{v(x?.total)}</td>);
        }
        cells.push(
          <td key={`${k}g`} className="fr-g">
            {e ? d(x?.grade) : ''}
          </td>,
        );
      }
    }
    return (
      <tr key={st.id}>
        <td>{d(i + 1)}</td>
        <td className="fr-name">{st.fullName}</td>
        <td className="fr-xs">{st.category ? categoryShort(st.category) : ''}</td>
        <td>{att.entered ? d(att.present) : ''}</td>
        {cells}
      </tr>
    );
  });

  return (
    <PagedTable
      orientation="landscape"
      header={header}
      thead={thead}
      colgroup={colgroup}
      tableClassName="rt fr"
      rows={rows}
      emptyColSpan={4 + subjects.reduce((a, s) => a + perTerm(s) * 2, 0)}
      footer={<Signatures items={officialSigns(ctx, 5)} className="official fr-sign" />}
    />
  );
}

/* ------------------------------------------------------------------ */
/* विषयनिहाय / श्रेणीनिहाय संकलन तक्ता                                     */
/* ------------------------------------------------------------------ */
export function SubjectGradeSummaryReport({ ctx }: { ctx: ReportCtx }) {
  const { cfg, b } = ctx;
  const d = digitPrinter(ctx);
  const grades = sortedGrades(ctx);
  const rowH = Math.min(6.6, 118 / Math.max(1, cfg.subjects.length * 2));
  const dataCol = (277 - 9 - 36 - 15) / (3 + grades.length * 2);
  return (
    <ReportPage orientation="landscape">
      <div className="page-body">
        <FinalHead ctx={ctx} d={d} title="विषयनिहाय / श्रेणीनिहाय संकलन तक्ता" big />
        <table className="rt fs">
          <colgroup>
            <col style={{ width: '9mm' }} />
            <col style={{ width: '36mm' }} />
            <col style={{ width: '15mm' }} />
            {Array.from({ length: 3 + grades.length * 2 }, (_, i) => (
              <col key={i} style={{ width: `${dataCol.toFixed(2)}mm` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={3}>अ. क्र.</th>
              <th rowSpan={3} colSpan={2}>
                विषय
              </th>
              <th rowSpan={2} colSpan={3} className="fs-big">
                पट
              </th>
              <th colSpan={grades.length * 2} className="fs-big">
                श्रेणी
              </th>
            </tr>
            <tr>
              {grades.map((g) => (
                <th key={g} colSpan={2} className="fs-grade">
                  {d(g)}
                </th>
              ))}
            </tr>
            <tr className="fs-mf">
              <th>मुलगे</th>
              <th>मुली</th>
              <th>एकूण</th>
              {grades.flatMap((g) => [<th key={`${g}m`}>मुलगे</th>, <th key={`${g}f`}>मुली</th>])}
            </tr>
          </thead>
          <tbody>
            {cfg.subjects.flatMap((s, i) =>
              TERMS.map((t) => {
                const dist = gradeDistribution(cfg, b.students, b.results, t, s.id);
                const pat = grades.reduce((a, g) => ({ M: a.M + (dist[g]?.M ?? 0), F: a.F + (dist[g]?.F ?? 0) }), { M: 0, F: 0 });
                return (
                  <tr key={`${s.id}${t}`} style={{ height: `${rowH.toFixed(2)}mm` }}>
                    {t === 1 ? <td rowSpan={2}>{d(i + 1)}</td> : null}
                    {t === 1 ? (
                      <td rowSpan={2} className="fs-subj">
                        {d(s.name)}
                      </td>
                    ) : null}
                    <td className="fs-term">{TERM_LABEL[t]}</td>
                    <td>{d(pat.M)}</td>
                    <td>{d(pat.F)}</td>
                    <td>{d(pat.M + pat.F)}</td>
                    {grades.flatMap((g) => [<td key={`${g}m`}>{d(dist[g]?.M ?? 0)}</td>, <td key={`${g}f`}>{d(dist[g]?.F ?? 0)}</td>])}
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
        <Signatures items={officialSigns(ctx, 4)} className="official fr-sign" />
      </div>
    </ReportPage>
  );
}

/* ------------------------------------------------------------------ */
/* जातीनिहाय / श्रेणीनिहाय संकलन तक्ता                                     */
/* ------------------------------------------------------------------ */
export function CasteGradeSummaryReport({ ctx }: { ctx: ReportCtx }) {
  const { cfg, b } = ctx;
  const d = digitPrinter(ctx);
  const grades = sortedGrades(ctx);
  const groups = CASTE_GROUPS.map((g) => ({ key: g.key, label: g.label }));
  if (b.students.some((s) => casteGroupOf(s.category) === NO_GROUP.key)) groups.push(NO_GROUP);

  const add = (a: GenderCount, c: GenderCount | undefined): GenderCount => ({ M: a.M + (c?.M ?? 0), F: a.F + (c?.F ?? 0), T: a.T + (c?.T ?? 0) });
  const zero: GenderCount = { M: 0, F: 0, T: 0 };
  const cells = (key: string, c: GenderCount | undefined) => [
    <td key={`${key}m`}>{d(c?.M ?? 0)}</td>,
    <td key={`${key}f`}>{d(c?.F ?? 0)}</td>,
    <td key={`${key}t`}>{d(c?.T ?? 0)}</td>,
  ];

  const termTable = (t: Term) => {
    const tab = groupGradeTable(cfg, b.students, b.results, t, (s) => casteGroupOf(s.category));
    const rows = groups.map((g) => tab.get(g.key));
    const total = {
      pat: rows.reduce((a, r) => add(a, r?.pat), zero),
      appeared: rows.reduce((a, r) => add(a, r?.appeared), zero),
      grade: (g: string) => rows.reduce((a, r) => add(a, r?.grades[g]), zero),
    };
    const dataCol = (277 - 31 - 9) / ((2 + grades.length) * 3);
    return (
      <table className="rt fc">
        <colgroup>
          <col style={{ width: '31mm' }} />
          {Array.from({ length: (2 + grades.length) * 3 }, (_, i) => (
            <col key={i} style={{ width: `${dataCol.toFixed(2)}mm` }} />
          ))}
          <col style={{ width: '9mm' }} />
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} className="fc-big">
              जात संवर्ग
            </th>
            <th colSpan={3} className="fc-big">
              पटसंख्या
            </th>
            <th colSpan={3} className="fc-sm">
              मूल्यमापनासाठी उपस्थित विद्यार्थी
            </th>
            {grades.map((g) => (
              <th key={g} colSpan={3} className="fc-big">
                {d(g)}
              </th>
            ))}
            <th rowSpan={2} className="fc-sm">
              श्रेणी/ शेरा
            </th>
          </tr>
          <tr className="fc-mf">
            {['pat', 'app', ...grades].flatMap((k) => [<th key={`${k}m`}>मुलगे</th>, <th key={`${k}f`}>मुली</th>, <th key={`${k}t`}>एकूण</th>])}
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => {
            const r = rows[i];
            return (
              <tr key={g.key}>
                <td className="fc-group">{g.label}</td>
                {cells('pat', r?.pat)}
                {cells('app', r?.appeared)}
                {grades.flatMap((gl) => cells(gl, r?.grades[gl]))}
                <td />
              </tr>
            );
          })}
          <tr className="total">
            <td className="fc-group">एकूण</td>
            {cells('pat', total.pat)}
            {cells('app', total.appeared)}
            {grades.flatMap((gl) => cells(gl, total.grade(gl)))}
            <td />
          </tr>
        </tbody>
      </table>
    );
  };

  return (
    <ReportPage orientation="landscape">
      <div className="page-body">
        <FinalHead ctx={ctx} d={d} title="जातीनिहाय / श्रेणीनिहाय संकलन तक्ता" big />
        <div className="fc-term">* {TERM_LABEL[1]} *</div>
        {termTable(1)}
        <div className="fc-term">* {TERM_LABEL[2]} *</div>
        {termTable(2)}
        <Signatures items={officialSigns(ctx, 4)} className="official fr-sign" />
      </div>
    </ReportPage>
  );
}
