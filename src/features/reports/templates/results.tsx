/** Annual marksheet and the result summary. */
import { pickPeriod, resultSummary, round2 } from '../../../lib/calc';
import { fmtDate, fmtNum, fmtPct } from '../../../lib/format';
import { GENDER_LABEL, periodLabel, standardLabel } from '../../../lib/labels';
import type { Period } from '../../../lib/types';
import { CceHeader, PagedTable, ReportPage, Signatures } from '../../../components/report/Report';
import { classCell, dash, pickStudents, presentDays, schoolCell, signs, udiseCell, yearCell, yearMonthsOf, type ReportCtx, type ReportOpts } from '../common';

const n = (v: number | null | undefined) => (v === null || v === undefined ? '' : fmtNum(v));

/* ------------------------------------------------------------------ */
export function AnnualMarksheetReport({ ctx, opts }: { ctx: ReportCtx; opts: ReportOpts }) {
  const { cfg, b, school, cls } = ctx;
  const grades = [...cfg.grades].sort((a, z) => z.min - a.min);
  return (
    <>
      {pickStudents(ctx, opts).map((st) => {
        const r = b.results.get(st.id);
        const att = presentDays(ctx, st.id, yearMonthsOf(cls.year));
        const y = r?.annual;
        return (
          <ReportPage key={st.id}>
            <div className="page-body" style={{ display: 'flex', flexDirection: 'column' }}>
              {school.orgLine ? <div className="rpt-org">{school.orgLine}</div> : null}
              <div className="rpt-title" style={{ fontSize: '15pt' }}>
                {school.name}
              </div>
              <div className="rpt-meta" style={{ justifyContent: 'center', gap: '10mm', fontSize: '9.5pt' }}>
                <div>UDISE: {school.udise || '—'}</div>
                {school.taluka ? <div>ता. {school.taluka}</div> : null}
                {school.district ? <div>जि. {school.district}</div> : null}
              </div>
              <div className="lc-title" style={{ width: '90mm' }}>
                वार्षिक गुणपत्रक — सन {cls.year}
              </div>
              <table className="rt big" style={{ marginTop: '2mm' }}>
                <tbody>
                  <tr>
                    <th className="l" style={{ width: '38mm' }}>
                      विद्यार्थ्याचे नाव
                    </th>
                    <td className="l b" colSpan={3}>
                      {st.fullName}
                    </td>
                  </tr>
                  <tr>
                    <th className="l">इयत्ता / तुकडी</th>
                    <td className="l">
                      {standardLabel(cls.standard)} / {cls.section}
                    </td>
                    <th className="l" style={{ width: '30mm' }}>
                      हजेरी क्रमांक
                    </th>
                    <td className="l">{st.rollNo ?? ''}</td>
                  </tr>
                  <tr>
                    <th className="l">जन्मतारीख</th>
                    <td className="l">{fmtDate(st.dob)}</td>
                    <th className="l">रजि. क्रमांक</th>
                    <td className="l">{st.regNo}</td>
                  </tr>
                  <tr>
                    <th className="l">आईचे नाव</th>
                    <td className="l">{st.motherName}</td>
                    <th className="l">पेन नंबर (PEN)</th>
                    <td className="l">{st.pen}</td>
                  </tr>
                </tbody>
              </table>
              <table className="rt big" style={{ marginTop: '4mm' }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: '11mm' }}>
                      अ.क्र.
                    </th>
                    <th rowSpan={2}>विषय</th>
                    <th>प्रथम सत्र</th>
                    <th>द्वितीय सत्र</th>
                    <th>वार्षिक गुण</th>
                    <th rowSpan={2}>टक्केवारी</th>
                    <th rowSpan={2}>श्रेणी</th>
                  </tr>
                  <tr className="sm">
                    <th>गुण</th>
                    <th>गुण</th>
                    <th>एकूण</th>
                  </tr>
                </thead>
                <tbody>
                  {cfg.subjects.map((s, i) => {
                    const a = r?.t1.subjects[s.id];
                    const c = r?.t2.subjects[s.id];
                    const t = y?.subjects[s.id];
                    return (
                      <tr key={s.id}>
                        <td>{i + 1}</td>
                        <td className="l">{s.name}</td>
                        <td>{a?.entered ? `${n(a.total)} / ${a.max}` : '-'}</td>
                        <td>{c?.entered ? `${n(c.total)} / ${c.max}` : '-'}</td>
                        <td className="b">{t?.entered ? `${n(t.total)} / ${t.max}` : '-'}</td>
                        <td>{dash(fmtPct(t?.pct))}</td>
                        <td className="b">{dash(t?.grade)}</td>
                      </tr>
                    );
                  })}
                  <tr className="total">
                    <td colSpan={2} className="l">
                      एकूण
                    </td>
                    <td>{r?.t1.entered ? `${n(r.t1.total)} / ${r.t1.max}` : '-'}</td>
                    <td>{r?.t2.entered ? `${n(r.t2.total)} / ${r.t2.max}` : '-'}</td>
                    <td>{y?.entered ? `${n(y.total)} / ${y.max}` : '-'}</td>
                    <td>{dash(fmtPct(y?.pct))}</td>
                    <td>{dash(y?.grade)}</td>
                  </tr>
                </tbody>
              </table>
              <table className="rt big" style={{ marginTop: '4mm' }}>
                <tbody>
                  <tr>
                    <th className="l" style={{ width: '38mm' }}>
                      निकाल
                    </th>
                    <td className="l b">{y ? y.resultLabel : ''}</td>
                    <th className="l" style={{ width: '30mm' }}>
                      उपस्थिती
                    </th>
                    <td className="l">{att.entered ? `${att.present} / ${att.working} दिवस` : '-'}</td>
                  </tr>
                  <tr>
                    <th className="l">शेरा</th>
                    <td className="l" colSpan={3}>
                      {b.remarkMap.get(`${st.id}|2|improve`)?.text || b.remarkMap.get(`${st.id}|2|special`)?.text || ''}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: '3mm', fontSize: '7.5pt', color: '#333' }}>
                श्रेणी: {grades.map((g, i) => `${g.label} = ${g.min}${i === 0 ? '–100' : `–${grades[i - 1].min - 1}`}%`).join(';  ')}
              </div>
              <div style={{ marginTop: 'auto' }}>
                <Signatures items={signs(ctx, true)} />
              </div>
            </div>
          </ReportPage>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* निकाल — एकूण गुण, टक्केवारी, श्रेणी व निकाल (एक कालावधी)           */
/* ------------------------------------------------------------------ */
export function ResultSummaryReport({ ctx, opts }: { ctx: ReportCtx; opts: ReportOpts }) {
  const { cfg, b } = ctx;
  const period: Period = opts.period;
  const sum = resultSummary(b.students, b.results, period);
  const first = b.students.map((s) => b.results.get(s.id)).find(Boolean);
  const maxOf = (sid: string) => (first ? pickPeriod(first, period).subjects[sid]?.max ?? 0 : 0);
  const grandMax = first ? pickPeriod(first, period).max : 0;
  const header = (
    <CceHeader
      title={`निकाल पत्रक — ${periodLabel(period)}`}
      org={ctx.school.orgLine}
      lines={[
        [udiseCell(ctx), '', yearCell(ctx)],
        [schoolCell(ctx), classCell(ctx)],
      ]}
    />
  );
  const rules = cfg.result;
  return (
    <PagedTable
      orientation="landscape"
      header={header}
      emptyColSpan={cfg.subjects.length + 7}
      thead={
        <>
          <tr>
            <th rowSpan={2} style={{ width: '9mm' }}>
              अ.क्र.
            </th>
            <th rowSpan={2}>विद्यार्थ्याचे नाव</th>
            <th rowSpan={2}>लिंग</th>
            {cfg.subjects.map((s) => (
              <th key={s.id}>{s.short}</th>
            ))}
            <th>एकूण</th>
            <th rowSpan={2}>टक्केवारी</th>
            <th rowSpan={2}>श्रेणी</th>
            <th rowSpan={2}>निकाल</th>
          </tr>
          <tr className="sm">
            {cfg.subjects.map((s) => (
              <th key={s.id}>{maxOf(s.id) || '-'}</th>
            ))}
            <th>{grandMax || '-'}</th>
          </tr>
        </>
      }
      rows={b.students.map((st, i) => {
        const r = b.results.get(st.id);
        const pr = r ? pickPeriod(r, period) : null;
        return (
          <tr key={st.id}>
            <td>{i + 1}</td>
            <td className="name">{st.fullName}</td>
            <td>{GENDER_LABEL[st.gender]}</td>
            {cfg.subjects.map((s) => (
              <td key={s.id}>{dash(n(pr?.subjects[s.id]?.total))}</td>
            ))}
            <td className="b">{dash(n(pr?.total))}</td>
            <td>{dash(fmtPct(pr?.pct))}</td>
            <td className="b">{dash(pr?.grade)}</td>
            <td className="b">{pr?.resultLabel ?? ''}</td>
          </tr>
        );
      })}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '10mm', marginTop: '4mm' }}>
          <table className="rt" style={{ width: 'auto', fontSize: '9pt' }}>
            <thead>
              <tr>
                <th style={{ minWidth: '50mm' }}>तपशील</th>
                <th style={{ minWidth: '16mm' }}>मुले</th>
                <th style={{ minWidth: '16mm' }}>मुली</th>
                <th style={{ minWidth: '16mm' }}>एकूण</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['एकूण विद्यार्थी (पट)', sum.total],
                  ['परीक्षेस उपस्थित', sum.appeared],
                  [`${rules.absentLabel}`, sum.absent],
                  [`${rules.passLabel}`, sum.pass],
                  [`${rules.failLabel}`, sum.fail],
                  ...(sum.incomplete.T ? [[`${rules.incompleteLabel} माहिती`, sum.incomplete] as const] : []),
                ] as const
              ).map(([label, c]) => (
                <tr key={label}>
                  <td className="l">{label}</td>
                  <td>{c.M}</td>
                  <td>{c.F}</td>
                  <td className="b">{c.T}</td>
                </tr>
              ))}
              <tr>
                <td className="l">निकालाची टक्केवारी</td>
                <td colSpan={3} className="b">
                  {sum.appeared.T ? `${fmtPct(round2((sum.pass.T / sum.appeared.T) * 100))}%` : '-'}
                </td>
              </tr>
            </tbody>
          </table>
          <Signatures items={signs(ctx)} style={{ marginTop: 0, flex: 1, justifyContent: 'space-around' }} />
        </div>
      }
    />
  );
}
