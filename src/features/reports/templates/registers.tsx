/** Register-style reports (reference layouts: cover, index, subject-wise, student-wise, class registers). */
import type { ReactNode } from 'react';
import { assessmentId, pickPeriod, sumTools } from '../../../lib/calc';
import { fmtDate, fmtNum, fmtPct, monthLabel } from '../../../lib/format';
import { categoryShort, GENDER_LABEL, standardLabel } from '../../../lib/labels';
import type { Period, Subject, Term } from '../../../lib/types';
import { CceHeader, PagedTable, ReportPage, Signatures, VT } from '../../../components/report/Report';
import {
  classCell,
  dash,
  Emblem,
  GradeDistTable,
  periodMonths,
  presentDays,
  schoolCell,
  signs,
  termMonths,
  termText,
  udiseCell,
  yearCell,
  type ReportCtx,
  type ReportOpts,
} from '../common';
import { attendancePct } from '../../../lib/calc';

const n = (v: number | null | undefined) => (v === null || v === undefined ? '' : fmtNum(v));

/* ------------------------------------------------------------------ */
/* मुखपृष्ठ                                                             */
/* ------------------------------------------------------------------ */
export function CoverReport({ ctx }: { ctx: ReportCtx }) {
  const { school, cls } = ctx;
  return (
    <ReportPage className="cover">
      <Emblem />
      <div className="cover-org">{school.orgLine}</div>
      <div className="cover-year">सन : {cls.year}</div>
      <div className="cover-title">
        सातत्यपूर्ण सर्वंकष
        <br />
        मूल्यमापन
      </div>
      <div className="cover-rule" />
      <div className="cover-box">
        <table>
          <tbody>
            {(
              [
                ['युडायस', school.udise || '—'],
                ['शाळा', school.name],
                ['वर्गशिक्षक', ctx.teacher],
                ['इयत्ता', standardLabel(cls.standard)],
                ['तुकडी', cls.section],
              ] as [string, string][]
            ).map(([k, v]) => (
              <tr key={k}>
                <td className="k">{k}</td>
                <td className="c">:</td>
                <td className="v">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportPage>
  );
}

/* ------------------------------------------------------------------ */
/* अनुक्रमणिका                                                          */
/* ------------------------------------------------------------------ */
/** Only शाळेचे नाव, इयत्ता, शैक्षणिक वर्ष and अनुक्रमांक / नाव / परीक्षा क्रमांक. */
export function IndexReport({ ctx }: { ctx: ReportCtx }) {
  const header = (
    <CceHeader
      title="अनुक्रमणिका"
      lines={[
        [
          <>
            शाळेचे नाव : <b>{ctx.school.name}</b>
          </>,
        ],
        [
          <>
            इयत्ता : <b>{`${standardLabel(ctx.cls.standard)} ${ctx.cls.section}`.trim()}</b>
          </>,
          <>
            शैक्षणिक वर्ष : <b>{ctx.cls.year}</b>
          </>,
        ],
      ]}
    />
  );
  return (
    <PagedTable
      header={header}
      tableClassName="rt big tall"
      emptyColSpan={3}
      thead={
        <tr>
          <th style={{ width: '26mm' }}>अनुक्रमांक</th>
          <th>विद्यार्थ्याचे नाव</th>
          <th style={{ width: '36mm' }}>परीक्षा क्रमांक</th>
        </tr>
      }
      rows={ctx.b.students.map((s, i) => (
        <tr key={s.id}>
          <td>{i + 1}</td>
          <td className="l">{s.fullName}</td>
          <td>{s.rollNo ?? ''}</td>
        </tr>
      ))}
    />
  );
}

/* ------------------------------------------------------------------ */
/* विद्यार्थी यादी                                                       */
/* ------------------------------------------------------------------ */
export function StudentListReport({ ctx }: { ctx: ReportCtx }) {
  const st = ctx.b.students;
  const boys = st.filter((s) => s.gender === 'M').length;
  const header = <CceHeader title="विद्यार्थी यादी" org={ctx.school.orgLine} lines={[[udiseCell(ctx), '', yearCell(ctx)], [schoolCell(ctx), classCell(ctx)]]} />;
  return (
    <PagedTable
      orientation="landscape"
      header={header}
      emptyColSpan={12}
      thead={
        <tr>
          <th>अ.क्र.</th>
          <th>हजेरी क्र.</th>
          <th>विद्यार्थ्याचे नाव</th>
          <th>लिंग</th>
          <th>जन्मतारीख</th>
          <th>रजि. क्र.</th>
          <th>सरल आयडी</th>
          <th>आईचे नाव</th>
          <th>पालकाचे नाव</th>
          <th>जात</th>
          <th>प्रवर्ग</th>
          <th>मोबाईल</th>
        </tr>
      }
      rows={st.map((s, i) => (
        <tr key={s.id}>
          <td>{i + 1}</td>
          <td>{s.rollNo ?? ''}</td>
          <td className="name">{s.fullName}</td>
          <td>{GENDER_LABEL[s.gender]}</td>
          <td>{fmtDate(s.dob)}</td>
          <td>{s.regNo}</td>
          <td>{s.saralId}</td>
          <td className="l">{s.motherName}</td>
          <td className="l">{s.guardianName || s.fatherName}</td>
          <td>{s.caste}</td>
          <td>{s.category ? categoryShort(s.category) : ''}</td>
          <td>{s.mobile}</td>
        </tr>
      ))}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4mm' }}>
          <table className="rt" style={{ width: 'auto', fontSize: '9.5pt' }}>
            <thead>
              <tr>
                <th>मुले</th>
                <th>मुली</th>
                <th>एकूण</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ minWidth: '18mm' }}>{boys}</td>
                <td style={{ minWidth: '18mm' }}>{st.length - boys}</td>
                <td style={{ minWidth: '18mm' }} className="b">
                  {st.length}
                </td>
              </tr>
            </tbody>
          </table>
          <Signatures items={signs(ctx)} style={{ marginTop: 0, gap: '20mm' }} />
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* विषयवार CCE नोंद (आकारिक + संकलित)                                    */
/* ------------------------------------------------------------------ */
function SubjectSheet({ ctx, term, subject, orientation }: { ctx: ReportCtx; term: Term; subject: Subject; orientation: 'portrait' | 'landscape' }) {
  const { cfg, b } = ctx;
  const w = cfg.weights[String(term) as '1' | '2']?.[subject.id];
  const f = sumTools(cfg.fTools, w?.F, undefined);
  const s = sumTools(cfg.sParts, w?.S, undefined);
  const header = (
    <CceHeader
      lines={[
        [ctx.school.name, '', yearCell(ctx)],
        [classCell(ctx), <b key="s">{subject.name}</b>, termText(term)],
      ]}
    />
  );
  return (
    <PagedTable
      orientation={orientation}
      header={header}
      tableClassName={orientation === 'landscape' ? 'rt big' : 'rt'}
      emptyColSpan={cfg.fTools.length + cfg.sParts.length + 7}
      thead={
        <>
          <tr>
            <th rowSpan={3} style={{ width: '9mm' }}>
              अ. नं
            </th>
            <th rowSpan={3}>तपशील</th>
            <th colSpan={cfg.fTools.length + 1}>आकारिक (अ)</th>
            <th colSpan={cfg.sParts.length + 1}>संकलित (ब)</th>
            <th rowSpan={2} className="vt-cell">
              <VT>अ+ब</VT>
            </th>
            <th rowSpan={3} className="vt-cell">
              <VT>शे.गुण</VT>
            </th>
            <th rowSpan={3} className="vt-cell">
              <VT>श्रेणी</VT>
            </th>
          </tr>
          <tr>
            {cfg.fTools.map((t) => (
              <th key={t.key} className="vt-cell">
                <VT>{t.label}</VT>
              </th>
            ))}
            <th className="vt-cell">
              <VT>एकूण</VT>
            </th>
            {cfg.sParts.map((t) => (
              <th key={t.key} className="vt-cell">
                <VT>{t.label}</VT>
              </th>
            ))}
            <th className="vt-cell">
              <VT>एकूण</VT>
            </th>
          </tr>
          <tr className="sm">
            {cfg.fTools.map((t) => (
              <th key={t.key}>{dash(w?.F[t.key] || '')}</th>
            ))}
            <th>{dash(f.max || '')}</th>
            {cfg.sParts.map((t) => (
              <th key={t.key}>{dash(w?.S[t.key] || '')}</th>
            ))}
            <th>{dash(s.max || '')}</th>
            <th>{dash(f.max + s.max || '')}</th>
          </tr>
        </>
      }
      rows={b.students.map((st, i) => {
        const d = b.results.get(st.id)?.details[String(term) as '1' | '2'][subject.id];
        const fr = b.idx.get(assessmentId(st.id, subject.id, term, 'F'));
        const sr = b.idx.get(assessmentId(st.id, subject.id, term, 'S'));
        return (
          <tr key={st.id}>
            <td>{i + 1}</td>
            <td className="name">{st.fullName}</td>
            {cfg.fTools.map((t) => (
              <td key={t.key}>{w?.F[t.key] ? n(fr?.scores[t.key]) : ''}</td>
            ))}
            <td className="b">{n(d?.fObt)}</td>
            {cfg.sParts.map((t) => (
              <td key={t.key}>{w?.S[t.key] ? n(sr?.scores[t.key]) : ''}</td>
            ))}
            <td className="b">{n(d?.sObt)}</td>
            <td className="b">{n(d?.total)}</td>
            <td>{fmtPct(d?.pct)}</td>
            <td className="b">{d?.grade ?? ''}</td>
          </tr>
        );
      })}
      footer={<Signatures items={signs(ctx)} />}
    />
  );
}

export function SubjectWiseReport({ ctx, opts }: { ctx: ReportCtx; opts: ReportOpts }) {
  const subjects = opts.subject === 'all' ? ctx.cfg.subjects : ctx.cfg.subjects.filter((s) => s.id === opts.subject);
  return (
    <>
      {subjects.map((s) => (
        <SubjectSheet key={s.id} ctx={ctx} term={opts.term} subject={s} orientation={opts.orientation} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* वर्गनिहाय CCE नोंद — गुण / श्रेणी (with हजर दिवस)                       */
/* ------------------------------------------------------------------ */
export function ClassRegisterReport({ ctx, opts }: { ctx: ReportCtx; opts: ReportOpts }) {
  const { cfg, b, cls } = ctx;
  const term = opts.term;
  const months = termMonths(cls.year, term);
  const header = <CceHeader lines={[[udiseCell(ctx), termText(term), yearCell(ctx)], [schoolCell(ctx), classCell(ctx)]]} />;
  return (
    <PagedTable
      orientation="landscape"
      header={header}
      emptyColSpan={4 + cfg.subjects.length * 2}
      thead={
        <>
          <tr>
            <th rowSpan={2} style={{ width: '9mm' }}>
              अ.नं
            </th>
            <th rowSpan={2}>विद्यार्थ्याचे नाव</th>
            <th rowSpan={2}>लिंग</th>
            <th rowSpan={2} className="vt-cell">
              <VT>हजर दिवस</VT>
            </th>
            {cfg.subjects.map((s) => (
              <th key={s.id} colSpan={2}>
                {s.short}
              </th>
            ))}
          </tr>
          <tr>
            {cfg.subjects.map((s) => [
              <th key={`${s.id}g`} className="sm">
                गुण
              </th>,
              <th key={`${s.id}s`} className="sm">
                श्रेणी
              </th>,
            ])}
          </tr>
        </>
      }
      rows={b.students.map((st, i) => {
        const pr = b.results.get(st.id);
        const tr = pr ? pickPeriod(pr, term) : null;
        const att = presentDays(ctx, st.id, months);
        return (
          <tr key={st.id}>
            <td>{i + 1}</td>
            <td className="name">{st.fullName}</td>
            <td>{GENDER_LABEL[st.gender]}</td>
            <td>{att.entered ? att.present : ''}</td>
            {cfg.subjects.map((s) => {
              const x = tr?.subjects[s.id];
              return [
                <td key={`${s.id}g`}>{dash(n(x?.total))}</td>,
                <td key={`${s.id}s`} className="b">
                  {dash(x?.grade)}
                </td>,
              ];
            })}
          </tr>
        );
      })}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '8mm', marginTop: '3mm' }}>
          <GradeDistTable ctx={ctx} period={term} />
          <Signatures items={signs(ctx)} style={{ marginTop: 0, flex: 1, justifyContent: 'space-around' }} />
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* वर्गनिहाय CCE नोंद — आकारिक / संकलित / एकूण / श्रेणी                   */
/* ------------------------------------------------------------------ */
export function ClassABReport({ ctx, opts }: { ctx: ReportCtx; opts: ReportOpts }) {
  const { cfg, b } = ctx;
  const term = opts.term;
  const meta = cfg.subjects.map((s) => {
    const w = cfg.weights[String(term) as '1' | '2']?.[s.id];
    const f = sumTools(cfg.fTools, w?.F, undefined);
    const sm = sumTools(cfg.sParts, w?.S, undefined);
    return { s, fMax: f.max, sMax: sm.max, hasS: sm.used > 0 };
  });
  const header = <CceHeader lines={[[udiseCell(ctx), termText(term), yearCell(ctx)], [schoolCell(ctx), classCell(ctx)]]} />;
  return (
    <PagedTable
      orientation="landscape"
      header={header}
      tableClassName="rt"
      emptyColSpan={2 + meta.reduce((a, m) => a + (m.hasS ? 4 : 2), 0)}
      thead={
        <>
          <tr>
            <th rowSpan={3} style={{ width: '8mm' }}>
              अ.नं
            </th>
            <th rowSpan={3}>विद्यार्थ्याचे नाव</th>
            {meta.map((m) => (
              <th key={m.s.id} colSpan={m.hasS ? 4 : 2}>
                {m.s.short}
              </th>
            ))}
          </tr>
          <tr>
            {meta.map((m) =>
              m.hasS
                ? [
                    <th key={`${m.s.id}a`} className="vt-cell">
                      <VT>आकारिक (अ)</VT>
                    </th>,
                    <th key={`${m.s.id}b`} className="vt-cell">
                      <VT>संकलित (ब)</VT>
                    </th>,
                    <th key={`${m.s.id}t`} className="vt-cell">
                      <VT>एकूण (अ+ब)</VT>
                    </th>,
                    <th key={`${m.s.id}g`} rowSpan={2} className="vt-cell">
                      <VT>श्रेणी</VT>
                    </th>,
                  ]
                : [
                    <th key={`${m.s.id}a`} className="vt-cell">
                      <VT>आकारिक</VT>
                    </th>,
                    <th key={`${m.s.id}g`} rowSpan={2} className="vt-cell">
                      <VT>श्रेणी</VT>
                    </th>,
                  ],
            )}
          </tr>
          <tr className="sm">
            {meta.map((m) =>
              m.hasS
                ? [
                    <th key={`${m.s.id}a`}>{m.fMax}</th>,
                    <th key={`${m.s.id}b`}>{m.sMax}</th>,
                    <th key={`${m.s.id}t`}>{m.fMax + m.sMax}</th>,
                  ]
                : [<th key={`${m.s.id}a`}>{m.fMax}</th>],
            )}
          </tr>
        </>
      }
      rows={b.students.map((st, i) => {
        const r = b.results.get(st.id);
        const tr = r ? pickPeriod(r, term) : null;
        return (
          <tr key={st.id}>
            <td>{i + 1}</td>
            <td className="name">{st.fullName}</td>
            {meta.map((m) => {
              const x = tr?.subjects[m.s.id];
              return m.hasS
                ? [
                    <td key={`${m.s.id}a`}>{dash(n(x?.fObt))}</td>,
                    <td key={`${m.s.id}b`}>{dash(n(x?.sObt))}</td>,
                    <td key={`${m.s.id}t`}>{dash(n(x?.total))}</td>,
                    <td key={`${m.s.id}g`} className="b">
                      {dash(x?.grade)}
                    </td>,
                  ]
                : [
                    <td key={`${m.s.id}a`}>{dash(n(x?.fObt))}</td>,
                    <td key={`${m.s.id}g`} className="b">
                      {dash(x?.grade)}
                    </td>,
                  ];
            })}
          </tr>
        );
      })}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '8mm', marginTop: '3mm' }}>
          <GradeDistTable ctx={ctx} period={term} />
          <Signatures items={signs(ctx)} style={{ marginTop: 0, flex: 1, justifyContent: 'space-around' }} />
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* आकारिक / संकलित मूल्यमापन — वर्गाचा सारांश                             */
/* ------------------------------------------------------------------ */
export function TypeSummaryReport({ ctx, opts, type }: { ctx: ReportCtx; opts: ReportOpts; type: 'F' | 'S' }) {
  const { cfg, b } = ctx;
  const term = opts.term;
  const subjects = cfg.subjects
    .map((s) => {
      const w = cfg.weights[String(term) as '1' | '2']?.[s.id];
      const sum = type === 'F' ? sumTools(cfg.fTools, w?.F, undefined) : sumTools(cfg.sParts, w?.S, undefined);
      return { s, max: sum.max, used: sum.used > 0 };
    })
    .filter((x) => x.used);
  const maxTotal = subjects.reduce((a, x) => a + x.max, 0);
  const title = type === 'F' ? 'आकारिक मूल्यमापन (अ)' : 'संकलित मूल्यमापन (ब)';
  const header = (
    <CceHeader
      lines={[
        [udiseCell(ctx), <b key="t">{title}</b>, yearCell(ctx)],
        [schoolCell(ctx), termText(term), classCell(ctx)],
      ]}
    />
  );
  return (
    <PagedTable
      orientation="landscape"
      header={header}
      tableClassName="rt big"
      emptyColSpan={subjects.length + 4}
      thead={
        <>
          <tr>
            <th rowSpan={2} style={{ width: '10mm' }}>
              अ.नं
            </th>
            <th rowSpan={2}>विद्यार्थ्याचे नाव</th>
            {subjects.map((x) => (
              <th key={x.s.id}>{x.s.short}</th>
            ))}
            <th>एकूण</th>
            <th rowSpan={2}>टक्केवारी</th>
          </tr>
          <tr className="sm">
            {subjects.map((x) => (
              <th key={x.s.id}>{x.max}</th>
            ))}
            <th>{maxTotal}</th>
          </tr>
        </>
      }
      rows={b.students.map((st, i) => {
        const r = b.results.get(st.id);
        const det = r?.details[String(term) as '1' | '2'];
        let tot = 0;
        let any = false;
        const cells: ReactNode[] = subjects.map((x) => {
          const v = type === 'F' ? det?.[x.s.id]?.fObt : det?.[x.s.id]?.sObt;
          if (v !== null && v !== undefined) {
            tot += v;
            any = true;
          }
          return <td key={x.s.id}>{dash(n(v))}</td>;
        });
        return (
          <tr key={st.id}>
            <td>{i + 1}</td>
            <td className="name">{st.fullName}</td>
            {cells}
            <td className="b">{any ? fmtNum(tot) : '-'}</td>
            <td>{any && maxTotal ? fmtPct((tot / maxTotal) * 100) : '-'}</td>
          </tr>
        );
      })}
      footer={<Signatures items={signs(ctx)} />}
    />
  );
}

/* ------------------------------------------------------------------ */
/* उपस्थिती                                                             */
/* ------------------------------------------------------------------ */
export function AttendanceReport({ ctx, opts }: { ctx: ReportCtx; opts: ReportOpts }) {
  const { b, cls } = ctx;
  const period: Period = opts.period;
  const months = periodMonths(cls.year, period);
  const wd = months.map((m) => b.workingByMonth.get(m) ?? null);
  const totalWorking = wd.reduce<number>((a, v) => a + (v ?? 0), 0);
  const header = (
    <CceHeader
      title="मासिक उपस्थिती"
      org={ctx.school.orgLine}
      lines={[
        [udiseCell(ctx), period === 'annual' ? 'वार्षिक' : termText(period), yearCell(ctx)],
        [schoolCell(ctx), classCell(ctx)],
      ]}
    />
  );
  return (
    <PagedTable
      orientation="landscape"
      header={header}
      emptyColSpan={months.length + 5}
      thead={
        <>
          <tr>
            <th style={{ width: '9mm' }}>अ.नं</th>
            <th>विद्यार्थ्याचे नाव</th>
            {months.map((m) => (
              <th key={m}>{monthLabel(m, true)}</th>
            ))}
            <th>एकूण हजर</th>
            <th>गैरहजर</th>
            <th>उपस्थिती %</th>
          </tr>
          <tr className="sm">
            <th colSpan={2} className="l">
              कामाचे दिवस
            </th>
            {wd.map((v, i) => (
              <th key={months[i]}>{dash(v)}</th>
            ))}
            <th>{totalWorking || '-'}</th>
            <th />
            <th />
          </tr>
        </>
      }
      rows={b.students.map((st, i) => {
        const t = presentDays(ctx, st.id, months);
        return (
          <tr key={st.id}>
            <td>{i + 1}</td>
            <td className="name">{st.fullName}</td>
            {months.map((m) => {
              const v = b.attById.get(`${st.id}|${m}`)?.present;
              return <td key={m}>{v ?? ''}</td>;
            })}
            <td className="b">{t.entered ? t.present : ''}</td>
            <td>{t.entered ? t.working - t.present : ''}</td>
            <td>{fmtPct(attendancePct(t.entered ? t.present : null, t.working))}</td>
          </tr>
        );
      })}
      footer={<Signatures items={signs(ctx)} />}
    />
  );
}
