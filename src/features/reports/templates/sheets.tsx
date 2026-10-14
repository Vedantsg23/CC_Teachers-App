/**
 * Per-student sheets with both सत्र on one page:
 *  - सातत्यपूर्ण सर्वंकष मूल्यमापन नोंदपत्र (प्रथम सत्र table above द्वितीय सत्र)
 *  - आकारिक मूल्यमापन वर्णनात्मक नोंद वही (प्रथम | द्वितीय सत्र side by side)
 */
import type { ReactNode } from 'react';
import { assessmentId } from '../../../lib/calc';
import { fmtNum } from '../../../lib/format';
import { SPECIAL_AREAS, standardNum, TERM_LABEL } from '../../../lib/labels';
import type { Student, Subject, Term, ToolMax } from '../../../lib/types';
import { ReportPage, Signatures, VT } from '../../../components/report/Report';
import { officialSigns, pickStudents, type ReportCtx, type ReportOpts } from '../common';

const n = (v: number | null | undefined) => (v === null || v === undefined ? '' : fmtNum(v));
const pct2 = (v: number | null | undefined) => (v === null || v === undefined ? '' : v.toFixed(2));
const sumMax = (m: ToolMax | undefined) => Object.values(m ?? {}).reduce<number>((a, v) => a + (v ?? 0), 0);

