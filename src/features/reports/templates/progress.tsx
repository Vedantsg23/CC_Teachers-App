/**
 * विद्यार्थी प्रगतीपत्रक — a folded A4 card (landscape, printed on both
 * sides, flip on the short edge, folded in the middle):
 *   outside: [विद्यार्थी उपस्थिती + श्रेणी तक्ता (back) | मुखपृष्ठ (front)]
 *   inside:  [प्रथम सत्र | द्वितीय सत्र]
 * The सत्र option fills one term only — the other term's card is printed
 * blank, as when the card is handed out after the first term — or both.
 */
import { ageOn, fmtDate, termOfMonth, todayIso } from '../../../lib/format';
import { MONTH_NAMES, standardNum, TERM_LABEL } from '../../../lib/labels';
import { schoolLogoSrc } from '../../../lib/logo';
import type { Student, Subject, Term } from '../../../lib/types';
import { ReportPage, VT } from '../../../components/report/Report';
import { fullYear, pickStudents, presentDays, type ReportCtx, type ReportOpts } from '../common';

/** June … May of the academic year (the printed card has all twelve months). */
function cardMonths(year: string): string[] {
  const y = Number(year.slice(0, 4));
  if (!y) return [];
  const out: string[] = [];
  for (let m = 6; m <= 12; m++) out.push(`${y}-${String(m).padStart(2, '0')}`);
  for (let m = 1; m <= 5; m++) out.push(`${y + 1}-${String(m).padStart(2, '0')}`);
  return out;
}

function gradeRanges(ctx: ReportCtx): { label: string; range: string[] }[] {
  const g = [...ctx.cfg.grades].sort((a, z) => z.min - a.min);
  return g.map((x, i) => {
    const hi = i === 0 ? 100 : g[i - 1].min - 1;
    if (x.min <= 0 && i > 0) return { label: x.label, range: [`${hi}% व`, 'त्यापेक्षा', 'कमी'] };
    return { label: x.label, range: [`${x.min}%`, 'ते', `${hi}%`] };
  });
}

