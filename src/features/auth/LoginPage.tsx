import { useState } from 'react';
import { isIOS, promptInstall, usePwa } from '../../app/pwa';
import { useSession } from '../../app/session';
import { login, LoginError, registerTeacher, RegisterError, type RegisterInput } from '../../lib/auth';
import { APP_NAME, APP_TITLE, SECTIONS, STANDARD_WORDS } from '../../lib/labels';
import { Icon } from '../../components/Icon';
import { NetworkBadge } from '../../components/layout/AppShell';
import { Button, Checkbox, Modal, Notice, SelectField, TextField } from '../../components/ui';
import { SetupWizard } from './SetupWizard';

export function InstallHint({ compact }: { compact?: boolean }) {
  const pwa = usePwa();
  const [iosHelp, setIosHelp] = useState(false);
  if (pwa.installed) {
    return (
      <p className="flex items-center gap-1.5 text-[14px] text-leaf">
        <Icon name="check" size={16} /> ॲप या उपकरणावर स्थापित आहे — इंटरनेटशिवायही चालेल.
      </p>
    );
  }
  return (
    <>
      <button
        type="button"
        className={`inline-flex items-center gap-2 text-[15px] font-semibold text-ink underline-offset-4 hover:underline ${compact ? '' : 'min-h-[44px]'}`}
        onClick={async () => {
          if (pwa.canInstall) await promptInstall();
          else setIosHelp(true);
        }}
      >
        <Icon name="install" size={19} />
        ऑफलाइन वापरासाठी PWA स्थापित करा
      </button>
      <Modal open={iosHelp} onClose={() => setIosHelp(false)} title="ॲप स्थापित करा">
        {isIOS() ? (
          <ol className="list-decimal space-y-2 pl-5 text-[15.5px]">
            <li>Safari मध्ये हे पान उघडा.</li>
            <li>खालील Share (शेअर) बटण दाबा.</li>
            <li>“Add to Home Screen” निवडा आणि “Add” दाबा.</li>
          </ol>
        ) : (
          <ol className="list-decimal space-y-2 pl-5 text-[15.5px]">
            <li>Chrome च्या मेनूमधील (⋮) “ॲप इन्स्टॉल करा / Add to Home screen” निवडा.</li>
            <li>संगणकावर पत्त्याच्या पट्टीतील “Install” चिन्ह दाबा.</li>
            <li>एकदा उघडल्यानंतर ॲप इंटरनेटशिवायही चालते.</li>
          </ol>
        )}
      </Modal>
    </>
  );
}

const STANDARDS = [1, 2, 3, 4, 5, 6, 7, 8];

