/** शाळा सोडल्याचा दाखला — printed from a configurable template (सेटिंग्ज/प्रशासन → दाखला नमुना). */
import { fmtDate } from '../../../lib/format';
import type { LcTemplate, School } from '../../../lib/types';
import { ReportPage, Signatures } from '../../../components/report/Report';

const DATE_KEYS = new Set(['dob', 'admissionDate', 'leftDate', 'lastAttended']);

export function LeavingCertificatePage({ school, tpl, data }: { school: School; tpl: LcTemplate; data: Record<string, string> }) {
  const fields = tpl.fields.filter((f) => f.enabled);
  const cert = tpl.certText.replace(/\{(\w+)\}/g, (_, k: string) => (DATE_KEYS.has(k) ? fmtDate(data[k]) : (data[k] ?? '')) || '……');
  const addr = [school.address, school.taluka ? `ता. ${school.taluka}` : '', school.district ? `जि. ${school.district}` : ''].filter(Boolean).join(', ');
  return (
    <ReportPage className="lc">
      <div className="page-body" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="lc-head">
          {school.orgLine ? <div className="org">{school.orgLine}</div> : null}
          <div className="school">{school.name}</div>
          {addr ? <div className="addr">{addr}</div> : null}
        </div>
        <div className="lc-ids">
          <span>UDISE: {school.udise || '—'}</span>
          {school.recognitionNo ? <span>मान्यता क्र.: {school.recognitionNo}</span> : null}
          <span>माध्यम: {school.medium || 'मराठी'}</span>
        </div>
        <div className="lc-ids" style={{ fontSize: '10.5pt', marginTop: '3mm' }}>
          <span>
            दाखला क्रमांक: <b>{data.certNo || '……'}</b>
          </span>
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
