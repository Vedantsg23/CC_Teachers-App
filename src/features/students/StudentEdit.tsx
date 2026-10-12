import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useStudents } from '../../app/data';
import { useTeacher } from '../../app/session';
import { CATEGORIES, CONDUCT_OPTIONS, LEAVING_REASONS, PROGRESS_OPTIONS, RELIGIONS, STANDARD_WORDS } from '../../lib/labels';
import * as repo from '../../lib/repo';
import { track } from '../../lib/saveStatus';
import { imageFileToDataUrl } from '../../lib/share';
import type { LeavingInfo, Student } from '../../lib/types';
import { normalizeDigits, validateStudent } from '../../lib/validation';
import { Icon } from '../../components/Icon';
import { useFeedback } from '../../components/feedback';
import { AreaField, Button, Notice, PageHeader, SelectField, TextField } from '../../components/ui';
import { Avatar } from './StudentsPage';

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
  const err = (k: string) => (touched ? (check.errors as Record<string, string>)[k] : undefined);
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
      const rec = await track(repo.saveStudent(scope, { ...s, rollNo, fullName: s.fullName.trim().replace(/\s+/g, ' '), mobile: normalizeDigits(s.mobile).replace(/[\s-]/g, '') }));
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
          <TextField label="रजिस्टर क्रमांक (जनरल रजि.)" value={s.regNo} onChange={(v) => set({ regNo: v })} warning={check.warnings.regNo} />
          <TextField label="विद्यार्थी आयडी (सरल)" value={s.saralId} onChange={(v) => set({ saralId: v.replace(/\s/g, '') })} inputMode="numeric" />
          <TextField label="UDISE विद्यार्थी क्रमांक (PEN)" value={s.pen} onChange={(v) => set({ pen: v.replace(/\s/g, '') })} hint="उपलब्ध असल्यास" />
          <TextField label="जन्मस्थळ" value={s.birthPlace} onChange={(v) => set({ birthPlace: v })} placeholder="गाव, तालुका, जिल्हा" className="sm:col-span-2" />
        </Section>

        <Section title="कुटुंब व संपर्क">
          <TextField label="आईचे नाव" value={s.motherName} onChange={(v) => set({ motherName: v })} />
          <TextField label="वडिलांचे नाव" value={s.fatherName} onChange={(v) => set({ fatherName: v })} />
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
          <SelectField label="जात प्रवर्ग" value={s.category} onChange={(v) => set({ category: v })} placeholder="निवडा" options={CATEGORIES.map((c) => ({ value: c.code, label: c.label }))} />
          <TextField label="राष्ट्रीयत्व" value={s.nationality} onChange={(v) => set({ nationality: v })} />
          <TextField label="मातृभाषा" value={s.motherTongue} onChange={(v) => set({ motherTongue: v })} />
        </Section>

        <Section title="प्रवेश">
          <TextField label="प्रवेश दिनांक" type="date" value={s.admissionDate} onChange={(v) => set({ admissionDate: v })} error={err('admissionDate')} />
          <SelectField label="प्रवेशाच्या वेळची इयत्ता" value={s.admissionStd} onChange={(v) => set({ admissionStd: v })} placeholder="निवडा" options={Object.values(STANDARD_WORDS).slice(0, 8).map((w) => ({ value: w, label: w }))} />
          <TextField label="मागील शाळा" value={s.previousSchool} onChange={(v) => set({ previousSchool: v })} className="sm:col-span-2" />
        </Section>

        <fieldset className="panel p-4 md:p-5">
          <legend className="sr-only">विद्यार्थ्याचा फोटो</legend>
          <h2 className="mb-3 text-[17px] font-semibold text-ink-deep">विद्यार्थ्याचा फोटो</h2>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar s={s} size={84} />
            <label className="btn btn-secondary cursor-pointer">
              <Icon name="camera" />
              फोटो निवडा
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    set({ photo: await imageFileToDataUrl(f) });
                  } catch (x) {
                    toast(x instanceof Error ? x.message : 'फोटो उघडता आला नाही.', 'error');
                  }
                }}
              />
            </label>
            {s.photo ? (
              <Button variant="danger-ghost" icon="trash" onClick={() => set({ photo: '' })}>
                फोटो काढा
              </Button>
            ) : null}
          </div>
        </fieldset>

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
