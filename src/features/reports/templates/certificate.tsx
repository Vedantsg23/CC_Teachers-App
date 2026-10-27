/**
 * शाळा सोडल्याचा दाखला.
 *  - 'zp' (default): the printed जिल्हा परिषद form — "शाळा सोडल्याचे
 *    प्रमाणपत्र" with boxed UDISE / PEN / आधार / अपार numbers and dates,
 *    filled from the student's record.
 *  - 'list': the older configurable list (सेटिंग्ज → दाखला नमुना).
 * Neither prints a दाखला क्रमांक or the headmaster's name (signature only).
 */
import { fmtDate } from '../../../lib/format';
import { MONTH_NAMES } from '../../../lib/labels';
import { schoolLogoSrc } from '../../../lib/logo';
import type { LcTemplate, School } from '../../../lib/types';
import { ReportPage, Signatures } from '../../../components/report/Report';

const DATE_KEYS = new Set(['dob', 'admissionDate', 'leftDate', 'lastAttended']);

export const ZP_CERT_TEXT = 'दाखला देण्यात येतो की, वरील माहिती शाळेतील जनरल रजिस्टर नं. १ प्रमाणे आहे.';

/** Editable fields of the जिल्हा परिषद form, in printed order. */
export const ZP_FIELDS: { key: string; label: string }[] = [
  { key: 'regNo', label: 'जनरल रजिस्टर क्रमांक' },
  { key: 'pen', label: 'पेन नंबर' },
  { key: 'email', label: 'ई-मेल' },
  { key: 'aadhaar', label: 'यु आय डी नं. (आधार कार्ड क्रमांक)' },
  { key: 'apaar', label: 'अपार आय.डी. नं.' },
  { key: 'firstName', label: 'विद्यार्थ्याचे नाव' },
  { key: 'fatherFirst', label: 'वडिलांचे नाव' },
  { key: 'surname', label: 'आडनाव' },
  { key: 'motherName', label: 'आईचे नाव' },
  { key: 'nationality', label: 'राष्ट्रीयत्व' },
  { key: 'motherTongue', label: 'मातृभाषा' },
  { key: 'religion', label: 'धर्म' },
  { key: 'caste', label: 'जात' },
  { key: 'subCaste', label: 'पोटजात' },
  { key: 'birthPlace', label: 'जन्मस्थळ (गाव / शहर)' },
  { key: 'birthTaluka', label: 'तालुका' },
  { key: 'birthDistrict', label: 'जिल्हा' },
  { key: 'birthState', label: 'राज्य' },
  { key: 'birthCountry', label: 'देश' },
  { key: 'dob', label: 'इ. सनाप्रमाणे जन्म दिनांक' },
  { key: 'dobWords', label: 'जन्म दिनांक अक्षरी' },
  { key: 'previousSchool', label: 'या पूर्वीची शाळा व इयत्ता' },
  { key: 'admissionDate', label: 'या शाळेत प्रवेश घेतल्याचा दिनांक' },
  { key: 'admissionStd', label: 'प्रवेशाची इयत्ता' },
  { key: 'progress', label: 'अभ्यासातील प्रगती' },
  { key: 'conduct', label: 'वर्तणूक' },
  { key: 'leftDate', label: 'शाळा सोडल्याचा दिनांक' },
  { key: 'lastStd', label: 'कोणत्या इयत्तेत शिकत होता/होती व केव्हापासून (अक्षरी व अंकी)' },
  { key: 'reason', label: 'शाळा सोडण्याचे कारण' },
  { key: 'remark', label: 'शेरा' },
];

/** "नाव वडिलांचे नाव आडनाव" → its three parts. */
export function splitName(full: string): { first: string; father: string; surname: string } {
  const p = full.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return { first: '', father: '', surname: '' };
  if (p.length === 1) return { first: p[0], father: '', surname: '' };
  if (p.length === 2) return { first: p[0], father: '', surname: p[1] };
  return { first: p[0], father: p.slice(1, -1).join(' '), surname: p[p.length - 1] };
}

export function LeavingCertificatePage({ school, tpl, data }: { school: School; tpl: LcTemplate; data: Record<string, string> }) {
  return tpl.layout === 'list' ? <ListCertificate school={school} tpl={tpl} data={data} /> : <ZpCertificate school={school} tpl={tpl} data={data} />;
}

/* ------------------------------------------------------------------ */
/* जिल्हा परिषद form                                                    */
/* ------------------------------------------------------------------ */
function Boxes({ value, count, wide }: { value: string; count: number; wide?: boolean }) {
  const chars = [...(value ?? '').replace(/\s/g, '')];
  const n = Math.max(count, chars.length);
  return (
    <span className={`lcz-boxes${wide ? ' wide' : ''}`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="bx">
          {chars[i] ?? ''}
        </span>
      ))}
    </span>
  );
}

