/**
 * "पासवर्ड / वापरकर्ता नाव विसरलात?" — mobile OTP → the login IDs linked to
 * the number → a new password.
 */
import { useEffect, useState } from 'react';
import { api, cloudMessage } from '../../lib/cloud/api';
import { normalizePhone } from '../../lib/cloud/account';
import { validatePassword } from '../../lib/validation';
import { Button, Notice, TextField } from '../../components/ui';

type Step = { kind: 'phone' } | { kind: 'code'; phone: string } | { kind: 'reset'; phone: string; token: string; usernames: string[] };

export function RecoverForm({ onDone, onCancel }: { onDone: (username: string) => void; onCancel: () => void }) {
  const [step, setStep] = useState<Step>({ kind: 'phone' });
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function send(num: string) {
    setErr('');
    const p = normalizePhone(num);
    if (!p) return setErr('मोबाईल नंबर 10 अंकी असावा (उदा. 9876543210).');
    setBusy(true);
    try {
      await api.otpSend(p);
      setStep({ kind: 'code', phone: p });
      setCode('');
      setWait(45);
    } catch (e) {
      setErr(cloudMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const masked = (p: string) => `${p.slice(0, 2)}xxxxxx${p.slice(-2)}`;

  return (
    <div className="mt-6 grid gap-4">
      {step.kind === 'phone' ? (
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void send(phone);
          }}
        >
          <p className="text-[15px] text-muted">खाते तयार करताना दिलेला मोबाईल नंबर टाका. त्या नंबरवर SMS ने OTP येईल.</p>
          <TextField label="मोबाईल नंबर" type="tel" inputMode="tel" value={phone} onChange={setPhone} autoComplete="tel" placeholder="9876543210" required />
          {err ? <Notice kind="error">{err}</Notice> : null}
          <Button type="submit" variant="primary" loading={busy} className="w-full">
            OTP पाठवा
          </Button>
        </form>
      ) : null}

      {step.kind === 'code' ? (
        <form
          className="grid gap-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setErr('');
            if (!/^\d{6}$/.test(code.trim())) return setErr('SMS मधील 6 अंकी OTP टाका.');
            setBusy(true);
            try {
              const r = await api.otpVerify(step.phone, code.trim());
              setStep({ kind: 'reset', phone: step.phone, token: r.resetToken, usernames: r.usernames });
              setUsername(r.usernames[0] ?? '');
            } catch (x) {
              setErr(cloudMessage(x));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Notice kind="ok">{masked(step.phone)} या नंबरवर OTP पाठवला आहे. तो 10 मिनिटे चालेल.</Notice>
          <TextField label="OTP" inputMode="numeric" value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} autoComplete="one-time-code" required />
          {err ? <Notice kind="error">{err}</Notice> : null}
          <Button type="submit" variant="primary" loading={busy} className="w-full">
            पुढे
          </Button>
          <Button variant="ghost" disabled={busy || wait > 0} onClick={() => void send(step.phone)}>
            {wait > 0 ? `OTP पुन्हा पाठवा (${wait})` : 'OTP पुन्हा पाठवा'}
          </Button>
        </form>
      ) : null}

      {step.kind === 'reset' ? (
        <form
          className="grid gap-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setErr('');
            const v = validatePassword(pw, pw2);
            if (v) return setErr(v);
            if (!username) return setErr('या नंबरशी जोडलेले खाते सापडले नाही.');
            setBusy(true);
            try {
              const r = await api.resetPassword(step.token, username, pw);
              onDone(r.username);
            } catch (x) {
              setErr(cloudMessage(x));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="rounded-lg border border-rule bg-white p-3">
            <p className="text-[14px] text-muted">{step.usernames.length > 1 ? 'या नंबरशी जोडलेली खाती (वापरकर्ता नाव):' : 'तुमचे वापरकर्ता नाव (लॉगिन आयडी):'}</p>
            {step.usernames.length > 1 ? (
              <div role="radiogroup" aria-label="वापरकर्ता नाव निवडा" className="mt-2 grid gap-2">
                {step.usernames.map((u) => (
                  <label key={u} className="flex items-center gap-2 text-[17px] font-semibold">
                    <input type="radio" name="recover-user" className="h-5 w-5 accent-[#1e3a6e]" checked={username === u} onChange={() => setUsername(u)} />
                    {u}
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[20px] font-bold tracking-wide text-ink-deep" data-testid="recovered-username">
                {step.usernames[0] ?? '—'}
              </p>
            )}
          </div>
          <TextField label="नवीन पासवर्ड" type="password" value={pw} onChange={setPw} autoComplete="new-password" hint="किमान 6 अक्षरे" required />
          <TextField label="नवीन पासवर्ड पुन्हा" type="password" value={pw2} onChange={setPw2} autoComplete="new-password" required />
          {err ? <Notice kind="error">{err}</Notice> : null}
          <Button type="submit" variant="primary" loading={busy} className="w-full" icon="key">
            नवीन पासवर्ड ठेवा
          </Button>
        </form>
      ) : null}

      <Button variant="secondary" className="w-full" onClick={onCancel}>
        लॉगिनकडे परत
      </Button>
    </div>
  );
}
