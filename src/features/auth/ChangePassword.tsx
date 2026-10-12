import { useState } from 'react';
import { useSession } from '../../app/session';
import { changeOwnPassword } from '../../lib/auth';
import { Button, Modal, Notice, TextField } from '../../components/ui';
import { useFeedback } from '../../components/feedback';

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const { user } = useSession();
  const { toast } = useFeedback();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [conf, setConf] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  return (
    <form
      className="grid max-w-md gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr('');
        setBusy(true);
        try {
          await changeOwnPassword(user.id, cur, next, conf);
          setCur('');
          setNext('');
          setConf('');
          toast('पासवर्ड बदलला.');
          onDone?.();
        } catch (x) {
          setErr(x instanceof Error ? x.message : String(x));
        } finally {
          setBusy(false);
        }
      }}
    >
      <TextField label="सध्याचा पासवर्ड" type="password" value={cur} onChange={setCur} autoComplete="current-password" required />
      <TextField label="नवीन पासवर्ड" type="password" value={next} onChange={setNext} autoComplete="new-password" hint="किमान 6 अक्षरे" required />
      <TextField label="नवीन पासवर्ड पुन्हा" type="password" value={conf} onChange={setConf} autoComplete="new-password" required />
      {err ? <Notice kind="error">{err}</Notice> : null}
      <div>
        <Button type="submit" variant="primary" loading={busy} icon="key">
          पासवर्ड बदला
        </Button>
      </div>
    </form>
  );
}

/** Shown after an admin reset: the user must set their own password. */
export function ChangePasswordModal({ forced }: { forced?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <Modal open={open} onClose={() => (forced ? undefined : setOpen(false))} title="नवीन पासवर्ड ठेवा">
      <p className="mb-3 text-[15px] text-muted">मुख्याध्यापकांनी तुमचा पासवर्ड बदलला आहे. सुरक्षिततेसाठी आता स्वतःचा नवीन पासवर्ड ठेवा.</p>
      <ChangePasswordForm onDone={() => setOpen(false)} />
    </Modal>
  );
}
