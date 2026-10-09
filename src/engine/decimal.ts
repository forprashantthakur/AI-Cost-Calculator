import Decimal from 'decimal.js';

/**
 * Decimal-safe arithmetic for every money and unit-price figure.
 * 34 significant digits (IEEE 754 decimal128 precision) — far beyond what any
 * pricing estimate needs, so intermediate results never pick up binary
 * floating-point drift (0.1 + 0.2 !== 0.3).
 */
export const D = Decimal.clone({ precision: 34, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;
export type Num = Dec | number | string;

export const ZERO = new D(0);
export const ONE = new D(1);

export const d = (v: Num | null | undefined): Dec => {
  if (v === null || v === undefined) return ZERO;
  if (typeof v === 'number' && !Number.isFinite(v)) return ZERO;
  return new D(v);
};

export const sum = (...vals: Num[]): Dec => vals.reduce<Dec>((acc, v) => acc.plus(d(v)), ZERO);

/** Safe division: returns null when the denominator is zero (undefined ratio). */
export const div = (a: Num, b: Num): Dec | null => {
  const den = d(b);
  if (den.isZero()) return null;
  return d(a).div(den);
};

/** Percentage (0–100) to fraction (0–1). */
export const pct = (v: Num): Dec => d(v).div(100);

export const clamp = (v: Num, min: Num, max: Num): Dec => D.max(d(min), D.min(d(max), d(v)));

/** Round half-up to `dp` decimal places and return a JS number for display. */
export const n = (v: Dec | null | undefined, dp = 6): number | null =>
  v === null || v === undefined ? null : v.toDecimalPlaces(dp).toNumber();

/** Like n(), but zero instead of null — for totals that are always defined. */
export const n0 = (v: Dec | null | undefined, dp = 6): number => (v ? v.toDecimalPlaces(dp).toNumber() : 0);

/**
 * Price = cost / (1 − margin). Margin is clamped to [0, 95%] so a mistyped
 * 100% margin can never divide by zero.
 */
export const priceFromMargin = (cost: Dec, marginPct: Num): Dec => {
  const m = clamp(pct(marginPct), 0, 0.95);
  return cost.div(ONE.minus(m));
};

/** Gross margin = (revenue − cost) / revenue; null when revenue is zero. */
export const grossMargin = (revenue: Dec, cost: Dec): Dec | null => div(revenue.minus(cost), revenue);
