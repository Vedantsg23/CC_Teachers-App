import { useState } from 'react';
import { isIOS, promptInstall, usePwa } from '../../app/pwa';
import { useSession } from '../../app/session';
import { login, LoginError } from '../../lib/auth';
import { APP_NAME, APP_TITLE } from '../../lib/labels';
import { Icon } from '../../components/Icon';
import { NetworkBadge } from '../../components/layout/AppShell';
import { Button, Checkbox, Modal, Notice } from '../../components/ui';

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

export function LoginPage() {
  const { meta, school, signedIn } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [year, setYear] = useState(meta.currentYear);
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

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
        <div className="w-full max-w-[420px]">
          <div className="mb-6 hidden justify-end lg:flex">
            <NetworkBadge />
          </div>
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
                placeholder="उदा. teacher7"
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
          <div className="mt-8 border-t border-rule pt-5">
            <InstallHint />
            <p className="mt-2 text-[13.5px] text-muted">पहिल्यांदा इंटरनेटवर उघडल्यानंतर लॉगिन व सर्व नोंदी इंटरनेटशिवाय चालतात.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
