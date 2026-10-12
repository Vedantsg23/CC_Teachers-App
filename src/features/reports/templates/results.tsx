/** Remarks, progress card, annual marksheet and result reports. */
import { gradeDistribution, groupResult, pickPeriod, resultSummary, round2, type StudentResults } from '../../../lib/calc';
import { fmtDate, fmtNum, fmtPct } from '../../../lib/format';
import { categoryLabel, GENDER_LABEL, periodLabel, SPECIAL_AREAS, standardLabel, TERM_LABEL } from '../../../lib/labels';
import type { Period, Student, Term } from '../../../lib/types';
import { CceHeader, PagedTable, ReportPage, Signatures } from '../../../components/report/Report';
import { classCell, dash, pickStudents, presentDays, schoolCell, signs, termMonths, termText, udiseCell, yearCell, yearMonthsOf, type ReportCtx, type ReportOpts } from '../common';

const n = (v: number | null | undefined) => (v === null || v === undefined ? '' : fmtNum(v));

/* ------------------------------------------------------------------ */
/* विषयवार वर्णनात्मक नोंदी                                               */
/* ------------------------------------------------------------------ */
export function RemarksReport({ ctx, opts }: { ctx: ReportCtx; opts: ReportOpts }) {
  const { cfg, b } = ctx;
  const term = opts.term;
  const areas = [...cfg.subjects.map((s) => ({ key: s.id, label: s.remarkLabel || s.name })), ...SPECIAL_AREAS.map((a) => ({ key: a.key, label: a.label }))];
  return (
    <>
      {pickStudents(ctx, opts).map((st) => (
        <ReportPage key={st.id}>
          <div className="page-body" style={{ display: 'flex', flexDirection: 'column' }}>
            <CceHeader
              lines={[
                [
                  <>
                    नाव: <b>{st.fullName}</b>
                  </>,
                  yearCell(ctx),
                ],
                [
                  classCell(ctx),
                  <>
                    रोल नं.: <b>{st.rollNo ?? ''}</b>
                  </>,
                  termText(term),
                ],
              ]}
            />
            <table className="rt big" style={{ fontSize: '10pt' }}>
              <thead>
                <tr>
                  <th style={{ width: '13mm' }}>अ.नं</th>
                  <th style={{ width: '52mm' }}>विषय</th>
                  <th>विषयवार वर्णनात्मक नोंद</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a, i) => (
                  <tr key={a.key}>
                    <td style={{ paddingTop: '2.4mm', paddingBottom: '2.4mm' }}>{i + 1}</td>
                    <td className="l">{a.label}</td>
                    <td className="l">{b.remarkMap.get(`${st.id}|${term}|${a.key}`)?.text ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 'auto' }}>
              <Signatures items={signs(ctx)} />
            </div>
          </div>
        </ReportPage>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* प्रगती कार्ड — प्रथम व द्वितीय सत्र शेजारी                               */
/* ------------------------------------------------------------------ */
function CardHalf({ ctx, st, term, r }: { ctx: ReportCtx; st: Student; term: Term; r: StudentResults | undefined }) {
  const { cfg, b, school, cls } = ctx;
  const tr = r ? pickPeriod(r, term) : null;
  const rm = (area: string) => b.remarkMap.get(`${st.id}|${term}|${area}`)?.text ?? '';
  const att = presentDays(ctx, st.id, termMonths(cls.year, term));
  return (
    <div className="pc-half">
      <div className="pc-term">प्रगती कार्ड — {TERM_LABEL[term]}</div>
      {cfg.report.showSchoolOnCards ? <div className="pc-school">{school.name}</div> : null}
      <div className="rpt-meta">
        <div>
          नाव : <b>{st.fullName}</b>
        </div>
        <div>सन : {cls.year}</div>
      </div>
      <div className="rpt-meta">
        <div>
          इयत्ता: {standardLabel(cls.standard)}, तुकडी: {cls.section}
        </div>
        <div>
          हजेरी क्रमांक : <b>{st.rollNo ?? ''}</b>
        </div>
        <div>
          UDISE: <b>{school.udise}</b>
        </div>
      </div>
      <table className="rt" style={{ marginTop: '1.5mm' }}>
        <thead>
          <tr>
            <th style={{ width: '7mm' }}>अ.नं.</th>
            <th style={{ width: '21mm' }}>विषय</th>
            <th style={{ width: '12mm' }}>गुण</th>
            <th style={{ width: '10mm' }}>श्रेणी</th>
            <th>वर्णनात्मक नोंद</th>
          </tr>
        </thead>
        <tbody>
          {cfg.subjects.map((s, i) => {
            const x = tr?.subjects[s.id];
            return (
              <tr key={s.id}>
                <td>{i + 1}</td>
                <td className="l">{s.short}</td>
                <td>{x?.entered ? `${n(x.total)}/${x.max}` : '-'}</td>
                <td className="b">{dash(x?.grade)}</td>
                <td className="l">{rm(s.id)}</td>
              </tr>
            );
          })}
          <tr className="total">
            <td colSpan={2} className="l">
              एकूण
            </td>
            <td>{tr?.entered ? `${n(tr.total)}/${tr.max}` : '-'}</td>
            <td>{dash(tr?.grade)}</td>
            <td className="l">{tr?.entered ? `टक्केवारी: ${fmtPct(tr.pct)}%` : ''}</td>
          </tr>
        </tbody>
      </table>
      <table className="rt" style={{ marginTop: '2mm' }}>
        <tbody>
          {SPECIAL_AREAS.map((a) => (
            <tr key={a.key}>
              <th className="l" style={{ width: '33mm', fontWeight: 700 }}>
                {a.short}
              </th>
              <td className="l">{rm(a.key)}</td>
            </tr>
          ))}
          <tr>
            <th className="l" style={{ fontWeight: 700 }}>
              उपस्थिती
            </th>
            <td className="l">{att.entered ? `${att.present} / ${att.working} दिवस` : ''}</td>
          </tr>
        </tbody>
      </table>
      <Signatures items={[{ label: 'शिक्षक स्वाक्षरी' }, { label: 'मुख्याध्यापक स्वाक्षरी' }, { label: 'पालक स्वाक्षरी' }]} />
    </div>
  );
}

export function ProgressCardReport({ ctx, opts }: { ctx: ReportCtx; opts: ReportOpts }) {
  return (
    <>
      {pickStudents(ctx, opts).map((st) => {
        const r = ctx.b.results.get(st.id);
        return (
          <ReportPage key={st.id} orientation="landscape">
            <div className="pc-halves">
              <CardHalf ctx={ctx} st={st} term={1} r={r} />
              <CardHalf ctx={ctx} st={st} term={2} r={r} />
            </div>
          </ReportPage>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* वार्षिक गुणपत्रक                                                      */
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
                    <th className="l">सरल आयडी</th>
                    <td className="l">{st.saralId}</td>
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
/* निकाल पत्रक                                                          */
/* ------------------------------------------------------------------ */
export function ResultSheetReport({ ctx, opts }: { ctx: ReportCtx; opts: ReportOpts }) {
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

/* ------------------------------------------------------------------ */
/* श्रेणीवार निकाल (मुले / मुली)                                          */
/* ------------------------------------------------------------------ */
export function GradeWiseReport({ ctx, opts }: { ctx: ReportCtx; opts: ReportOpts }) {
  const { cfg, b } = ctx;
  const period: Period = opts.period;
  const grades = [...cfg.grades].sort((a, z) => z.min - a.min).map((g) => g.label);
  const sum = resultSummary(b.students, b.results, period);
  const overall = gradeDistribution(cfg, b.students, b.results, period, null);
  const header = (
    <CceHeader
      title={`श्रेणीवार निकाल — ${periodLabel(period)}`}
      lines={[
        [udiseCell(ctx), '', yearCell(ctx)],
        [schoolCell(ctx), classCell(ctx)],
      ]}
    />
  );
  return (
    <PagedTable
      orientation="landscape"
      header={header}
      tableClassName="rt"
      thead={
        <>
          <tr>
            <th rowSpan={2} style={{ width: '9mm' }}>
              अ.नं
            </th>
            <th rowSpan={2}>विषय</th>
            {grades.map((g) => (
              <th key={g} colSpan={2}>
                {g}
              </th>
            ))}
            <th colSpan={2}>एकूण</th>
          </tr>
          <tr>
            {[...grades, 'T'].map((g) => [
              <th key={`${g}m`} className="sm">
                मुले
              </th>,
              <th key={`${g}f`} className="sm">
                मुली
              </th>,
            ])}
          </tr>
        </>
      }
      rows={cfg.subjects.map((s, i) => {
        const d = gradeDistribution(cfg, b.students, b.results, period, s.id);
        let m = 0;
        let f = 0;
        for (const g of grades) {
          m += d[g]?.M ?? 0;
          f += d[g]?.F ?? 0;
        }
        return (
          <tr key={s.id}>
            <td>{i + 1}</td>
            <td className="name">{s.short}</td>
            {grades.map((g) => [<td key={`${g}m`}>{d[g]?.M ?? 0}</td>, <td key={`${g}f`}>{d[g]?.F ?? 0}</td>])}
            <td className="b">{m}</td>
            <td className="b">{f}</td>
          </tr>
        );
      })}
      footer={
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8mm', marginTop: '4mm' }}>
          <table className="rt" style={{ width: 'auto', fontSize: '9pt' }}>
            <thead>
              <tr>
                <th style={{ minWidth: '28mm' }}>तपशील</th>
                <th style={{ minWidth: '14mm' }}>मुले</th>
                <th style={{ minWidth: '14mm' }}>मुली</th>
                <th style={{ minWidth: '14mm' }}>एकूण</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>पट</td>
                <td>{sum.total.M}</td>
                <td>{sum.total.F}</td>
                <td className="b">{sum.total.T}</td>
              </tr>
              <tr>
                <td>उपस्थिती</td>
                <td>{sum.appeared.M}</td>
                <td>{sum.appeared.F}</td>
                <td className="b">{sum.appeared.T}</td>
              </tr>
            </tbody>
          </table>
          <table className="rt" style={{ width: 'auto', fontSize: '8.5pt' }}>
            <thead>
              <tr>
                <th>एकूण श्रेणी</th>
                <th style={{ minWidth: '22mm' }}>विद्यार्थी संख्या</th>
                <th style={{ minWidth: '13mm' }}>मुलगे</th>
                <th style={{ minWidth: '13mm' }}>मुली</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => (
                <tr key={g}>
                  <td className="b">{g}</td>
                  <td>{overall[g]?.T ?? 0}</td>
                  <td>{overall[g]?.M ?? 0}</td>
                  <td>{overall[g]?.F ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ flex: 1, alignSelf: 'flex-end' }}>
            <Signatures items={signs(ctx)} style={{ marginTop: 0, justifyContent: 'space-around' }} />
          </div>
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* जातनिहाय / प्रवर्गनिहाय निकाल                                          */
/* ------------------------------------------------------------------ */
export function CategoryWiseReport({ ctx, opts }: { ctx: ReportCtx; opts: ReportOpts }) {
  const { b } = ctx;
  const period: Period = opts.period;
  const byCaste = opts.group === 'caste';
  const rows = groupResult(b.students, b.results, period, (s) => (byCaste ? s.caste.trim() : s.category)).sort((a, z) => z.total - a.total);
  const tot = rows.reduce(
    (a, r) => ({ boys: a.boys + r.boys, girls: a.girls + r.girls, total: a.total + r.total, appeared: a.appeared + r.appeared, pass: a.pass + r.pass }),
    { boys: 0, girls: 0, total: 0, appeared: 0, pass: 0 },
  );
  const title = `${byCaste ? 'जातनिहाय' : 'प्रवर्गनिहाय'} निकाल — ${periodLabel(period)}`;
  const header = <CceHeader title={title} org={ctx.school.orgLine} lines={[[udiseCell(ctx), '', yearCell(ctx)], [schoolCell(ctx), classCell(ctx)]]} />;
  return (
    <PagedTable
      header={header}
      tableClassName="rt big"
      emptyColSpan={8}
      thead={
        <tr>
          <th style={{ width: '11mm' }}>अ.नं</th>
          <th>{byCaste ? 'जात' : 'प्रवर्ग'}</th>
          <th>मुलगे</th>
          <th>मुली</th>
          <th>एकूण</th>
          <th>परीक्षेस बसलेले</th>
          <th>उत्तीर्ण</th>
          <th>टक्केवारी</th>
        </tr>
      }
      rows={[
        ...rows.map((r, i) => (
          <tr key={r.key}>
            <td>{i + 1}</td>
            <td className="l">{r.key === '—' ? 'नोंद नाही' : byCaste ? r.key : categoryLabel(r.key)}</td>
            <td>{r.boys}</td>
            <td>{r.girls}</td>
            <td className="b">{r.total}</td>
            <td>{r.appeared}</td>
            <td>{r.pass}</td>
            <td>{r.passPct === null ? '-' : `${fmtPct(r.passPct)}%`}</td>
          </tr>
        )),
        ...(rows.length
          ? [
              <tr key="total" className="total">
                <td colSpan={2} className="l">
                  एकूण
                </td>
                <td>{tot.boys}</td>
                <td>{tot.girls}</td>
                <td>{tot.total}</td>
                <td>{tot.appeared}</td>
                <td>{tot.pass}</td>
                <td>{tot.appeared ? `${fmtPct(round2((tot.pass / tot.appeared) * 100))}%` : '-'}</td>
              </tr>,
            ]
          : []),
      ]}
      footer={<Signatures items={signs(ctx)} />}
    />
  );
}