/* ------------------------------------------------------------------ */
/* Outside — back cover: attendance, grade table                       */
/* ------------------------------------------------------------------ */
function BackCover({ ctx, st, terms }: { ctx: ReportCtx; st: Student; terms: Term[] }) {
  const months = cardMonths(ctx.cls.year);
  const show = (m: string) => terms.includes(termOfMonth(m));
  const cells = months.map((m) => {
    const a = presentDays(ctx, st.id, [m]);
    return show(m) ? a : { present: 0, working: 0, entered: false };
  });
  const ranges = gradeRanges(ctx);
  return (
    <div className="pc-panel pc-back">
      <div className="pc-att-title">विद्यार्थी उपस्थिती</div>
      <table className="rt pc-att">
        <thead>
          <tr>
            <th className="pc-att-k">महिना</th>
            {months.map((m) => (
              <th key={m} className="vt-cell">
                <VT>{MONTH_NAMES[Number(m.slice(5, 7)) - 1]}</VT>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pc-att-k">कामाचे दिवस</td>
            {cells.map((c, i) => (
              <td key={i}>{c.working || ''}</td>
            ))}
          </tr>
          <tr>
            <td className="pc-att-k">हजर दिवस</td>
            {cells.map((c, i) => (
              <td key={i}>{c.entered ? c.present : ''}</td>
            ))}
          </tr>
          {['शिक्षक स्वाक्षरी', 'पालक स्वाक्षरी', 'मुख्याध्यापक स्वाक्षरी'].map((l) => (
            <tr key={l} className="pc-att-sign">
              <td className="pc-att-k">{l}</td>
              {months.map((m) => (
                <td key={m} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pc-att-title pc-grade-title">श्रेणी तक्ता</div>
      <table className="rt pc-grades">
        <tbody>
          <tr>
            <td className="pc-att-k b">गुणांचे वर्गांतर</td>
            {ranges.map((g) => (
              <td key={g.label} className="pc-range">
                {g.range.map((p, i) => (
                  <div key={i}>{p}</div>
                ))}
              </td>
            ))}
          </tr>
          <tr>
            <td className="pc-att-k b">श्रेणी</td>
            {ranges.map((g) => (
              <td key={g.label} className="b">
                {g.label}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <div className="pc-reopen">
        उन्हाळी सुट्टीनंतर शाळा दिनांक <span className="pc-dots" /> रोजी सुरु होईल.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Outside — front cover                                               */
/* ------------------------------------------------------------------ */
function FrontCover({ ctx, st, terms }: { ctx: ReportCtx; st: Student; terms: Term[] }) {
  const { school, cls } = ctx;
  const logo = schoolLogoSrc(school);
  const place = [school.address, school.taluka && `तालुका ${school.taluka}`, school.district && `जिल्हा ${school.district}`].filter(Boolean).join(', ');
  const age = ageOn(st.dob, todayIso());
  const h = st.health;
  const w = (t: Term, k: 'weight' | 'height') => (terms.includes(t) ? (h?.[`${k}${t}`] ?? '') : '');
  const pairs: [string, string, string?, string?][] = [
    ['PEN ID', st.pen],
    ['विद्यार्थ्याचे नाव', st.fullName],
    ['हजेरी क्रमांक', st.rollNo === null ? '' : String(st.rollNo)],
    ['आधार क्र.', st.aadhaar ?? '', 'इयत्ता', standardNum(cls.standard)],
    ['जनरल रजि. क्र.', st.regNo, 'तुकडी', cls.section],
    ['वडिलांचे नाव', st.fatherName || st.guardianName, 'व्यवसाय', st.fatherOccupation ?? ''],
    ['आईचे नाव', st.motherName, 'व्यवसाय', st.motherOccupation ?? ''],
    ['मातृभाषा', st.motherTongue, 'माध्यम', school.medium || 'मराठी'],
    ['जन्मदिनांक', fmtDate(st.dob).replace(/-/g, '/'), 'वय', age !== null && st.dob ? `${age} वर्षे` : ''],
    ['पत्ता', st.address],
  ];
  return (
    <div className="pc-panel pc-front">
      <div className={`pc-front-top${logo ? ' with-logo' : ''}`}>
        {logo ? <img className="pc-logo" src={logo} alt="" /> : null}
        {school.orgLine ? <div className="pc-org">{school.orgLine}</div> : null}
        {school.udise ? <div className="pc-udise">Udise :- {school.udise}</div> : null}
      </div>
      <div className="pc-school">{school.name}</div>
      {place ? <div className="pc-place">{place}</div> : null}
      <div className="pc-badge">विद्यार्थी प्रगतीपत्रक</div>
      <div className="pc-year">सन :- {fullYear(cls.year)}</div>
      <table className="pc-info">
        <tbody>
          {pairs.map(([k, v, k2, v2]) => (
            <tr key={k}>
              <td className="pc-star">*</td>
              <td className="k">{k} :-</td>
              <td className="v" colSpan={k2 === undefined ? 3 : 1}>
                {v}
              </td>
              {k2 !== undefined ? (
                <>
                  <td className="k2">* {k2} :-</td>
                  <td className="v2">{v2}</td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <table className="pc-health">
        <tbody>
          <tr>
            <td className="pc-star">*</td>
            <td className="k">आरोग्यविषयक माहिती :-</td>
            <td className="h">{TERM_LABEL[1]}</td>
            <td className="h">{TERM_LABEL[2]}</td>
          </tr>
          <tr>
            <td />
            <td className="k sub">वजन (कि.ग्रॅ.)</td>
            <td className="v">{w(1, 'weight') ? `${w(1, 'weight')} कि.ग्रॅ.` : ''}</td>
            <td className="v">{w(2, 'weight') ? `${w(2, 'weight')} कि.ग्रॅ.` : ''}</td>
          </tr>
          <tr>
            <td />
            <td className="k sub">उंची (से.मी.)</td>
            <td className="v">{w(1, 'height') ? `${w(1, 'height')} से.मी.` : ''}</td>
            <td className="v">{w(2, 'height') ? `${w(2, 'height')} से.मी.` : ''}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inside — one term card                                              */
/* ------------------------------------------------------------------ */
const BLOCKS: { area: string; label: string }[] = [
  { area: 'special', label: 'विशेष प्रगती' },
  { area: 'hobby', label: 'आवड छंद' },
  { area: 'improve', label: 'सुधारणा आवश्यक' },
];

/** Split n rows into three consecutive groups (larger groups first), each ≥ 2 rows. */
export function splitThree(n: number): number[] {
  const base = Math.floor(n / 3);
  const rem = n % 3;
  return [0, 1, 2].map((i) => base + (i < rem ? 1 : 0));
}

function TermCard({ ctx, st, term, filled }: { ctx: ReportCtx; st: Student; term: Term; filled: boolean }) {
  const { cfg, b, cls, school } = ctx;
  const r = b.results.get(st.id);
  const rows: (Subject | null)[] = [...cfg.subjects];
  while (rows.length < 6) rows.push(null);
  const sizes = splitThree(rows.length);
  const starts = sizes.map((_, i) => sizes.slice(0, i).reduce((a, x) => a + x, 0));
  const remark = (area: string) => (filled ? (b.remarkMap.get(`${st.id}|${term}|${area}`)?.text ?? '') : '');
  const rowH = Math.max(8.5, Math.min(13, Math.floor((112 / rows.length) * 10) / 10));
  return (
    <div className="pc-panel pc-term">
      <div className="pc-cce">सातत्यपूर्ण सर्वंकष मूल्यमापन</div>
      <div className="pc-term-title">विद्यार्थी प्रगतीपत्रक - {TERM_LABEL[term]}</div>
      <table className="pc-meta">
        <tbody>
          <tr>
            <td className="k">विद्यार्थ्याचे नाव :-</td>
            <td className="v" colSpan={3}>
              {st.fullName}
            </td>
          </tr>
          <tr>
            <td className="k">परीक्षा क्र. :-</td>
            <td className="v">{st.rollNo ?? ''}</td>
            <td className="k">शै. वर्ष :-</td>
            <td className="v">{fullYear(cls.year)}</td>
          </tr>
          <tr>
            <td className="k">इयत्ता :-</td>
            <td className="v">{standardNum(cls.standard)}</td>
            <td className="k">तुकडी :-</td>
            <td className="v">{cls.section}</td>
          </tr>
        </tbody>
      </table>
      <table className="rt pc-table">
        <thead>
          <tr>
            <th style={{ width: '10mm' }}>अ क्र</th>
            <th style={{ width: '29mm' }}>विषय</th>
            <th style={{ width: '20mm' }}>
              {TERM_LABEL[term]}
              <br />
              श्रेणी
            </th>
            <th>वर्णनात्मक नोंदी</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const bi = starts.findIndex((st0, k) => i >= st0 && i < st0 + sizes[k]);
            const head = i === starts[bi];
            const textStart = i === starts[bi] + 1;
            return (
              <tr key={s?.id ?? `pad${i}`} style={{ height: `${rowH}mm` }}>
                <td>{s ? i + 1 : ''}</td>
                <td className="pc-subj">{s?.name ?? ''}</td>
                <td className="b pc-g">{s && filled ? (r?.details[String(term) as '1' | '2'][s.id]?.grade ?? '') : ''}</td>
                {head ? <td className="pc-rhead">{BLOCKS[bi].label}</td> : null}
                {textStart ? (
                  <td rowSpan={sizes[bi] - 1} className="pc-rtext">
                    {remark(BLOCKS[bi].area)}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="pc-signs">
        <div>
          <div className="lbl">वर्गशिक्षक</div>
          <div className="who">{ctx.teacher}</div>
        </div>
        <div>
          <div className="lbl">मुख्याध्यापक</div>
          <div className="who">{school.headmaster}</div>
        </div>
        <div>
          <div className="lbl">पालक</div>
          <div className="who">{st.fatherName || st.guardianName}</div>
        </div>
      </div>
    </div>
  );
}

export function ProgressCardReport({ ctx, opts }: { ctx: ReportCtx; opts: ReportOpts }) {
  const terms = opts.terms;
  return (
    <>
      {pickStudents(ctx, opts).flatMap((st) => [
        <ReportPage key={`${st.id}o`} orientation="landscape" className="pc">
          <div className="pc-sheet">
            <BackCover ctx={ctx} st={st} terms={terms} />
            <FrontCover ctx={ctx} st={st} terms={terms} />
          </div>
        </ReportPage>,
        <ReportPage key={`${st.id}i`} orientation="landscape" className="pc">
          <div className="pc-sheet">
            <TermCard ctx={ctx} st={st} term={1} filled={terms.includes(1)} />
            <TermCard ctx={ctx} st={st} term={2} filled={terms.includes(2)} />
          </div>
        </ReportPage>,
      ])}
    </>
  );
}
