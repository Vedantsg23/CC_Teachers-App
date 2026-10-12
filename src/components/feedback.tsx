/** Toasts and confirmation dialogs. */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Button, Modal } from './ui';

type ToastKind = 'ok' | 'error' | 'info';
interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}

interface ConfirmOpts {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface FeedbackApi {
  toast: (text: string, kind?: ToastKind) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
}

const Ctx = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const seq = useRef(0);

  const toast = useCallback((text: string, kind: ToastKind = 'ok') => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);

  const confirm = useCallback((o: ConfirmOpts) => {
    setDialog(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setDialog(null);
  };

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-3" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-in pointer-events-auto flex max-w-md items-start gap-2 rounded-lg px-4 py-3 text-[15px] text-white shadow-lg ${
              t.kind === 'error' ? 'bg-margin' : t.kind === 'info' ? 'bg-ink-deep' : 'bg-[#16613b]'
            }`}
            role={t.kind === 'error' ? 'alert' : 'status'}
          >
            <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'info' ? 'info' : 'check'} size={19} className="mt-0.5" />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      <Modal
        open={!!dialog}
        onClose={() => close(false)}
        title={dialog?.title ?? ''}
        footer={
          <>
            <Button onClick={() => close(false)}>{dialog?.cancelLabel ?? 'रद्द करा'}</Button>
            <Button variant={dialog?.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
              {dialog?.confirmLabel ?? 'होय'}
            </Button>
          </>
        }
      >
        <div className="text-[15.5px] leading-relaxed">{dialog?.message}</div>
      </Modal>
    </Ctx.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('FeedbackProvider missing');
  return c;
}
