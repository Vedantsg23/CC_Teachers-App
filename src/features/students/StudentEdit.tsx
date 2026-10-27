import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useStudents } from '../../app/data';
import { useTeacher } from '../../app/session';
import { CATEGORIES, CONDUCT_OPTIONS, LEAVING_REASONS, PROGRESS_OPTIONS, RELIGIONS, STANDARD_WORDS } from '../../lib/labels';
import * as repo from '../../lib/repo';
import { track } from '../../lib/saveStatus';
import type { LeavingInfo, Student, StudentHealth } from '../../lib/types';
import { digitsOnly, normalizeDigits, validateStudent } from '../../lib/validation';
import { useFeedback } from '../../components/feedback';
import { AreaField, Button, Notice, PageHeader, SelectField, TextField } from '../../components/ui';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="panel p-4 md:p-5">
      <legend className="sr-only">{title}</legend>
      <h2 className="mb-3 text-[17px] font-semibold text-ink-deep">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

const emptyLeaving = (): LeavingInfo => ({ date: '', reason: '', lastAttended: '', conduct: 'चांगली', progress: 'चांगली', remark: '' });
const emptyHealth = (): StudentHealth => ({ weight1: '', height1: '', weight2: '', height2: '' });

/** "1234 5678 9012" style grouping while typing (digits only are stored). */
function groupDigits(v: string): string {
  return digitsOnly(v)
    .slice(0, 12)
    .replace(/(\d{4})(?=\d)/g, '$1 ');
}

