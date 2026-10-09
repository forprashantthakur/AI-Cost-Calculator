import { CURRENCIES } from '@/data/rateCard';
import type { CurrencyCode } from '@/engine/types';

export const currencyMeta = (c: CurrencyCode) => CURRENCIES.find((x) => x.code === c) ?? CURRENCIES[1];

const dash = '—';

/** Full currency amount, e.g. ₹12,34,567 or $1,234,567. */
export function money(v: number | null | undefined, cur: CurrencyCode, dp?: number): string {
  if (v == null || !Number.isFinite(v)) return dash;
  const m = currencyMeta(cur);
  const abs = Math.abs(v);
  const digits = dp ?? (abs >= 1000 ? 0 : abs >= 1 ? 2 : abs === 0 ? 0 : 4);
  const s = abs.toLocaleString(m.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${v < 0 ? '−' : ''}${m.symbol}${s}`;
}

/** Compact amount for cards: ₹12.3 L, ₹4.56 Cr, $1.2M. */
export function moneyCompact(v: number | null | undefined, cur: CurrencyCode): string {
  if (v == null || !Number.isFinite(v)) return dash;
  const m = currencyMeta(cur);
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (abs < 1000) return money(v, cur);
  if (cur === 'INR') {
    if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
    if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
    return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }
  const s = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(abs);
  return `${sign}${m.symbol}${s}`;
}

/** Unit prices can be tiny (per ACU) — keep enough precision to be meaningful. */
export function unitPrice(v: number | null | undefined, cur: CurrencyCode): string {
  if (v == null || !Number.isFinite(v)) return dash;
  const abs = Math.abs(v);
  const dp = abs >= 100 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return money(v, cur, dp);
}

export function num(v: number | null | undefined, dp = 0, locale = 'en-US'): string {
  if (v == null || !Number.isFinite(v)) return dash;
  return v.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: dp });
}

export function numCompact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return dash;
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

export function pctFmt(v: number | null | undefined, dp = 1): string {
  if (v == null || !Number.isFinite(v)) return dash;
  return `${v.toLocaleString('en-US', { maximumFractionDigits: dp })}%`;
}

export const months = (v: number | null | undefined) => (v == null ? 'No payback' : `${v.toLocaleString('en-US', { maximumFractionDigits: 1 })} months`);

export const dateFmt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
