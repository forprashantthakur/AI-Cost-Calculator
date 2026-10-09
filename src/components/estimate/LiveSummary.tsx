'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { EstimateResults } from '@/engine/types';
import { moneyCompact, pctFmt, unitPrice } from '@/lib/format';
import { TIPS } from '@/lib/tips';
import { InfoTip, cx } from '@/components/ui';

export function LiveSummary({ res }: { res: EstimateResults }) {
  const cur = res.currency;
  const sel = res.selected;
  const warnings = res.issues.filter((i) => i.level !== 'info');
  const failed = res.checks.filter((c) => !c.pass);
  const rows: { label: string; value: string; tip: string; strong?: boolean; tone?: 'good' | 'bad' }[] = [
    { label: 'Implementation price', value: moneyCompact(res.implementation.price, cur), tip: TIPS.implementationPrice },
    { label: 'Monthly operating cost', value: moneyCompact(res.operating.total, cur), tip: TIPS.monthlyCost },
    { label: 'Cost per successful ABU', value: unitPrice(res.abu.costPerAbuFullyLoaded, cur), tip: TIPS.costPerAbu },
    { label: 'Recommended ABU price', value: unitPrice(res.abu.price, cur), tip: TIPS.abuPrice, strong: true },
    { label: 'Recommended ACU price', value: unitPrice(res.acu.price, cur), tip: TIPS.acuPrice },
    { label: 'Monthly customer charge', value: moneyCompact(sel.mrr, cur), tip: TIPS.monthlyCharge, strong: true },
    { label: 'Provider gross margin', value: pctFmt(sel.recurringMargin), tip: TIPS.grossMargin, tone: (sel.recurringMargin ?? 0) < 0 ? 'bad' : 'good' },
    { label: 'Client 3-year ROI', value: pctFmt(res.value.roi3, 0), tip: TIPS.roi, tone: (res.value.roi3 ?? 0) < 0 ? 'bad' : 'good' },
  ];
  return (
    <aside className="self-start rounded-xl border border-line bg-surface p-4 lg:sticky lg:top-32">
      <div className="text-[11px] font-semibold tracking-wide text-brand uppercase">Live estimate</div>
      <div className="mt-0.5 text-xs text-muted">
        {sel.label} · {sel.structureLabel}
      </div>
      <dl className="mt-3 divide-y divide-line-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 py-2">
            <dt className="flex items-center gap-1 text-xs text-ink-2">
              {r.label}
              <InfoTip text={r.tip} />
            </dt>
            <dd className={cx('num text-sm', r.strong ? 'font-semibold text-ink' : 'font-medium', r.tone === 'good' && 'text-brand', r.tone === 'bad' && 'text-bad')}>{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 space-y-1.5 text-[11px]">
        <div className={cx('flex items-center gap-1.5', failed.length ? 'text-bad' : 'text-brand')}>
          {failed.length ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
          {failed.length ? `${failed.length} reconciliation check(s) failed` : `${res.checks.length} reconciliation checks pass`}
        </div>
        {warnings.length > 0 && (
          <div className="flex items-start gap-1.5 text-warn">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>{warnings[0].message}</span>
          </div>
        )}
      </div>
      <Link href="/dashboard/" className="mt-4 flex h-9 items-center justify-center rounded-lg bg-brand text-sm font-medium text-white hover:bg-brand-600">
        Open dashboard
      </Link>
    </aside>
  );
}