export default function StudentEdit() {
  const { id } = useParams();
  const { scope } = useTeacher();
  const all = useStudents(true);
  const nav = useNavigate();
  const { toast } = useFeedback();
  const [s, setS] = useState<Student | null>(null);
  const [rollText, setRollText] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState<Error | null>(null);
  if (loadErr) throw loadErr;

  // edit: load the record once per id
  useEffect(() => {
    if (!id) return;
    let alive = true;
    repo
      .getStudent(scope, id)
      .then((st) => {
        if (!alive) return;
        setS(st);
        setRollText(st.rollNo ? String(st.rollNo) : '');
      })
      .catch((e) => alive && setLoadErr(e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, scope.classId]);

  // new: start with the next free roll number
  useEffect(() => {
    if (id || !all || s) return;
    const next = all.reduce((m, x) => Math.max(m, x.rollNo ?? 0), 0) + 1;
    setS({ ...repo.emptyStudent(scope.classId) });
    setRollText(String(next));
  }, [id, all, s, scope.classId]);

  const check = useMemo(() => {
    if (!s) return { errors: {}, warnings: {} };
    const rollNo = rollText.trim() ? Number(normalizeDigits(rollText)) : null;
    return validateStudent({ ...s, rollNo }, all ?? []);
  }, [s, rollText, all]);

  if (!s) return null;
  const set = (p: Partial<Student>) => setS((x) => (x ? { ...x, ...p } : x));
  const setL = (p: Partial<LeavingInfo>) => setS((x) => (x ? { ...x, leaving: { ...(x.leaving ?? emptyLeaving()), ...p } } : x));
  const setH = (p: Partial<StudentHealth>) => setS((x) => (x ? { ...x, health: { ...(x.health ?? emptyHealth()), ...p } } : x));
  const health = s.health ?? emptyHealth();
  const err = (k: string) => (touched ? (check.errors as Record<string, string>)[k] : undefined);
  // ID numbers: show the mistake as soon as all digits are typed
  const idErr = (k: 'aadhaar' | 'apaar') => {
    const e = (check.errors as Record<string, string>)[k];
    return e && (touched || digitsOnly(s[k] ?? '').length >= 12) ? e : undefined;
  };
  const castes = [...new Set((all ?? []).map((x) => x.caste).filter(Boolean))];

  async function save(addAnother: boolean) {
    setTouched(true);
    if (!s || Object.keys(check.errors).length) {
      toast('कृपया लाल रंगातील चुका दुरुस्त करा.', 'error');
      return;
    }
    setBusy(true);
    try {
      const rollNo = rollText.trim() ? Number(normalizeDigits(rollText)) : null;
      const rec = await track(
        repo.saveStudent(scope, {
          ...s,
          rollNo,
          fullName: s.fullName.trim().replace(/\s+/g, ' '),
          mobile: normalizeDigits(s.mobile).replace(/[\s-]/g, ''),
          aadhaar: digitsOnly(s.aadhaar ?? ''),
          apaar: digitsOnly(s.apaar ?? ''),
          pen: digitsOnly(s.pen),
          health: {
            weight1: normalizeDigits(health.weight1).trim(),
            height1: normalizeDigits(health.height1).trim(),
            weight2: normalizeDigits(health.weight2).trim(),
            height2: normalizeDigits(health.height2).trim(),
          },
        }),
      );
      toast(id ? 'विद्यार्थ्याची माहिती जतन झाली.' : 'विद्यार्थी जोडला.');
      if (addAnother) {
        setS({ ...repo.emptyStudent(scope.classId) });
        setRollText(String((rollNo ?? 0) + 1));
        setTouched(false);
        window.scrollTo(0, 0);
      } else nav(`/students/${rec.id}`, { replace: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'माहिती जतन करताना अडचण आली.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(false);
      }}
      noValidate
    >
      <PageHeader title={id ? 'विद्यार्थी संपादित करा' : 'विद्यार्थी जोडा'} back={id ? `/students/${id}` : '/students'} subtitle={id ? s.fullName : undefined} />
      <div className="grid gap-4">
        <Section title="मूलभूत माहिती">
          <TextField label="विद्यार्थ्याचे पूर्ण नाव" value={s.fullName} onChange={(v) => set({ fullName: v })} required error={err('fullName')} className="sm:col-span-2" placeholder="नाव वडिलांचे नाव आडनाव" autoFocus={!id} />
          <SelectField label="लिंग" value={s.gender} onChange={(v) => set({ gender: v as 'M' | 'F' })} options={[{ value: 'M', label: 'मुलगा' }, { value: 'F', label: 'मुलगी' }]} required error={err('gender')} />
          <TextField label="जन्मतारीख" type="date" value={s.dob} onChange={(v) => set({ dob: v })} error={err('dob')} warning={check.warnings.dob} />
          <TextField label="हजेरी क्रमांक" value={rollText} onChange={setRollText} inputMode="numeric" error={err('rollNo')} warning={check.warnings.rollNo} />
          <TextField label="जनरल रजिस्टर क्रमांक" value={s.regNo} onChange={(v) => set({ regNo: v })} warning={check.warnings.regNo} />
          <TextField label="पेन नंबर (UDISE PEN)" value={s.pen} onChange={(v) => set({ pen: v.replace(/\s/g, '') })} inputMode="numeric" hint="उपलब्ध असल्यास" />
          <TextField label="आधार क्रमांक" value={groupDigits(s.aadhaar ?? '')} onChange={(v) => set({ aadhaar: digitsOnly(v).slice(0, 12) })} inputMode="numeric" placeholder="1234 5678 9012" error={idErr('aadhaar')} warning={check.warnings.aadhaar} hint="12 अंकी (यु आय डी नं.)" />
          <TextField label="अपार आयडी (APAAR ID)" value={groupDigits(s.apaar ?? '')} onChange={(v) => set({ apaar: digitsOnly(v).slice(0, 12) })} inputMode="numeric" error={idErr('apaar')} hint="12 अंकी" />
        </Section>

        <Section title="जन्मस्थळ">
          <TextField label="जन्मस्थळ (गाव / शहर)" value={s.birthPlace} onChange={(v) => set({ birthPlace: v })} />
          <TextField label="तालुका" value={s.birthTaluka ?? ''} onChange={(v) => set({ birthTaluka: v })} />
          <TextField label="जिल्हा" value={s.birthDistrict ?? ''} onChange={(v) => set({ birthDistrict: v })} />
          <TextField label="राज्य" value={s.birthState ?? ''} onChange={(v) => set({ birthState: v })} />
          <TextField label="देश" value={s.birthCountry ?? ''} onChange={(v) => set({ birthCountry: v })} />
        </Section>

        <Section title="कुटुंब व संपर्क">
          <TextField label="आईचे नाव" value={s.motherName} onChange={(v) => set({ motherName: v })} />
          <TextField label="आईचा व्यवसाय" value={s.motherOccupation ?? ''} onChange={(v) => set({ motherOccupation: v })} list="occupation-list" />
          <TextField label="वडिलांचे नाव" value={s.fatherName} onChange={(v) => set({ fatherName: v })} />
          <TextField label="वडिलांचा व्यवसाय" value={s.fatherOccupation ?? ''} onChange={(v) => set({ fatherOccupation: v })} list="occupation-list" />
          <datalist id="occupation-list">
            {['शेती', 'शेतमजूर', 'मजुरी', 'नोकरी', 'व्यवसाय', 'गृहिणी', 'वाहनचालक'].map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
          <TextField label="पालकाचे नाव" value={s.guardianName} onChange={(v) => set({ guardianName: v })} />
          <TextField label="मोबाईल क्रमांक" type="tel" inputMode="tel" value={s.mobile} onChange={(v) => set({ mobile: v })} error={err('mobile')} />
          <AreaField label="पत्ता" value={s.address} onChange={(v) => set({ address: v })} rows={2} className="sm:col-span-2" />
        </Section>

        <Section title="सामाजिक माहिती">
          <SelectField label="धर्म" value={s.religion} onChange={(v) => set({ religion: v })} placeholder="निवडा" options={RELIGIONS.map((r) => ({ value: r, label: r }))} />
          <div>
            <TextField label="जात" value={s.caste} onChange={(v) => set({ caste: v })} list="caste-list" hint="यादीतून निवडा किंवा लिहा" />
            <datalist id="caste-list">
              {castes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <TextField label="पोटजात" value={s.subCaste ?? ''} onChange={(v) => set({ subCaste: v })} />
          <SelectField label="जात प्रवर्ग" value={s.category} onChange={(v) => set({ category: v })} placeholder="निवडा" options={CATEGORIES.map((c) => ({ value: c.code, label: c.label }))} />
          <TextField label="राष्ट्रीयत्व" value={s.nationality} onChange={(v) => set({ nationality: v })} />
          <TextField label="मातृभाषा" value={s.motherTongue} onChange={(v) => set({ motherTongue: v })} />
        </Section>

        <fieldset className="panel p-4 md:p-5">
          <legend className="sr-only">आरोग्यविषयक माहिती</legend>
          <h2 className="mb-3 text-[17px] font-semibold text-ink-deep">आरोग्यविषयक माहिती</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {([1, 2] as const).map((t) => (
              <div key={t} className="grid grid-cols-2 gap-3 rounded-lg border border-rule p-3">
                <div className="col-span-2 text-[14.5px] font-semibold text-ink">{t === 1 ? 'प्रथम सत्र' : 'द्वितीय सत्र'}</div>
                <TextField label="वजन (कि.ग्रॅ.)" value={health[`weight${t}`]} onChange={(v) => setH({ [`weight${t}`]: v })} inputMode="decimal" error={err(`health.weight${t}`)} />
                <TextField label="उंची (से.मी.)" value={health[`height${t}`]} onChange={(v) => setH({ [`height${t}`]: v })} inputMode="decimal" error={err(`health.height${t}`)} />
              </div>
            ))}
          </div>
        </fieldset>

        <Section title="प्रवेश">
          <TextField label="प्रवेश दिनांक" type="date" value={s.admissionDate} onChange={(v) => set({ admissionDate: v })} error={err('admissionDate')} />
          <SelectField label="प्रवेशाच्या वेळची इयत्ता" value={s.admissionStd} onChange={(v) => set({ admissionStd: v })} placeholder="निवडा" options={Object.values(STANDARD_WORDS).slice(0, 8).map((w) => ({ value: w, label: w }))} />
          <TextField label="या पूर्वीची शाळा व इयत्ता" value={s.previousSchool} onChange={(v) => set({ previousSchool: v })} className="sm:col-span-2" />
        </Section>

        <Section title="शाळा सोडण्याची माहिती">
          <SelectField
            label="स्थिती"
            value={s.status}
            onChange={(v) => set({ status: v as 'active' | 'left', leaving: v === 'left' ? (s.leaving ?? emptyLeaving()) : s.leaving })}
            options={[{ value: 'active', label: 'शाळेत शिकत आहे' }, { value: 'left', label: 'शाळा सोडली' }]}
          />
          {s.status === 'left' || s.leaving ? (
            <>
              <TextField label="शाळा सोडल्याचा दिनांक" type="date" value={s.leaving?.date ?? ''} onChange={(v) => setL({ date: v })} />
              <TextField label="शेवटचा उपस्थित दिवस" type="date" value={s.leaving?.lastAttended ?? ''} onChange={(v) => setL({ lastAttended: v })} />
              <SelectField label="शाळा सोडण्याचे कारण" value={s.leaving?.reason ?? ''} onChange={(v) => setL({ reason: v })} placeholder="निवडा" options={LEAVING_REASONS.map((r) => ({ value: r, label: r }))} />
              <SelectField label="वर्तणूक" value={s.leaving?.conduct ?? ''} onChange={(v) => setL({ conduct: v })} options={CONDUCT_OPTIONS.map((r) => ({ value: r, label: r }))} />
              <SelectField label="अभ्यासातील प्रगती" value={s.leaving?.progress ?? ''} onChange={(v) => setL({ progress: v })} options={PROGRESS_OPTIONS.map((r) => ({ value: r, label: r }))} />
              <TextField label="शेरा" value={s.leaving?.remark ?? ''} onChange={(v) => setL({ remark: v })} className="sm:col-span-2" />
            </>
          ) : (
            <p className="self-end text-[14px] text-muted">विद्यार्थ्याने शाळा सोडल्यास येथे “शाळा सोडली” निवडा.</p>
          )}
        </Section>

        {touched && Object.keys(check.errors).length ? <Notice kind="error">कृपया लाल रंगातील माहिती दुरुस्त करा.</Notice> : null}

        <div className="sticky bottom-0 z-10 -mx-3 flex flex-wrap gap-2 border-t border-rule bg-paper/95 px-3 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
          <Button type="submit" variant="primary" icon="check" loading={busy}>
            जतन करा
          </Button>
          {!id ? (
            <Button onClick={() => void save(true)} disabled={busy} icon="plus">
              जतन करा व नवीन जोडा
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => nav(id ? `/students/${id}` : '/students')}>
            रद्द करा
          </Button>
        </div>
      </div>
    </form>
  );
}
