import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon, type IconName } from './Icon';

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: IconName; loading?: boolean }) {
  return (
    <button type={type} className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`} disabled={rest.disabled || loading} {...rest}>
      {loading ? <Spinner /> : icon ? <Icon name={icon} size={size === 'sm' ? 17 : 19} /> : null}
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = 'secondary', size = 'md', icon, children, className = '' }: { to: string; variant?: Variant; size?: 'sm' | 'md'; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 17 : 19} /> : null}
      {children}
    </Link>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} role="status" aria-label="लोड होत आहे" />;
}

/* ------------------------------------------------------------------ */
/* Form fields                                                         */
/* ------------------------------------------------------------------ */

interface FieldBase {
  label: string;
  error?: string;
  warning?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

function FieldShell({ id, label, error, warning, hint, required, className = '', children }: FieldBase & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-[14px] font-semibold text-text">
        {label}
        {required ? (
          <span className="text-margin" aria-hidden>
            {' *'}
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="mt-1 text-[13.5px] text-margin" role="alert">
          {error}
        </p>
      ) : warning ? (
        <p id={`${id}-msg`} className="mt-1 text-[13.5px] text-turmeric">
          {warning}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="mt-1 text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  error,
  warning,
  hint,
  required,
  className,
  type = 'text',
  inputMode,
  placeholder,
  autoComplete,
  maxLength,
  disabled,
  name,
  onBlur,
  list,
  autoFocus,
}: FieldBase & {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email';
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  disabled?: boolean;
  name?: string;
  onBlur?: () => void;
  list?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} warning={warning} hint={hint} required={required} className={className}>
      <input
        id={id}
        name={name}
        className="field-input"
        type={type}
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        disabled={disabled}
        list={list}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={error || warning || hint ? `${id}-msg` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </FieldShell>
  );
}

export interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  warning,
  hint,
  required,
  className,
  disabled,
}: FieldBase & { value: string; onChange: (v: string) => void; options: Option[]; placeholder?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} warning={warning} hint={hint} required={required} className={className}>
      <select
        id={id}
        className="field-input"
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || warning || hint ? `${id}-msg` : undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function AreaField({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  className,
  rows = 3,
  placeholder,
  maxLength,
}: FieldBase & { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; maxLength?: number }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required} className={className}>
      <textarea
        id={id}
        className="field-input"
        rows={rows}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  );
}

/** Compact select without label chrome (toolbars). */
export function InlineSelect({ value, onChange, options, label, className = '' }: { value: string; onChange: (v: string) => void; options: Option[]; label: string; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col ${className}`}>
      <span className="mb-1 text-[13px] font-semibold text-muted">{label}</span>
      <select className="field-input" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Checkbox({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#1e3a6e]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id} className="text-[15px] leading-snug">
        {label}
        {hint ? <span className="mt-0.5 block text-[13px] text-muted">{hint}</span> : null}
      </label>
    </div>
  );
}

/** Two–four option toggle (e.g. प्रथम / द्वितीय सत्र). */
export function Segmented<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-rule-strong bg-white p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-[38px] rounded-md px-3.5 text-[15px] font-semibold transition-colors ${on ? 'bg-ink text-white' : 'text-ink hover:bg-ink-soft'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: string }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back ? (
          <Link to={back} className="mb-1 inline-flex items-center gap-1 text-[14px] font-semibold text-ink hover:underline">
            <Icon name="left" size={16} /> मागे
          </Link>
        ) : null}
        <h1 className="margin-rule pl-3.5 font-display text-[26px] leading-tight text-ink-deep md:text-[30px]">{title}</h1>
        {subtitle ? <div className="mt-1 pl-3.5 text-[14.5px] text-muted">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({ children, className = '', title, actions }: { children: ReactNode; className?: string; title?: string; actions?: ReactNode }) {
  return (
    <section className={`panel p-4 md:p-5 ${className}`}>
      {title || actions ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="text-[18px] font-semibold text-ink-deep">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({ icon = 'info', title, text, action }: { icon?: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 rounded-full bg-ink-soft p-3 text-ink">
        <Icon name={icon} size={26} />
      </div>
      <p className="text-[17px] font-semibold text-text">{title}</p>
      {text ? <p className="mt-1 max-w-md text-[14.5px] text-muted">{text}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ProgressBar({ value, label, detail }: { value: number; label: string; detail?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[14.5px]">
        <span className="font-semibold">{label}</span>
        <span className="tabular text-muted">{detail ?? `${v}%`}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#e3e9f1]" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full rounded-full ${v >= 100 ? 'bg-leaf' : 'bg-ink'}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'error' | 'ok'; children: ReactNode }) {
  const styles = {
    info: 'border-[#c8d6ea] bg-ink-soft text-ink-deep',
    warn: 'border-[#ecd2a8] bg-turmeric-soft text-[#6b3e05]',
    error: 'border-[#f0c4c1] bg-margin-soft text-[#8a1f19]',
    ok: 'border-[#bfe0cb] bg-leaf-soft text-[#145234]',
  }[kind];
  const icon: IconName = kind === 'ok' ? 'check' : kind === 'info' ? 'info' : 'alert';
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[14.5px] ${styles}`} role={kind === 'error' ? 'alert' : undefined}>
      <Icon name={icon} size={18} className="mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal (native <dialog>)                                             */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      try {
        d.showModal();
      } catch {
        d.setAttribute('open', '');
      }
    } else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={`m-auto w-[calc(100%-24px)] ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-xl border border-rule bg-white p-0 text-text shadow-2xl backdrop:bg-[#0f1f3d]/45`}
      aria-labelledby="modal-title"
    >
      {open ? (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
            <h2 id="modal-title" className="text-[18px] font-semibold text-ink-deep">
              {title}
            </h2>
            <button type="button" className="btn btn-ghost btn-sm -mr-2" onClick={onClose} aria-label="बंद करा">
              <Icon name="x" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-rule px-5 py-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

export function StatCard({ label, value, sub, tone = 'ink' }: { label: string; value: ReactNode; sub?: string; tone?: 'ink' | 'leaf' | 'margin' | 'turmeric' }) {
  const color = { ink: 'text-ink-deep', leaf: 'text-leaf', margin: 'text-margin', turmeric: 'text-turmeric' }[tone];
  return (
    <div className="panel px-4 py-3">
      <div className="text-[13.5px] font-semibold text-muted">{label}</div>
      <div className={`tabular mt-0.5 text-[28px] leading-tight font-bold ${color}`}>{value}</div>
      {sub ? <div className="text-[13px] text-muted">{sub}</div> : null}
    </div>
  );
}