/** Bordered header: title, student details and a photo box (as in the printed registers). */
function SheetHead({ ctx, st, title }: { ctx: ReportCtx; st: Student; title: string }) {
  const { school, cls } = ctx;
  return (
    <table className="sh-head">
      <tbody>
        <tr>
          <td colSpan={3} className="sh-title">
            {title}
          </td>
          <td rowSpan={3} className="sh-photo">
            {st.photo ? <img src={st.photo} alt="" /> : null}
          </td>
        </tr>
        <tr>
          <td className="sh-wide">
            विद्यार्थ्याचे नाव : <b>{st.fullName}</b>
          </td>
          <td>
            परीक्षा क्र. : <b>{st.rollNo ?? ''}</b>
          </td>
          <td>
            जन. रजि. क्र. : <b>{st.regNo}</b>
          </td>
        </tr>
        <tr>
          <td className="sh-wide">
            शाळेचे नाव : <b>{school.name}</b>
          </td>
          <td>
            इयत्ता : <b>{standardNum(cls.standard)}</b>
          </td>
          <td>
            तुकडी : <b>{cls.section}</b>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function TermSheet({ ctx, st, term }: { ctx: ReportCtx; st: Student; term: Term }) {
  const { cfg, b } = ctx;
  const nF = cfg.fTools.length;
  const nS = cfg.sParts.length;
  const key = String(term) as '1' | '2';
  const r = b.results.get(st.id);
  const pr = r ? (term === 1 ? r.t1 : r.t2) : null;
  const hasS = (s: Subject) => sumMax(cfg.weights[key]?.[s.id]?.S) > 0;
  // co-scholastic subjects (no संकलित) — the term summary sits in their संकलित cells when they are consecutive
  const co = cfg.subjects.map((s, i) => (hasS(s) ? -1 : i)).filter((i) => i >= 0);
  const coBlock = co.length > 0 && co[co.length - 1] - co[0] === co.length - 1;
  const summary = (
    <div className="np-sum">
      <div>
        प्राप्त गुण = <b>{n(pr?.total)}</b>
      </div>
      <div>
        एकूण गुण = <b>{pr?.max || ''}</b>
      </div>
      <div>
        प्राप्त % गुण = <b>{pct2(pr?.pct)}</b>
      </div>
      <div>
        एकूण % गुण = <b>100</b>
      </div>
      <div>
        प्राप्त श्रेणी = <b className="np-grade">{pr?.grade ?? ''}</b>
      </div>
    </div>
  );

  return (
    <>
      <table className="rt np">
        <thead>
          <tr>
            <th colSpan={3} className="np-term">
              {TERM_LABEL[term]}
            </th>
            <th colSpan={nF + 1}>(अ) आकारिक मूल्यमापन</th>
            <th colSpan={nS + 1}>(ब) संकलित मूल्यमापन</th>
            <th rowSpan={2} className="vt-cell">
              <VT>एकूण</VT>
            </th>
            <th rowSpan={2} className="vt-cell">
              <VT>एकूण शेकडा</VT>
            </th>
            <th rowSpan={3} className="vt-cell">
              <VT>श्रेणी</VT>
            </th>
          </tr>
          <tr>
            <th rowSpan={2} style={{ width: '5mm' }}>
              अ. क्र.
            </th>
            <th rowSpan={2} style={{ width: '24mm' }}>
              विषय
            </th>
            <th rowSpan={2} style={{ width: '12mm' }}>
              तपशील
            </th>
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
          <tr className="np-num">
            {cfg.fTools.map((t, i) => (
              <th key={t.key}>{i + 1}</th>
            ))}
            <th>अ</th>
            {cfg.sParts.map((t, i) => (
              <th key={t.key}>{i + 1}</th>
            ))}
            <th>ब</th>
            <th>अ + ब</th>
            <th>100</th>
          </tr>
        </thead>
        <tbody>
          {cfg.subjects.flatMap((subj, si) => {
            const w = cfg.weights[key]?.[subj.id];
            const d = r?.details[key][subj.id];
            const fr = b.idx.get(assessmentId(st.id, subj.id, term, 'F'));
            const sr = b.idx.get(assessmentId(st.id, subj.id, term, 'S'));
            const withS = hasS(subj);
            const entered = !!d?.entered;
            const sCells = (row: 'obt' | 'max'): ReactNode => {
              if (withS) {
                return (
                  <>
                    {cfg.sParts.map((t) => (
                      <td key={t.key}>{w?.S[t.key] ? (row === 'obt' ? (entered ? n(sr?.scores[t.key]) || '-' : '') : w.S[t.key]) : row === 'obt' ? '-' : ''}</td>
                    ))}
                    <td className={row === 'obt' ? 'b' : ''}>{row === 'obt' ? n(d?.sObt) : d?.sMax || ''}</td>
                  </>
                );
              }
              if (row === 'max') return null;
              if (coBlock) {
                return si === co[0] ? (
                  <td colSpan={nS + 1} rowSpan={co.length * 2} className="np-sumcell">
                    {summary}
                  </td>
                ) : null;
              }
              return <td colSpan={nS + 1} rowSpan={2} />;
            };
            return [
              <tr key={`${subj.id}-o`}>
                <td rowSpan={2}>{si + 1}</td>
                <td rowSpan={2} className="np-subj">
                  {subj.name}
                </td>
                <td className="np-k">प्राप्त गुण</td>
                {cfg.fTools.map((t) => (
                  <td key={t.key}>{w?.F[t.key] ? (entered ? n(fr?.scores[t.key]) || '-' : '') : '-'}</td>
                ))}
                <td className="b">{n(d?.fObt)}</td>
                {sCells('obt')}
                <td className="b">{n(d?.total)}</td>
                <td>{pct2(d?.pct)}</td>
                <td rowSpan={2} className="b np-grade">
                  {d?.grade ?? ''}
                </td>
              </tr>,
              <tr key={`${subj.id}-m`} className="np-max">
                <td className="np-k">गुण पैकी</td>
                {cfg.fTools.map((t) => (
                  <td key={t.key}>{w?.F[t.key] || ''}</td>
                ))}
                <td>{d?.fMax || ''}</td>
                {sCells('max')}
                <td>{d?.max || ''}</td>
                <td>{d?.max ? 100 : ''}</td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
      {coBlock ? null : <div className="np-sum-line">{summary}</div>}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* सातत्यपूर्ण सर्वंकष मूल्यमापन नोंदपत्र — दोन्ही सत्रे एका पानावर       */
/* ------------------------------------------------------------------ */
export function StudentSheetReport({ ctx, opts }: { ctx: ReportCtx; opts: ReportOpts }) {
  const title = `सातत्यपूर्ण सर्वंकष मूल्यमापन नोंदपत्र इ. ${standardNum(ctx.cls.standard)}`;
  return (
    <>
      {pickStudents(ctx, opts).map((st) => (
        <ReportPage key={st.id} className="np-page">
          <div className="page-body">
            <SheetHead ctx={ctx} st={st} title={title} />
            <TermSheet ctx={ctx} st={st} term={1} />
            <Signatures items={officialSigns(ctx, 3)} className="official np-sign" />
            <TermSheet ctx={ctx} st={st} term={2} />
            <Signatures items={officialSigns(ctx, 3)} className="official np-sign" />
          </div>
        </ReportPage>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* आकारिक मूल्यमापन वर्णनात्मक नोंद वही — प्रथम | द्वितीय सत्र           */
/* ------------------------------------------------------------------ */
export function RemarksBookReport({ ctx, opts }: { ctx: ReportCtx; opts: ReportOpts }) {
  const { cfg, b } = ctx;
  const title = `आकारिक मूल्यमापन वर्णनात्मक नोंद वही इ. ${standardNum(ctx.cls.standard)}`;
  return (
    <>
      {pickStudents(ctx, opts).map((st) => {
        const text = (term: Term, area: string) => b.remarkMap.get(`${st.id}|${term}|${area}`)?.text ?? '';
        const areas = [
          ...cfg.subjects.map((s) => ({ key: s.id, label: s.name })),
          // व्यक्तिमत्व गुण विशेष is printed only when written for this student
          ...SPECIAL_AREAS.filter((a) => a.key !== 'personality' || text(1, a.key) || text(2, a.key)).map((a) => ({
            key: a.key,
            label: a.key === 'hobby' ? 'आवड / छंद' : a.short,
          })),
        ];
        const rowH = Math.max(11, Math.min(19, Math.floor((214 / areas.length) * 10) / 10));
        return (
          <ReportPage key={st.id}>
            <div className="page-body" style={{ display: 'flex', flexDirection: 'column' }}>
              <SheetHead ctx={ctx} st={st} title={title} />
              <table className="rt rb">
                <thead>
                  <tr>
                    <th style={{ width: '9mm' }}>अ. क्र.</th>
                    <th style={{ width: '27mm' }}>विषय</th>
                    <th>{TERM_LABEL[1]}</th>
                    <th>{TERM_LABEL[2]}</th>
                  </tr>
                </thead>
                <tbody>
                  {areas.map((a, i) => (
                    <tr key={a.key} style={{ height: `${rowH}mm` }}>
                      <td className="b">{i + 1}</td>
                      <td className="b rb-area">{a.label}</td>
                      <td className="l rb-text">{text(1, a.key)}</td>
                      <td className="l rb-text">{text(2, a.key)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 'auto' }}>
                <Signatures items={officialSigns(ctx, 3)} className="official" />
              </div>
            </div>
          </ReportPage>
        );
      })}
    </>
  );
}
