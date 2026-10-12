import { useState } from 'react';
import { useSession } from '../../app/session';
import { runSetup, type TeacherSetup } from '../../lib/auth';
import { seedDemo } from '../../lib/demo';
import { db } from '../../lib/db';
import { APP_NAME, DEFAULT_YEAR, SECTIONS, standardLabel } from '../../lib/labels';
import * as repo from '../../lib/repo';
import type { School } from '../../lib/types';
import { validatePassword, validateUdise, validateUsername } from '../../lib/validation';
import { Button, Checkbox, Notice, SelectField, TextField } from '../../components/ui';

const STEPS = ['शाळेची माहिती', 'मुख्याध्यापक खाते', 'शिक्षक 1 — सातवी', 'शिक्षक 2 — पाचवी', 'तपासा व सुरू करा'];

interface TeacherForm extends TeacherSetup {
  confirm: string;
}

function TeacherStep({ t, set, errors }: { t: TeacherForm; set: (p: Partial<TeacherForm>) => void; errors: Record<string, string> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="इयत्ता" value={standardLabel(t.standard)} onChange={() => undefined} disabled hint="हे खाते फक्त याच इयत्तेची माहिती पाहू शकेल." />
      <SelectField label="तुकडी" value={t.section} onChange={(v) => set({ section: v })} options={SECTIONS.map((s) => ({ value: s, label: s }))} />
      <TextField label="वर्गशिक्षकाचे नाव" value={t.displayName} onChange={(v) => set({ displayName: v })} required error={errors.displayName} className="sm:col-span-2" />
      <TextField label="वापरकर्ता नाव" value={t.username} onChange={(v) => set({ username: v.toLowerCase().trim() })} required error={errors.username} hint="इंग्रजी लहान अक्षरे/अंक" />
      <span className="hidden sm:block" />
      <TextField label="पासवर्ड" type="password" value={t.password} onChange={(v) => set({ password: v })} required error={errors.password} autoComplete="new-password" hint="किमान 6 अक्षरे" />
      <TextField label="पासवर्ड पुन्हा" type="password" value={t.confirm} onChange={(v) => set({ confirm: v })} required error={errors.confirm} autoComplete="new-password" />
    </div>
  );
}

