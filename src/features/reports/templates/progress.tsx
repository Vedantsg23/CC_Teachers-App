/**
 * प्रगती पत्रक — two pages per student:
 *  1. मुखपृष्ठ: school, इयत्ता, सन, the student's personal details and the
 *     monthly attendance table
 *  2. both सत्र: grade only for every subject, the three special remarks
 *     (विशेष नोंद, आवड / छंद, सुधारणा आवश्यक) and the parent / class teacher /
 *     headmaster signatures for each term
 */
import { fmtDate, monthLabel } from '../../../lib/format';
import { standardLabel, TERM_LABEL } from '../../../lib/labels';
import type { Student, Term } from '../../../lib/types';
import { ReportPage } from '../../../components/report/Report';
import { pickStudents, presentDays, yearMonthsOf, type ReportCtx, type ReportOpts } from '../common';

const TERMS: Term[] = [1, 2];

function Cover({ ctx, st }: { ctx: ReportCtx; st: Student }) {
  const { school, cls } = ctx;
  const months = yearMonthsOf(cls.year);
  const rows = months.map((m) => ({ m, ...presentDays(ctx, st.id, [m]) }));
  const total = presentDays(ctx, st.id, months);
  const place = [school.taluka && `ता. ${school.taluka}`, school.district && `जि. ${school.district}`].filter(Boolean).join(', ');
  const info: [string, string][] = [
    ['विद्यार्थ्याचे पूर्ण नाव', st.fullName],
    ['आईचे नाव', st.motherName],
    ['वडिलांचे / पालकाचे नाव', st.fatherName || st.guardianName],
    ['जन्मतारीख', fmtDate(st.dob)],
    ['हजेरी / परीक्षा क्रमांक', st.rollNo === null ? '' : String(st.rollNo)],
    ['जनरल रजिस्टर क्रमांक', st.regNo],
    ['विद्यार्थी आयडी (सरल)', st.saralId],
    ['पत्ता', st.address],
    ['संपर्क क्रमांक', st.mobile],
  ];
  return (
    <ReportPage>
      <div className="page-body pp">
        <div className="pp-school">
          {school.orgLine ? <div className="pp-org">{school.orgLine}</div> : null}
          <div className="pp-name">{school.name}</div>
          {place ? <div className="pp-place">{place}</div> : null}
          {school.udise ? <div className="pp-place">UDISE : {school.udise}</div> : null}
        </div>
        <div className="pp-title">प्रगती पत्रक</div>
        <div className="pp-sub">सातत्यपूर्ण सर्वंकष मूल्यमापन</div>
        <div className="pp-class">
          <span>
            इयत्ता : <b>{standardLabel(cls.standard)}</b>
          </span>
          <span>
            तुकडी : <b>{cls.section}</b>
          </span>
          <span>
            सन : <b>{cls.year}</b>
          </span>
        </div>

        <div className="pp-box">
          <div className="pp-box-title">विद्यार्थ्याची माहिती</div>
          <div className="pp-info">
            <table>
              <tbody>
                {info.map(([k, v]) => (
                  <tr key={k}>
                    <td className="k">{k}</td>
                    <td className="c">:</td>
                    <td className="v">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pp-photo">{st.photo ? <img src={st.photo} alt="" /> : null}</div>
          </div>
        </div>

        <div className="pp-att-title">मासिक उपस्थिती</div>
        <table className="rt pp-att">
          <thead>
            <tr>
              <th style={{ width: '14mm' }}>अ. क्र.</th>
              <th>महिना</th>
              <th style={{ width: '36mm' }}>कामाचे दिवस</th>
              <th style={{ width: '36mm' }}>उपस्थित दिवस</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.m}>
                <td>{i + 1}</td>
                <td className="l">{monthLabel(r.m)}</td>
                <td>{r.working || ''}</td>
                <td>{r.entered ? r.present : ''}</td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={2} className="l">
                एकूण
              </td>
              <td>{total.working || ''}</td>
              <td>{total.entered ? total.present : ''}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ReportPage>
  );
}

function Grades({ ctx, st }: { ctx: ReportCtx; st: Student }) {
  const { cfg, b, cls, school } = ctx;
  const r = b.results.get(st.id);
  const remark = (t: Term, area: string) => b.remarkMap.get(`${st.id}|${t}|${area}`)?.text ?? '';
  const special: [string, string][] = [
    ['special', 'विशेष नोंद'],
    ['hobby', 'आवड / छंद'],
    ['improve', 'सुधारणा आवश्यक'],
  ];
  const signRows: [string, string][] = [
    ['पालक स्वाक्षरी', ''],
    ['वर्गशिक्षक स्वाक्षरी', ctx.teacher],
    ['मुख्याध्यापक स्वाक्षरी', school.headmaster],
  ];
  const grades = [...cfg.grades].sort((a, z) => z.min - a.min);
  return (
    <ReportPage>
      <div className="page-body pp" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="pp-head2">
          <span>
            विद्यार्थ्याचे नाव : <b>{st.fullName}</b>
          </span>
          <span>
            इयत्ता : <b>{`${standardLabel(cls.standard)} ${cls.section}`}</b>
          </span>
          <span>
            सन : <b>{cls.year}</b>
          </span>
        </div>

        <div className="pp-sec">विषयनिहाय श्रेणी</div>
        <table className="rt pp-grades">
          <thead>
            <tr>
              <th style={{ width: '14mm' }}>अ. क्र.</th>
              <th>विषय</th>
              {TERMS.map((t) => (
                <th key={t} style={{ width: '42mm' }}>
                  {TERM_LABEL[t]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cfg.subjects.map((s, i) => (
              <tr key={s.id}>
                <td>{i + 1}</td>
                <td className="l">{s.name}</td>
                {TERMS.map((t) => (
                  <td key={t} className="b pp-g">
                    {r?.details[String(t) as '1' | '2'][s.id]?.grade ?? ''}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="total">
              <td colSpan={2} className="l">
                एकूण श्रेणी
              </td>
              {TERMS.map((t) => (
                <td key={t} className="pp-g">
                  {(t === 1 ? r?.t1 : r?.t2)?.grade ?? ''}
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <div className="pp-sec">विशेष नोंदी</div>
        <table className="rt pp-notes">
          <thead>
            <tr>
              <th style={{ width: '36mm' }}>विशेष नोंदी</th>
              {TERMS.map((t) => (
                <th key={t}>{TERM_LABEL[t]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {special.map(([key, label]) => (
              <tr key={key}>
                <td className="b">{label}</td>
                {TERMS.map((t) => (
                  <td key={t} className="l">
                    {remark(t, key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pp-sec">स्वाक्षरी</div>
        <table className="rt pp-sign">
          <thead>
            <tr>
              <th style={{ width: '50mm' }}>स्वाक्षरी</th>
              {TERMS.map((t) => (
                <th key={t}>{TERM_LABEL[t]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {signRows.map(([label, name]) => (
              <tr key={label}>
                <td className="l">
                  <b>{label}</b>
                  {name ? <div className="pp-who">{name}</div> : null}
                </td>
                {TERMS.map((t) => (
                  <td key={t} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pp-legend">
          श्रेणी : {grades.map((g, i) => `${g.label} = ${g.min}${i === 0 ? '–100' : `–${grades[i - 1].min - 1}`}%`).join(';  ')}
        </div>
      </div>
    </ReportPage>
  );
}

export function ProgressCardReport({ ctx, opts }: { ctx: ReportCtx; opts: ReportOpts }) {
  return (
    <>
      {pickStudents(ctx, opts).flatMap((st) => [<Cover key={`${st.id}c`} ctx={ctx} st={st} />, <Grades key={`${st.id}g`} ctx={ctx} st={st} />])}
    </>
  );
}
