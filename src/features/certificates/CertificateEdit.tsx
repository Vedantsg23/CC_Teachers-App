import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useClassBundle } from '../../app/data';
import { useTeacher } from '../../app/session';
import { fmtDate, safeFileName, todayIso } from '../../lib/format';
import { categoryLabel, CONDUCT_OPTIONS, LEAVING_REASONS, MONTH_NAMES, PROGRESS_OPTIONS, standardLabel, standardNum } from '../../lib/labels';
import { dateToMarathiWords } from '../../lib/marathi';
import * as repo from '../../lib/repo';
import { track } from '../../lib/saveStatus';
import type { Certificate, ClassRoom, School, Student } from '../../lib/types';
import { useFeedback } from '../../components/feedback';
import { ReportViewer } from '../../components/report/ReportViewer';
import { Button, Checkbox, Notice, PageHeader, Panel, SelectField, TextField } from '../../components/ui';
import { LeavingCertificatePage, splitName, ZP_FIELDS } from '../reports/templates/certificate';

const DATE_FIELDS = new Set(['dob', 'admissionDate', 'leftDate', 'lastAttended']);
const SELECTS: Record<string, string[]> = { reason: LEAVING_REASONS, conduct: CONDUCT_OPTIONS, progress: PROGRESS_OPTIONS };
const WIDE = new Set(['remark', 'fullName', 'lastStd', 'previousSchool', 'dobWords', 'reason']);

/** Birth place parts; older records kept "गाव, ता. …, जि. …" in one field. */
function birthParts(st: Student): { place: string; taluka: string; district: string } {
  let place = st.birthPlace ?? '';
  let taluka = st.birthTaluka ?? '';
  let district = st.birthDistrict ?? '';
  if (!taluka && !district && place.includes(',')) {
    const p = place.split(',').map((x) => x.trim()).filter(Boolean);
    place = p[0] ?? '';
    taluka = (p[1] ?? '').replace(/^(ता\.?|तालुका)\s*/, '');
    district = (p[2] ?? '').replace(/^(जि\.?|जिल्हा)\s*/, '');
  }
  return { place, taluka, district };
}

/** "इयत्ता सातवी (7 वी) — जून 2026 पासून" (admission month when admitted during this year). */
function sinceText(st: Student, cls: ClassRoom): string {
  const start = Number(cls.year.slice(0, 4));
  const m = /^(\d{4})-(\d{2})/.exec(st.admissionDate || '');
  const inYear = m && st.admissionDate >= `${start}-06-01` && st.admissionDate <= `${start + 1}-05-31`;
  const since = inYear && m ? `${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}` : `${MONTH_NAMES[5]} ${start}`;
  return `इयत्ता ${standardLabel(cls.standard)} (${standardNum(cls.standard)}) — ${since} पासून`;
}

function prefill(st: Student, cls: ClassRoom, school: School): Record<string, string> {
  const name = splitName(st.fullName);
  const birth = birthParts(st);
  return {
    regNo: st.regNo,
    pen: st.pen,
    aadhaar: st.aadhaar ?? '',
    apaar: st.apaar ?? '',
    email: school.email ?? '',
    fullName: st.fullName,
    firstName: name.first,
    fatherFirst: name.father || (st.fatherName || st.guardianName || '').trim().split(/\s+/)[0] || '',
    surname: name.surname,
    motherName: st.motherName,
    fatherName: st.fatherName || st.guardianName,
    nationality: st.nationality || 'भारतीय',
    motherTongue: st.motherTongue || 'मराठी',
    religion: st.religion,
    caste: st.caste,
    subCaste: st.subCaste ?? '',
    category: st.category ? categoryLabel(st.category) : '',
    birthPlace: birth.place,
    birthTaluka: birth.taluka,
    birthDistrict: birth.district,
    birthState: st.birthState || 'महाराष्ट्र',
    birthCountry: st.birthCountry || 'भारत',
    dob: st.dob,
    dobWords: dateToMarathiWords(st.dob),
    previousSchool: st.previousSchool,
    admissionDate: st.admissionDate,
    admissionStd: st.admissionStd,
    currentStd: standardLabel(cls.standard),
    lastStd: sinceText(st, cls),
    progress: st.leaving?.progress || 'चांगली',
    conduct: st.leaving?.conduct || 'चांगली',
    lastAttended: st.leaving?.lastAttended || '',
    leftDate: st.leaving?.date || todayIso(),
    reason: st.leaving?.reason || '',
    remark: st.leaving?.remark || '',
  };
}

