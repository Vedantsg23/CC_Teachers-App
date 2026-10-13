import { useState } from 'react';
import { useSession } from '../../app/session';
import { runSetup } from '../../lib/auth';
import { APP_NAME, DEFAULT_YEAR } from '../../lib/labels';
import * as repo from '../../lib/repo';
import type { School } from '../../lib/types';
import { validatePassword, validateUdise } from '../../lib/validation';
import { Button, Notice, TextField } from '../../components/ui';

const STEPS = ['शाळेची माहिती', 'मुख्याध्यापक खाते'];

/**
 * Optional, first-run only: school details + the headmaster/admin account.
 * Teachers then create their own accounts from the login page.
 */
export function SetupWizard({ onCancel }: { onCancel: () => void }) {
  const { reloadAll } = useSession();
  const [step, setStep] = useState(0);
  const [school, setSchool] = useState<School>({ ...repo.emptySchool() });
  const [adminPw, setAdminPw] = useState('');
  const [adminPw2, setAdminPw2] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [fatal, setFatal] = useState('');

  const s = (p: Partial<School>) => setSchool((x) => ({ ...x, ...p }));

  function validateStep(i: number): boolean {
    const e: Record<string, string> = {};
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
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function finish() {
    if (!validateStep(1)) return;
    setBusy(true);
    setFatal('');
    try {
      await runSetup({ school: { ...school, name: school.name.trim(), headmaster: school.headmaster.trim() }, year: DEFAULT_YEAR, adminPassword: adminPw, teachers: [] });
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
          <p className="text-[15px] text-white/75">शाळेची मांडणी (मुख्याध्यापक)</p>
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
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Notice>
                मुख्याध्यापक / प्रशासक खाते (<b>admin</b>) शाळेची माहिती, शिक्षक खाती, पासवर्ड बदल व संपूर्ण बॅकअप यासाठी आहे. हे खाते विद्यार्थ्यांचे गुण पाहू शकत नाही. शिक्षक लॉगिन पानावरून स्वतःचे खाते तयार करतील.
              </Notice>
              <span className="hidden sm:block" />
              <TextField label="वापरकर्ता नाव" value="admin" onChange={() => undefined} disabled />
              <span className="hidden sm:block" />
              <TextField label="पासवर्ड" type="password" value={adminPw} onChange={setAdminPw} required error={errors.adminPw} autoComplete="new-password" hint="किमान 6 अक्षरे" />
              <TextField label="पासवर्ड पुन्हा" type="password" value={adminPw2} onChange={setAdminPw2} required error={errors.adminPw2} autoComplete="new-password" />
              {fatal ? (
                <div className="sm:col-span-2">
                  <Notice kind="error">{fatal}</Notice>
                </div>
              ) : null}
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-rule pt-4">
            <Button onClick={() => (step === 0 ? onCancel() : setStep(0))} disabled={busy} icon="left">
              मागे
            </Button>
            {step === 0 ? (
              <Button variant="primary" onClick={() => validateStep(0) && setStep(1)}>
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
