/** Online-account status in the top bar, and the prompt to put a device-only account online. */
import { useState } from 'react';
import { useOnline } from '../app/pwa';
import { useSession } from '../app/session';
import { CloudError, cloudMessage } from '../lib/cloud/api';
import { linkLocalAccount, rememberedPassword } from '../lib/cloud/account';
import { syncAccount, useSyncStatus } from '../lib/cloud/sync';
import { fmtTime } from '../lib/format';
import { Icon } from './Icon';
import { useFeedback } from './feedback';
import { Button, Modal, Notice, TextField } from './ui';

/** "ऑनलाइन जतन ✓" chip; tapping it syncs now. */
export function CloudBadge() {
  const s = useSyncStatus();
  const online = useOnline();
  const { user } = useSession();
  if (!user?.cloud) return null;
  const label =
    s.kind === 'syncing'
      ? 'जतन होत आहे…'
      : s.kind === 'ok'
        ? 'ऑनलाइन जतन ✓'
        : s.kind === 'auth'
          ? 'पुन्हा लॉगिन करा'
          : s.kind === 'error'
            ? 'ऑनलाइन जतन अडचण'
            : online
              ? 'ऑनलाइन'
              : 'ऑफलाइन — नंतर जतन होईल';
  const warn = s.kind === 'auth' || s.kind === 'error';
  const title =
    s.kind === 'ok'
      ? `सर्व माहिती ऑनलाइन जतन झाली (${fmtTime(s.at)}). आत्ता जतन करण्यासाठी दाबा.`
      : s.kind === 'auth'
        ? 'ऑनलाइन लॉगिन संपले — बाहेर पडून पुन्हा लॉगिन करा. माहिती या उपकरणावर सुरक्षित आहे.'
        : s.kind === 'error'
          ? s.message
          : 'इंटरनेट मिळताच माहिती आपोआप ऑनलाइन जतन होईल.';
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold ${warn ? 'bg-margin text-white' : 'bg-white/12 text-white'}`}
      title={title}
      aria-label={`${label}. ${title}`}
      aria-live="polite"
      onClick={() => void syncAccount(user.id)}
    >
      <Icon name="cloud" size={16} className={s.kind === 'syncing' ? 'animate-pulse' : ''} />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{s.kind === 'ok' ? '✓' : s.kind === 'syncing' ? '…' : warn ? '!' : online ? '' : '×'}</span>
    </button>
  );
}

/** Device-only teacher accounts: offer to make the account online. */
export function LinkBanner() {
  const { user, reloadAll } = useSession();
  const { toast } = useFeedback();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [askName, setAskName] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user || user.role !== 'teacher' || user.cloud) return null;
  const known = rememberedPassword(user.id);

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#f0c987] bg-[#fff8ea] px-4 py-3 text-[15px] text-[#5c3a06]">
        <Icon name="cloud" size={22} />
        <p className="min-w-0 flex-1">
          <b>ही माहिती फक्त या उपकरणावर आहे.</b> ऑनलाइन खाते सुरू करा — मग याच वापरकर्ता नावाने कोणत्याही मोबाईल, टॅबलेट किंवा संगणकावर लॉगिन करता येईल आणि माहिती सुरक्षित राहील.
        </p>
        <Button
          variant="primary"
          size="sm"
          icon="cloud"
          onClick={() => {
            setPhone(user.pendingPhone ?? user.phone ?? '');
            setUsername(user.username);
            setErr('');
            setOpen(true);
          }}
        >
          ऑनलाइन खाते सुरू करा
        </Button>
      </div>
      <Modal open={open} onClose={() => (busy ? undefined : setOpen(false))} title="ऑनलाइन खाते सुरू करा">
        <form
          className="grid gap-3"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setErr('');
            if (!online) return setErr('यासाठी इंटरनेट आवश्यक आहे.');
            setBusy(true);
            try {
              await linkLocalAccount(user.id, known ?? password, phone, askName ? username : undefined);
              setOpen(false);
              toast('ऑनलाइन खाते सुरू झाले. तुमची माहिती ऑनलाइन जतन होत आहे.');
              await reloadAll();
            } catch (x) {
              if (x instanceof CloudError && x.code === 'username_taken') {
                setAskName(true);
                setErr('हे वापरकर्ता नाव ऑनलाइन आधीच दुसऱ्या शिक्षकाने घेतले आहे. नवीन वापरकर्ता नाव निवडा — पुढे लॉगिन करताना तेच वापरा.');
              } else setErr(cloudMessage(x));
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-[15px] text-muted">
            वापरकर्ता नाव <b>{user.username}</b> व तुमचा सध्याचा पासवर्ड तसाच राहील. सर्व वर्गांची माहिती ऑनलाइन जतन होईल.
          </p>
          <TextField
            label="मोबाईल नंबर"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={setPhone}
            autoComplete="tel"
            placeholder="9876543210"
            hint="पासवर्ड किंवा वापरकर्ता नाव विसरल्यास या नंबरवर OTP येईल."
            required
          />
          {known ? null : <TextField label="सध्याचा पासवर्ड" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />}
          {askName ? (
            <TextField
              label="नवीन वापरकर्ता नाव"
              value={username}
              onChange={(v) => setUsername(v.toLowerCase().replace(/\s+/g, ''))}
              hint="इंग्रजी लहान अक्षरे/अंक, उदा. jadhav7"
              autoComplete="username"
              required
            />
          ) : null}
          {err ? <Notice kind="error">{err}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" loading={busy} icon="check">
              सुरू करा
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              नंतर
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
