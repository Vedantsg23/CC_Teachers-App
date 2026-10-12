import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useClassBundle } from '../../app/data';
import { useTeacher } from '../../app/session';
import { fmtDate, safeFileName, todayIso } from '../../lib/format';
import { categoryLabel, CONDUCT_OPTIONS, LEAVING_REASONS, MONTH_NAMES, PROGRESS_OPTIONS, standardLabel } from '../../lib/labels';
import { dateToMarathiWords } from '../../lib/marathi';
import * as repo from '../../lib/repo';
import { track } from '../../lib/saveStatus';
import type { Certificate, ClassRoom, Student } from '../../lib/types';
import { useFeedback } from '../../components/feedback';
import { ReportViewer } from '../../components/report/ReportViewer';
import { Button, Checkbox, Notice, PageHeader, Panel, SelectField, TextField } from '../../components/ui';
import { LeavingCertificatePage } from '../reports/templates/certificate';

const DATE_FIELDS = new Set(['dob', 'admissionDate', 'leftDate', 'lastAttended']);
const SELECTS: Record<string, string[]> = { reason: LEAVING_REASONS, conduct: CONDUCT_OPTIONS, progress: PROGRESS_OPTIONS };

function prefill(st: Student, cls: ClassRoom): Record<string, string> {
  const start = Number(cls.year.slice(0, 4));
  return {
    regNo: st.regNo,
    saralId: st.saralId,
    pen: st.pen,
    fullName: st.fullName,
    motherName: st.motherName,
    fatherName: st.fatherName || st.guardianName,
    nationality: st.nationality || 'भारतीय',
    motherTongue: st.motherTongue || 'मराठी',
    religion: st.religion,
    caste: st.caste,
    category: st.category ? categoryLabel(st.category) : '',
    birthPlace: st.birthPlace,
    dob: st.dob,
    dobWords: dateToMarathiWords(st.dob),
    previousSchool: st.previousSchool,
    admissionDate: st.admissionDate,
    admissionStd: st.admissionStd,
    currentStd: standardLabel(cls.standard),
    lastStd: `इयत्ता ${standardLabel(cls.standard)} — ${MONTH_NAMES[5]} ${start} पासून`,
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
      setCert({ id: '', classId: scope.classId, studentId: st?.id ?? '', certNo: no, issueDate: todayIso(), data: st ? prefill(st, cls) : {}, createdAt: 0, updatedAt: 0 }),
    );
  }, [id, cert, b, sp, scope.classId, cls]);

  if (!b || !tpl || !cert) return null;
  const fields = tpl.fields.filter((f) => f.enabled);
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
      const saved = await track(repo.saveCertificate(scope, { ...cert, data: { ...cert.data, certNo: cert.certNo, issueDate: cert.issueDate } }));
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
              setCert({ ...cert, studentId: v, data: st ? prefill(st, cls) : {} });
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
                <TextField key={f.key} label={f.label} type={DATE_FIELDS.has(f.key) ? 'date' : 'text'} value={cert.data[f.key] ?? ''} onChange={(v) => setData(f.key, v)} className={f.key === 'remark' || f.key === 'fullName' ? 'sm:col-span-2' : ''} />
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