export default function CertificateEdit() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { scope, cls, school } = useTeacher();
  const b = useClassBundle();
  const tpl = useLiveQuery(() => repo.getLcTemplate(), []);
  const nav = useNavigate();
  const { toast } = useFeedback();
  const [cert, setCert] = useState<Certificate | null>(null);
  const [markLeft, setMarkLeft] = useState(true);
  const [preview, setPreview] = useState(sp.get('preview') === '1');
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState<Error | null>(null);
  if (loadErr) throw loadErr;

  // existing certificate
  useEffect(() => {
    if (!id) return;
    repo.getCertificate(scope, id).then(setCert).catch(setLoadErr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, scope.classId]);

  // new certificate (optionally for ?student=)
  useEffect(() => {
    if (id || cert || !b) return;
    const sid = sp.get('student');
    const st = sid ? b.allStudents.find((s) => s.id === sid) : undefined;
    void repo.peekNextCertNo().then((no) =>
      setCert({ id: '', classId: scope.classId, studentId: st?.id ?? '', certNo: no, issueDate: todayIso(), data: st ? prefill(st, cls, school) : {}, createdAt: 0, updatedAt: 0 }),
    );
  }, [id, cert, b, sp, scope.classId, cls, school]);

  if (!b || !tpl || !cert) return null;
  const zp = tpl.layout !== 'list';
  const fields = zp ? ZP_FIELDS : tpl.fields.filter((f) => f.enabled);
  const setData = (k: string, v: string) =>
    setCert((c) => {
      if (!c) return c;
      const data = { ...c.data, [k]: v };
      if (k === 'dob') data.dobWords = dateToMarathiWords(v);
      return { ...c, data };
    });

  async function save(): Promise<Certificate | null> {
    if (!cert) return null;
    if (!cert.studentId) {
      toast('कृपया विद्यार्थी निवडा.', 'error');
      return null;
    }
    if (!cert.certNo.trim()) {
      toast('कृपया दाखला क्रमांक भरा.', 'error');
      return null;
    }
    setBusy(true);
    try {
      const data: Record<string, string> = { ...cert.data, certNo: cert.certNo, issueDate: cert.issueDate };
      // the ZP form edits the name in three parts; keep the full name in step
      if (zp && (data.firstName || data.surname)) data.fullName = [data.firstName, data.fatherFirst, data.surname].map((x) => (x ?? '').trim()).filter(Boolean).join(' ');
      const saved = await track(repo.saveCertificate(scope, { ...cert, data }));
      if (markLeft) {
        const st = await repo.getStudent(scope, cert.studentId);
        await track(
          repo.saveStudent(scope, {
            ...st,
            status: 'left',
            leaving: {
              date: cert.data.leftDate || '',
              reason: cert.data.reason || '',
              lastAttended: cert.data.lastAttended || '',
              conduct: cert.data.conduct || '',
              progress: cert.data.progress || '',
              remark: cert.data.remark || '',
            },
          }),
        );
      }
      setCert(saved);
      toast('दाखला जतन झाला.');
      return saved;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'माहिती जतन करताना अडचण आली.', 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }

  const data: Record<string, string> = { ...cert.data, certNo: cert.certNo, issueDate: cert.issueDate };

  return (
    <div className="grid gap-4">
      <PageHeader title={id ? 'दाखला संपादित करा' : 'नवीन शाळा सोडल्याचा दाखला'} back="/certificates" />
      <Panel>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="विद्यार्थी"
            className="sm:col-span-3"
            value={cert.studentId}
            placeholder="विद्यार्थी निवडा"
            required
            onChange={(v) => {
              const st = b.allStudents.find((s) => s.id === v);
              setCert({ ...cert, studentId: v, data: st ? prefill(st, cls, school) : {} });
            }}
            options={b.allStudents.map((s) => ({ value: s.id, label: `${s.rollNo ? `${s.rollNo}. ` : ''}${s.fullName}${s.status === 'left' ? ' (शाळा सोडली)' : ''}` }))}
          />
          <TextField label="दाखला क्रमांक" value={cert.certNo} onChange={(v) => setCert({ ...cert, certNo: v })} required />
          <TextField label="दाखल्याचा दिनांक" type="date" value={cert.issueDate} onChange={(v) => setCert({ ...cert, issueDate: v })} />
        </div>
      </Panel>
      {cert.studentId ? (
        <Panel title="दाखल्यातील माहिती" actions={<span className="text-[13.5px] text-muted">विद्यार्थ्याच्या नोंदीवरून आपोआप भरली — गरज असल्यास बदला</span>}>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) =>
              SELECTS[f.key] ? (
                <SelectField key={f.key} label={f.label} value={cert.data[f.key] ?? ''} onChange={(v) => setData(f.key, v)} placeholder="निवडा" options={[...new Set([...(cert.data[f.key] ? [cert.data[f.key]] : []), ...SELECTS[f.key]])].map((o) => ({ value: o, label: o }))} />
              ) : (
                <TextField key={f.key} label={f.label} type={DATE_FIELDS.has(f.key) ? 'date' : 'text'} value={cert.data[f.key] ?? ''} onChange={(v) => setData(f.key, v)} className={WIDE.has(f.key) ? 'sm:col-span-2' : ''} />
              ),
            )}
          </div>
          <div className="mt-4">
            <Checkbox label="विद्यार्थ्याला “शाळा सोडली” म्हणून नोंदवा" hint="तो/ती वर्गाच्या याद्या व अहवालांमधून बाहेर जाईल; माहिती मात्र जपून राहील." checked={markLeft} onChange={setMarkLeft} />
          </div>
        </Panel>
      ) : (
        <Notice>दाखल्यासाठी आधी विद्यार्थी निवडा.</Notice>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          icon="printer"
          loading={busy}
          disabled={!cert.studentId}
          onClick={async () => {
            const saved = await save();
            if (saved) {
              if (!id) nav(`/certificates/${saved.id}?preview=1`, { replace: true });
              else setPreview(true);
            }
          }}
        >
          जतन करा व पूर्वदृश्य
        </Button>
        <Button icon="check" loading={busy} disabled={!cert.studentId} onClick={async () => (await save()) && nav('/certificates')}>
          जतन करा
        </Button>
        <Button variant="ghost" onClick={() => nav('/certificates')}>
          रद्द करा
        </Button>
      </div>

      {preview && cert.id ? (
        <ReportViewer
          title={`शाळा सोडल्याचा दाखला — ${data.fullName ?? ''}`}
          fileName={`${safeFileName(`दाखला-${cert.certNo}-${data.fullName ?? ''}`)}.pdf`}
          orientation="portrait"
          onClose={() => setPreview(false)}
          showPageNumbers={false}
          author={school.name}
        >
          <LeavingCertificatePage school={school} tpl={tpl} data={data} />
        </ReportViewer>
      ) : null}
      <p className="text-[13px] text-muted">दाखला दिनांक: {fmtDate(cert.issueDate)}</p>
    </div>
  );
}