function DateBoxes({ iso }: { iso: string }) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return (
    <span className="lcz-date">
      <Boxes value={m ? m[3] : ''} count={2} />
      <Boxes value={m ? m[2] : ''} count={2} />
      <Boxes value={m ? m[1] : ''} count={4} />
    </span>
  );
}

/** Label followed by the value written on a dotted line. */
function F({ k, v, w, fixed }: { k?: string; v?: string; w?: string; fixed?: boolean }) {
  return (
    <span className={`lcz-f${fixed ? ' fixed' : ''}`} style={w ? { flex: `0 0 ${w}` } : undefined}>
      {k ? <span className="lcz-k">{k}</span> : null}
      <span className="lcz-v">{v ?? ''}</span>
    </span>
  );
}

const ZP_SCHOOL = 'जिल्हा परिषद प्राथमिक शाळा';

export function ZpCertificate({ school, tpl, data }: { school: School; tpl: LcTemplate; data: Record<string, string> }) {
  const d = (k: string) => data[k] ?? '';
  const logo = schoolLogoSrc(school);
  const name = school.name.trim();
  const zpName = name.startsWith(ZP_SCHOOL);
  const issue = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.issueDate || '');
  return (
    <ReportPage className="lcz">
      <div className="page-body lcz-body">
        <div className={`lcz-top${logo ? ' with-logo' : ''}`}>
          {logo ? <img className="lcz-logo" src={logo} alt="" /> : null}
          <div className="lcz-dept">
            शिक्षण खाते, जिल्हा परिषद <span className="lcz-fill">{school.district}</span> (प्राथमिक शिक्षण विभाग)
          </div>
          <div className="lcz-title">शाळा सोडल्याचे प्रमाणपत्र</div>
        </div>

        <div className="lcz-row">
          <F k={zpName ? ZP_SCHOOL : 'शाळा'} v={zpName ? name.slice(ZP_SCHOOL.length).trim() : name} />
          <F k="केंद्र" v={school.centre} w="36mm" />
          <F k="तालुका" v={school.taluka} w="32mm" />
          <F k="जिल्हा" v={school.district} w="30mm" />
        </div>

        <div className="lcz-ids">
          <div className="lcz-idrow">
            <span className="lcz-k">यु डायस क्र.</span>
            <Boxes value={school.udise} count={11} />
            <span className="lcz-k lcz-gr">जनरल रजिस्टर क्रमांक :</span>
            <span className="lcz-grbox">{d('regNo')}</span>
          </div>
          <div className="lcz-idrow">
            <span className="lcz-k">पेन नंबर</span>
            <Boxes value={d('pen')} count={11} />
            <F k="ई-मेल :" v={d('email')} />
          </div>
          <div className="lcz-idrow">
            <span className="lcz-k">यु आय डी नं. (आधार कार्ड क्रमांक)</span>
            <Boxes value={d('aadhaar')} count={12} />
          </div>
          <div className="lcz-idrow">
            <span className="lcz-k">अपार आय.डी. नं.</span>
            <Boxes value={d('apaar')} count={12} />
          </div>
        </div>

        <div className="lcz-rule" />

        <div className="lcz-row">
          <span className="lcz-k">विद्यार्थ्याचे संपूर्ण नांव -</span>
          <F k="(नाव)" v={d('firstName')} />
          <F k="(वडिलांचे नांव)" v={d('fatherFirst')} />
        </div>
        <div className="lcz-row lcz-indent">
          <F k="(आडनांव)" v={d('surname')} w="95mm" />
        </div>
        <div className="lcz-row">
          <F k="आईचे नांव" v={d('motherName')} />
        </div>
        <div className="lcz-row">
          <F k="राष्ट्रीयत्व" v={d('nationality')} />
          <F k="मातृभाषा" v={d('motherTongue')} />
        </div>
        <div className="lcz-row">
          <F k="धर्म" v={d('religion')} />
          <F k="जात" v={d('caste')} />
          <F k="पोटजात" v={d('subCaste')} />
        </div>
        <div className="lcz-row">
          <F k="जन्मस्थळ (गांव/शहर)" v={d('birthPlace')} />
        </div>
        <div className="lcz-row">
          <F k="तालुका" v={d('birthTaluka')} />
          <F k="जिल्हा" v={d('birthDistrict')} />
          <F k="राज्य" v={d('birthState')} />
          <F k="देश" v={d('birthCountry')} />
        </div>
        <div className="lcz-row">
          <span className="lcz-k">इ. सनाप्रमाणे जन्म दिनांक</span>
          <DateBoxes iso={d('dob')} />
        </div>
        <div className="lcz-row">
          <F k="जन्म दिनांक अक्षरी" v={d('dobWords')} />
        </div>
        <div className="lcz-row">
          <F k="या पूर्वीची शाळा व इयत्ता" v={d('previousSchool')} />
        </div>
        <div className="lcz-row">
          <span className="lcz-k">या शाळेत प्रवेश घेतल्याचा दिनांक</span>
          <DateBoxes iso={d('admissionDate')} />
          <F k="इयत्ता" v={d('admissionStd')} />
        </div>
        <div className="lcz-row">
          <F k="अभ्यासातील प्रगती" v={d('progress')} />
          <F k="वर्तणूक" v={d('conduct')} />
        </div>
        <div className="lcz-row">
          <span className="lcz-k">शाळा सोडल्याचा दिनांक</span>
          <DateBoxes iso={d('leftDate')} />
        </div>
        <div className="lcz-row">
          <F k="कोणत्या इयत्तेत शिकत होता/होती व केंव्हापासून (अक्षरी व अंकी)" v={d('lastStd')} />
        </div>
        <div className="lcz-row">
          <F v="" />
        </div>
        <div className="lcz-row">
          <F k="शाळा सोडण्याचे कारण" v={d('reason')} />
        </div>
        <div className="lcz-row">
          <F k="शेरा" v={d('remark')} />
        </div>

        <p className="lcz-cert">{tpl.zpCertText || ZP_CERT_TEXT}</p>
        <div className="lcz-row lcz-date-line">
          <F k="तारीख" v={issue ? String(Number(issue[3])) : ''} w="44mm" />
          <F k="माहे" v={issue ? MONTH_NAMES[Number(issue[2]) - 1] : ''} w="48mm" />
          <F k="सन" v={issue ? issue[1] : ''} w="40mm" />
        </div>

        <div className="lcz-signs">
          <div className="lcz-sign">वर्गशिक्षक</div>
          <div className="lcz-sign right">मुख्याध्यापक</div>
        </div>
        <div className="lcz-seal">(शिक्का)</div>
        <div className="lcz-note">टीप :- शाळा सोडल्याचे दाखल्यामध्ये अनाधिकृतरित्या बदल केल्यास संबंधितांवर कायदेशीर कारवाई करण्यात येईल.</div>
      </div>
    </ReportPage>
  );
}