/** Big tap targets: इयत्ता 1–8 as a radio group. */
function StandardPicker({ value, onChange, error }: { value: number; onChange: (n: number) => void; error?: string }) {
  return (
    <div>
      <p id="std-label" className="mb-1.5 text-[14px] font-semibold">
        1. तुमची इयत्ता निवडा
      </p>
      <div role="radiogroup" aria-labelledby="std-label" className="grid grid-cols-4 gap-2">
        {STANDARDS.map((n) => {
          const on = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`इयत्ता ${STANDARD_WORDS[n]}`}
              onClick={() => onChange(n)}
              className={`flex min-h-[58px] flex-col items-center justify-center rounded-lg border text-center transition-colors ${
                on ? 'border-ink bg-ink text-white' : 'border-rule bg-white text-ink-deep hover:border-ink'
              }`}
            >
              <span className="tabular text-[20px] leading-none font-bold">{n}</span>
              <span className={`mt-1 text-[12.5px] leading-none ${on ? 'text-white/85' : 'text-muted'}`}>{STANDARD_WORDS[n]}</span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-1 text-[13.5px] text-margin" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function RegisterForm({ onDone, onLogin, showLoginLink }: { onDone: (username: string, password: string, remember: boolean) => Promise<void>; onLogin: () => void; showLoginLink: boolean }) {
  const { school } = useSession();
  const [f, setF] = useState<RegisterInput>({ standard: 0, section: 'अ', displayName: '', username: '', password: '', confirm: '', schoolName: '' });
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<RegisterInput>) => setF((x) => ({ ...x, ...p }));
  const askSchool = !school.name.trim();

  return (
    <form
      className="mt-6 grid gap-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setErr('');
        setErrors({});
        setBusy(true);
        try {
          await registerTeacher(f);
          await onDone(f.username, f.password, remember);
        } catch (x) {
          if (x instanceof RegisterError && x.field) setErrors({ [x.field]: x.message });
          else setErr(x instanceof Error ? x.message : 'खाते तयार करताना अडचण आली.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <StandardPicker value={f.standard} onChange={(n) => set({ standard: n })} error={errors.standard} />
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <SelectField label="तुकडी" value={f.section} onChange={(v) => set({ section: v })} options={SECTIONS.map((s) => ({ value: s, label: s }))} error={errors.section} />
        <TextField label="वर्गशिक्षकाचे नाव" value={f.displayName} onChange={(v) => set({ displayName: v })} required error={errors.displayName} placeholder="उदा. श्री. राजेश जाधव" />
      </div>
      {askSchool ? <TextField label="शाळेचे नाव" value={f.schoolName ?? ''} onChange={(v) => set({ schoolName: v })} hint="अहवालांवर छापले जाते. नंतर सेटिंग्जमध्ये बदलता येईल." /> : null}
      <p className="-mb-2 text-[14px] font-semibold">2. वापरकर्ता नाव व पासवर्ड ठेवा</p>
      <TextField
        label="वापरकर्ता नाव"
        value={f.username}
        onChange={(v) => set({ username: v.toLowerCase().replace(/\s+/g, '') })}
        required
        error={errors.username}
        hint="इंग्रजी लहान अक्षरे/अंक, उदा. jadhav7"
        autoComplete="username"
      />
      <TextField label="पासवर्ड" type="password" value={f.password} onChange={(v) => set({ password: v })} required error={errors.password} hint="किमान 6 अक्षरे" autoComplete="new-password" />
      <TextField label="पासवर्ड पुन्हा" type="password" value={f.confirm} onChange={(v) => set({ confirm: v })} required error={errors.confirm} autoComplete="new-password" />
      <Checkbox label="या उपकरणावर लॉगिन ठेवा (30 दिवस)" hint="इतर शिक्षकही हेच उपकरण वापरत असल्यास हे निवडू नका." checked={remember} onChange={setRemember} />
      {err ? <Notice kind="error">{err}</Notice> : null}
      <Button type="submit" variant="primary" loading={busy} className="w-full text-[17px]" icon="check">
        खाते तयार करा
      </Button>
      <p className="text-[13.5px] text-muted">पासवर्ड लक्षात ठेवा — माहिती फक्त याच उपकरणावर जतन होते. नियमितपणे “डेटा बॅकअप” घ्या.</p>
      {showLoginLink ? (
        <Button variant="secondary" className="w-full" onClick={onLogin}>
          आधीच खाते आहे? लॉगिन करा
        </Button>
      ) : null}
    </form>
  );
}

export function LoginPage({ firstRun = false }: { firstRun?: boolean }) {
  const { meta, school, signedIn } = useSession();
  const [mode, setMode] = useState<'login' | 'register' | 'school'>(firstRun ? 'register' : 'login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [year, setYear] = useState(meta.currentYear);
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (mode === 'school') return <SetupWizard onCancel={() => setMode('register')} />;

  return (
    <div className="min-h-dvh bg-ink-deep lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* register cover */}
      <section className="relative overflow-hidden px-6 pt-10 pb-8 text-white sm:px-10 lg:flex lg:flex-col lg:justify-center lg:py-16">
        <div className="pointer-events-none absolute inset-y-0 left-6 w-[2px] bg-margin/80 sm:left-10" aria-hidden />
        <div className="relative pl-5 sm:pl-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] text-white/75">{school.orgLine || school.name || APP_NAME}</p>
            <div className="lg:hidden">
              <NetworkBadge light />
            </div>
          </div>
          <h1 className="mt-6 font-display text-[40px] leading-[1.15] sm:text-[52px] lg:text-[60px]">{APP_TITLE}</h1>
          <p className="mt-4 text-[22px] font-semibold tracking-wide text-[#f6d38b]">सन : {year}</p>
          <p className="mt-6 max-w-md text-[15.5px] text-white/75">
            {APP_NAME} — आकारिक व संकलित नोंदी, वर्णनात्मक नोंदी, उपस्थिती, प्रगती कार्ड, निकाल आणि शाळा सोडल्याचा दाखला एकाच ठिकाणी. इंटरनेटशिवायही चालते.
          </p>
          {school.name ? <p className="mt-5 text-[15px] text-white/90">{school.name}</p> : null}
        </div>
      </section>

      {/* sign-in sheet */}
      <section className="ruled-paper flex items-start justify-center rounded-t-[22px] px-4 pt-8 pb-12 lg:items-center lg:rounded-none">
        <div className="w-full max-w-[440px]">
          <div className="mb-6 hidden justify-end lg:flex">
            <NetworkBadge />
          </div>

          {mode === 'register' ? (
            <>
              <h2 className="margin-rule pl-3.5 font-display text-[28px] text-ink-deep">नवीन शिक्षक खाते</h2>
              <p className="mt-1 pl-3.5 text-[15px] text-muted">इयत्ता निवडा, वापरकर्ता नाव व पासवर्ड ठेवा — हे खाते फक्त तुमच्याच वर्गाची माहिती पाहू शकेल.</p>
              <RegisterForm
                showLoginLink={!firstRun}
                onLogin={() => setMode('login')}
                onDone={async (u, p, rem) => {
                  const st = await login(u, p, meta.currentYear, rem);
                  signedIn(st);
                }}
              />
              {firstRun ? (
                <p className="mt-6 border-t border-rule pt-4 text-[13.5px] text-muted">
                  शाळेच्या संगणकावर मुख्याध्यापक (admin) खाते हवे आहे?{' '}
                  <button type="button" className="font-semibold text-ink underline underline-offset-2" onClick={() => setMode('school')}>
                    आधी शाळेची मांडणी करा
                  </button>
                </p>
              ) : null}
            </>
          ) : (
            <>
              <h2 className="margin-rule pl-3.5 font-display text-[28px] text-ink-deep">लॉगिन</h2>
              <p className="mt-1 pl-3.5 text-[15px] text-muted">तुमच्या वर्गाचे वापरकर्ता नाव व पासवर्ड वापरा.</p>
              <form
                className="mt-6 grid gap-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setErr('');
                  if (!username.trim() || !password) {
                    setErr('कृपया वापरकर्ता नाव व पासवर्ड भरा.');
                    return;
                  }
                  setBusy(true);
                  try {
                    const st = await login(username, password, year, remember);
                    signedIn(st);
                  } catch (x) {
                    setErr(x instanceof LoginError ? x.message : 'लॉगिन करताना अडचण आली.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div>
                  <label htmlFor="login-user" className="mb-1 block text-[14px] font-semibold">
                    वापरकर्ता नाव
                  </label>
                  <input
                    id="login-user"
                    className="field-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <label htmlFor="login-pass" className="mb-1 block text-[14px] font-semibold">
                    पासवर्ड
                  </label>
                  <div className="relative">
                    <input
                      id="login-pass"
                      className="field-input pr-12"
                      type={show ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-1 my-auto flex h-10 w-10 items-center justify-center rounded-md text-muted hover:text-ink"
                      onClick={() => setShow((v) => !v)}
                      aria-label={show ? 'पासवर्ड लपवा' : 'पासवर्ड दाखवा'}
                      aria-pressed={show}
                    >
                      <Icon name={show ? 'lock' : 'eye'} size={19} />
                    </button>
                  </div>
                </div>
                {meta.years.length > 1 ? (
                  <div>
                    <label htmlFor="login-year" className="mb-1 block text-[14px] font-semibold">
                      सन निवडा
                    </label>
                    <select id="login-year" className="field-input" value={year} onChange={(e) => setYear(e.target.value)}>
                      {meta.years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <Checkbox label="या उपकरणावर लॉगिन ठेवा (30 दिवस)" hint="इतर शिक्षकही हेच उपकरण वापरत असल्यास हे निवडू नका." checked={remember} onChange={setRemember} />
                {err ? <Notice kind="error">{err}</Notice> : null}
                <Button type="submit" variant="primary" loading={busy} className="w-full text-[17px]">
                  लॉगिन करा
                </Button>
              </form>
              <div className="mt-4 grid gap-2">
                <p className="text-center text-[14px] text-muted">नवीन शिक्षक आहात?</p>
                <Button variant="secondary" className="w-full" icon="plus" onClick={() => setMode('register')}>
                  नवीन खाते तयार करा
                </Button>
              </div>
            </>
          )}

          <div className="mt-8 border-t border-rule pt-5">
            <InstallHint />
            <p className="mt-2 text-[13.5px] text-muted">पहिल्यांदा इंटरनेटवर उघडल्यानंतर लॉगिन व सर्व नोंदी इंटरनेटशिवाय चालतात.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
