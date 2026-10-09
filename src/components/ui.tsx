'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, Info, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ------------------------------------------------------------------------- */

export function InfoTip({ text, className }: { text: ReactNode; className?: string }) {
  const id = useId();
  return (
    <span className={cx('group relative inline-flex align-middle', className)}>
      <button type="button" aria-describedby={id} className="text-faint hover:text-brand focus:text-brand" aria-label="More information">
        <Info size={13} strokeWidth={2} />
      </button>
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-md bg-ink px-3 py-2 text-xs leading-relaxed font-normal tracking-normal normal-case text-white shadow-lg group-focus-within:block group-hover:block"
      >
        {text}
      </span>
    </span>
  );
}

export function Card({ children, className, pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <section className={cx('rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]', pad && 'p-5', className)}>{children}</section>;
}

export function CardTitle({ children, tip, action, sub }: { children: ReactNode; tip?: ReactNode; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
          {children}
          {tip && <InfoTip text={tip} />}
        </h2>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tip,
  tone = 'default',
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tip?: ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad';
  emphasis?: boolean;
}) {
  return (
    <div className={cx('rounded-xl border bg-surface p-4', emphasis ? 'border-brand/40 ring-1 ring-brand/10' : 'border-line')}>
      <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
        {label}
        {tip && <InfoTip text={tip} />}
      </div>
      <div
        className={cx(
          'num mt-2 text-2xl font-semibold tracking-tight',
          tone === 'good' && 'text-brand',
          tone === 'warn' && 'text-warn',
          tone === 'bad' && 'text-bad',
          tone === 'default' && 'text-ink',
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'warn' | 'bad' | 'info'; className?: string }) {
  const t = {
    neutral: 'bg-line-2 text-ink-2',
    brand: 'bg-brand-50 text-brand-700',
    warn: 'bg-warn-50 text-warn',
    bad: 'bg-bad-50 text-bad',
    info: 'bg-info-50 text-info',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', t, className)}>{children}</span>;
}

type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  title?: string;
};

export function Button({ children, onClick, href, variant = 'secondary', size = 'md', disabled, type = 'button', className, title }: BtnProps) {
  const cls = cx(
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-sm',
    variant === 'primary' && 'bg-brand text-white hover:bg-brand-600',
    variant === 'secondary' && 'border border-line bg-surface text-ink hover:bg-canvas',
    variant === 'ghost' && 'text-ink-2 hover:bg-line-2',
    variant === 'danger' && 'border border-bad/30 bg-surface text-bad hover:bg-bad-50',
    className,
  );
  if (href)
    return (
      <Link href={href} className={cls} title={title}>
        {children}
      </Link>
    );
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} title={title}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------------- */
/*  Form fields                                                              */
/* ------------------------------------------------------------------------- */

export function FieldShell({ label, tip, hint, children, error, className }: { label: ReactNode; tip?: ReactNode; hint?: ReactNode; children: ReactNode; error?: string; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-2">
        {label}
        {tip && <InfoTip text={tip} />}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[11px] text-bad">{error}</span> : hint ? <span className="mt-1 block text-[11px] text-faint">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  'h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none disabled:bg-canvas disabled:text-muted';

/** Numeric input that lets you type freely (empty, decimals) and commits valid numbers. */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  prefix,
  placeholder,
  disabled,
  nullable,
  className,
  ariaLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  prefix?: string;
  placeholder?: string;
  disabled?: boolean;
  nullable?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    const parsed = text.trim() === '' ? null : Number(text);
    if (parsed !== value) setText(value == null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const commit = (t: string) => {
    if (t.trim() === '') {
      if (nullable) onChange(null);
      return;
    }
    let v = Number(t);
    if (!Number.isFinite(v)) return;
    if (min != null && v < min) v = min;
    if (max != null && v > max) v = max;
    onChange(v);
  };
  return (
    <div className={cx('relative', className)}>
      {prefix && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">{prefix}</span>}
      <input
        type="number"
        inputMode="decimal"
        aria-label={ariaLabel}
        className={cx(inputCls, 'num', prefix && 'pl-8', suffix && 'pr-12')}
        value={text}
        min={min}
        max={max}
        step={step ?? 'any'}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => setText(value == null ? '' : String(value))}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">{suffix}</span>}
    </div>
  );
}

export function NumberField(props: Parameters<typeof NumberInput>[0] & { label: ReactNode; tip?: ReactNode; hint?: ReactNode; className?: string }) {
  const { label, tip, hint, className, ...rest } = props;
  return (
    <FieldShell label={label} tip={tip} hint={hint} className={className}>
      <NumberInput {...rest} ariaLabel={typeof label === 'string' ? label : undefined} />
    </FieldShell>
  );
}

export function TextInput({ value, onChange, placeholder, disabled }: { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return <input className={inputCls} value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
}

export function TextField({ label, tip, hint, value, onChange, placeholder, className }: { label: ReactNode; tip?: ReactNode; hint?: ReactNode; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <FieldShell label={label} tip={tip} hint={hint} className={className}>
      <TextInput value={value} onChange={onChange} placeholder={placeholder} />
    </FieldShell>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
  groups,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options?: { value: T; label: string }[];
  groups?: { label: string; options: { value: T; label: string }[] }[];
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className="relative">
      <select aria-label={ariaLabel} className={cx(inputCls, 'appearance-none pr-8')} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
        {options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {groups?.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function SelectField<T extends string>(props: Parameters<typeof Select<T>>[0] & { label: ReactNode; tip?: ReactNode; hint?: ReactNode; className?: string }) {
  const { label, tip, hint, className, ...rest } = props;
  return (
    <FieldShell label={label} tip={tip} hint={hint} className={className}>
      <Select {...rest} ariaLabel={typeof label === 'string' ? label : undefined} />
    </FieldShell>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-canvas p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-md font-medium transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === o.value ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, tip }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; tip?: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2 select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-brand' : 'bg-line')}
      >
        <span className={cx('absolute top-0.5 left-0 h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
      </button>
      {label}
      {tip && <InfoTip text={tip} />}
    </label>
  );
}

export function Collapsible({ title, sub, children, defaultOpen = false, badge }: { title: ReactNode; sub?: ReactNode; children: ReactNode; defaultOpen?: boolean; badge?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-line bg-surface">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left">
        <span>
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            {title}
            {badge}
          </span>
          {sub && <span className="mt-0.5 block text-xs text-muted">{sub}</span>}
        </span>
        <ChevronDown size={16} className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-line-2 px-5 py-4">{children}</div>}
    </div>
  );
}

export function Callout({ tone = 'info', children, title }: { tone?: 'info' | 'warn' | 'bad' | 'good'; children: ReactNode; title?: ReactNode }) {
  const map = {
    info: { cls: 'border-info/20 bg-info-50 text-info', Icon: Info },
    warn: { cls: 'border-warn/20 bg-warn-50 text-warn', Icon: AlertTriangle },
    bad: { cls: 'border-bad/20 bg-bad-50 text-bad', Icon: XCircle },
    good: { cls: 'border-brand/20 bg-brand-50 text-brand-700', Icon: CheckCircle2 },
  }[tone];
  const Icon = map.Icon;
  return (
    <div className={cx('flex gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed', map.cls)}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="text-ink-2">
        {title && <div className="font-semibold text-ink">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, actions, eyebrow }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-medium tracking-wide text-brand uppercase">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-1 max-w-3xl text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Th({ children, className, right }: { children?: ReactNode; className?: string; right?: boolean }) {
  return <th className={cx('border-b border-line px-3 py-2 text-[11px] font-semibold tracking-wide text-muted uppercase', right ? 'text-right' : 'text-left', className)}>{children}</th>;
}

export function Td({ children, className, right, strong, colSpan }: { children?: ReactNode; className?: string; right?: boolean; strong?: boolean; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cx('border-b border-line-2 px-3 py-2 text-sm', right && 'num text-right', strong && 'font-semibold text-ink', className)}>
      {children}
    </td>
  );
}

export function Slider({ value, onChange, min, max, step = 1, label, display, tip }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; label: ReactNode; display: ReactNode; tip?: ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
          {label}
          {tip && <InfoTip text={tip} />}
        </span>
        <span className="num text-xs font-semibold text-ink">{display}</span>
      </div>
      <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={typeof label === 'string' ? label : undefined} />
    </div>
  );
}