export function SetupWizard() {
  const { reloadAll } = useSession();
  const [step, setStep] = useState(0);
  const [school, setSchool] = useState<School>({ ...repo.emptySchool() });
  const [adminPw, setAdminPw] = useState('');
  const [adminPw2, setAdminPw2] = useState('');
  const [t7, setT7] = useState<TeacherForm>({ username: 'teacher7', displayName: '', standard: 7, section: 'ब', password: '', confirm: '' });
  const [t5, setT5] = useState<TeacherForm>({ username: 'teacher5', displayName: '', standard: 5, section: 'अ', password: '', confirm: '' });
  const [demo, setDemo] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [fatal, setFatal] = useState('');

  const s = (p: Partial<School>) => setSchool((x) => ({ ...x, ...p }));

  function checkTeacher(t: TeacherForm, other?: TeacherForm): Record<string, string> {
    const e: Record<string, string> = {};
    if (!t.displayName.trim()) e.displayName = 'कृपया वर्गशिक्षकाचे नाव भरा.';
    const u = validateUsername(t.username);
    if (u) e.username = u;
    else if (t.username === 'admin' || (other && other.username === t.username)) e.username = 'हे वापरकर्ता नाव आधीच वापरले आहे.';
    const p = validatePassword(t.password);
    if (p) e.password = p;
    else if (t.password !== t.confirm) e.confirm = 'दोन्ही पासवर्ड सारखे नाहीत.';
    return e;
  }

  function validateStep(i: number): boolean {
    let e: Record<string, string> = {};
    if (i === 0) {
      if (!school.name.trim()) e.name = 'कृपया शाळेचे नाव भरा.';
      const u = validateUdise(school.udise);
      if (u) e.udise = u;
    }
    if (i === 1) {
      const p = validatePassword(adminPw);
      if (p) e.adminPw = p;
      else if (adminPw !== adminPw2) e.adminPw2 = 'दोन्ही पासवर्ड सारखे नाहीत.';
    }
    if (i === 2) e = checkTeacher(t7);
    if (i === 3) e = checkTeacher(t5, t7);
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function finish() {
    setBusy(true);
    setFatal('');
    try {
      await runSetup({
        school: { ...school, name: school.name.trim(), headmaster: school.headmaster.trim() },
        year: DEFAULT_YEAR,
        adminPassword: adminPw,
        teachers: [t7, t5].map(({ confirm: _c, ...t }) => t),
      });
      if (demo) {
        for (const u of await db.users.where('role').equals('teacher').toArray()) {
          const cls = await repo.findClass(u.id, DEFAULT_YEAR);
          if (cls) await seedDemo({ classId: cls.id, userId: u.id });
        }
      }
      await reloadAll();
    } catch (x) {
      setFatal(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ruled-paper min-h-dvh">
      <div className="bg-ink-deep px-4 py-6 text-white sm:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-[15px] text-white/75">पहिल्यांदा वापर — प्राथमिक मांडणी</p>
          <h1 className="mt-1 font-display text-[34px] leading-tight">{APP_NAME}</h1>
          <p className="mt-1 text-[20px] font-semibold text-[#f6d38b]">सन : {DEFAULT_YEAR}</p>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-3 py-6 sm:px-6">
        <ol className="mb-5 flex gap-1.5 overflow-x-auto pb-1" aria-label="टप्पे">
          {STEPS.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? 'step' : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[13.5px] font-semibold ${i === step ? 'bg-ink text-white' : i < step ? 'bg-leaf-soft text-leaf' : 'bg-white text-muted ring-1 ring-rule'}`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        <div className="panel p-4 sm:p-6">
          <h2 className="mb-4 text-[20px] font-semibold text-ink-deep">{STEPS[step]}</h2>

          {step === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="शाळेचे नाव" value={school.name} onChange={(v) => s({ name: v })} required error={errors.name} className="sm:col-span-2" placeholder="उदा. जिल्हा परिषद प्राथमिक शाळा …" />
              <TextField label="UDISE क्रमांक" value={school.udise} onChange={(v) => s({ udise: v.replace(/\D/g, '') })} inputMode="numeric" maxLength={11} error={errors.udise} hint="11 अंकी" />
              <TextField label="व्यवस्थापन / संस्था" value={school.orgLine} onChange={(v) => s({ orgLine: v })} placeholder="उदा. जिल्हा परिषद, पुणे" hint="अहवालाच्या शीर्षकावर छापले जाते" />
              <TextField label="तालुका" value={school.taluka} onChange={(v) => s({ taluka: v })} />
              <TextField label="जिल्हा" value={school.district} onChange={(v) => s({ district: v })} />
              <TextField label="केंद्र" value={school.centre} onChange={(v) => s({ centre: v })} />
              <TextField label="मुख्याध्यापकाचे नाव" value={school.headmaster} onChange={(v) => s({ headmaster: v })} />
              <TextField label="शाळेचा पत्ता" value={school.address} onChange={(v) => s({ address: v })} className="sm:col-span-2" />
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Notice>
                मुख्याध्यापक / प्रशासक खाते (<b>admin</b>) शाळेची माहिती, शिक्षक खाती, पासवर्ड बदल व संपूर्ण बॅकअप यासाठी आहे. हे खाते विद्यार्थ्यांचे गुण पाहू शकत नाही.
              </Notice>
              <span className="hidden sm:block" />
              <TextField label="वापरकर्ता नाव" value="admin" onChange={() => undefined} disabled />
              <span className="hidden sm:block" />
              <TextField label="पासवर्ड" type="password" value={adminPw} onChange={setAdminPw} required error={errors.adminPw} autoComplete="new-password" hint="किमान 6 अक्षरे" />
              <TextField label="पासवर्ड पुन्हा" type="password" value={adminPw2} onChange={setAdminPw2} required error={errors.adminPw2} autoComplete="new-password" />
            </div>
          ) : null}

          {step === 2 ? <TeacherStep t={t7} set={(p) => setT7((x) => ({ ...x, ...p }))} errors={errors} /> : null}
          {step === 3 ? <TeacherStep t={t5} set={(p) => setT5((x) => ({ ...x, ...p }))} errors={errors} /> : null}

          {step === 4 ? (
            <div className="grid gap-4">
              <dl className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-[auto_1fr]">
                <dt className="text-muted">शाळा</dt>
                <dd className="font-semibold">{school.name}</dd>
                <dt className="text-muted">UDISE</dt>
                <dd>{school.udise || '—'}</dd>
                <dt className="text-muted">सन</dt>
                <dd>{DEFAULT_YEAR}</dd>
                <dt className="text-muted">शिक्षक 1</dt>
                <dd>
                  {t7.displayName} — इयत्ता सातवी, तुकडी {t7.section} (<code>{t7.username}</code>)
                </dd>
                <dt className="text-muted">शिक्षक 2</dt>
                <dd>
                  {t5.displayName} — इयत्ता पाचवी, तुकडी {t5.section} (<code>{t5.username}</code>)
                </dd>
              </dl>
              <Checkbox
                label="चाचणीसाठी नमुना (डेमो) विद्यार्थी माहिती भरा"
                hint="प्रत्येक वर्गात 10 काल्पनिक विद्यार्थी, गुण व नोंदी. सेटिंग्जमधून कधीही काढून टाकता येईल."
                checked={demo}
                onChange={setDemo}
              />
              <Notice kind="warn">सर्व माहिती फक्त याच उपकरणावर जतन होते. नियमितपणे “डेटा बॅकअप” घ्या.</Notice>
              {fatal ? <Notice kind="error">{fatal}</Notice> : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-rule pt-4">
            <Button onClick={() => setStep((x) => Math.max(0, x - 1))} disabled={step === 0 || busy} icon="left">
              मागील
            </Button>
            {step < STEPS.length - 1 ? (
              <Button variant="primary" onClick={() => validateStep(step) && setStep(step + 1)}>
                पुढील
              </Button>
            ) : (
              <Button variant="primary" onClick={finish} loading={busy} icon="check">
                मांडणी पूर्ण करा
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