/* ------------------------------------------------------------------ */
/* configurable list                                                   */
/* ------------------------------------------------------------------ */
function ListCertificate({ school, tpl, data }: { school: School; tpl: LcTemplate; data: Record<string, string> }) {
  const fields = tpl.fields.filter((f) => f.enabled);
  const cert = tpl.certText.replace(/\{(\w+)\}/g, (_, k: string) => (DATE_KEYS.has(k) ? fmtDate(data[k]) : (data[k] ?? '')) || '……');
  const addr = [school.address, school.taluka ? `ता. ${school.taluka}` : '', school.district ? `जि. ${school.district}` : ''].filter(Boolean).join(', ');
  const logo = schoolLogoSrc(school);
  return (
    <ReportPage className="lc">
      <div className="page-body" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className={`lc-head${logo ? ' with-logo' : ''}`}>
          {logo ? <img className="lc-logo" src={logo} alt="" /> : null}
          {school.orgLine ? <div className="org">{school.orgLine}</div> : null}
          <div className="school">{school.name}</div>
          {addr ? <div className="addr">{addr}</div> : null}
        </div>
        <div className="lc-ids">
          <span>UDISE: {school.udise || '—'}</span>
          {school.recognitionNo ? <span>मान्यता क्र.: {school.recognitionNo}</span> : null}
          <span>माध्यम: {school.medium || 'मराठी'}</span>
        </div>
        <div className="lc-ids" style={{ fontSize: '10.5pt', marginTop: '3mm', justifyContent: 'flex-end' }}>
          <span>
            दिनांक: <b>{fmtDate(data.issueDate) || '……'}</b>
          </span>
        </div>
        <div className="lc-title" style={{ width: '120mm' }}>
          {tpl.title}
        </div>
        {tpl.headerNote ? <div className="lc-note">{tpl.headerNote}</div> : null}
        <table className="lc-table">
          <tbody>
            {fields.map((f, i) => (
              <tr key={f.key}>
                <td className="n">{i + 1}.</td>
                <td className="k">{f.label}</td>
                <td className="c">:</td>
                <td className="v">{(DATE_KEYS.has(f.key) ? fmtDate(data[f.key]) : data[f.key]) || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tpl.certText ? <p className="lc-cert">{cert}</p> : null}
        <div className="lc-place">
          स्थळ: {school.taluka || school.district || ''}
          <br />
          दिनांक: {fmtDate(data.issueDate)}
        </div>
        <div style={{ marginTop: 'auto' }}>
          <Signatures items={tpl.signLabels.map((l) => ({ label: '', name: l }))} />
        </div>
      </div>
    </ReportPage>
  );
}
