'use client';

import { FileDown } from 'lucide-react';
import { useStore } from '@/store/store';
import { useEstimate } from '@/lib/useEstimate';
import { MODEL_KEYS, COST_POOLS, type ModelKey, type ModelResult } from '@/engine/types';
import { money, moneyCompact, pctFmt, unitPrice } from '@/lib/format';
import { TIPS } from '@/lib/tips';
import { NoEstimate } from '@/components/Shell';
import { Badge, Button, Card, CardTitle, PageHeader, Td, Th, cx } from '@/components/ui';
import { ModelPicker, RecommendationCard } from '@/components/pricing';
import { CommercialTermsEditor } from '@/components/CommercialTermsEditor';
import { ModelCompareChart, ThreeYearModelsChart, POOL_META } from '@/components/charts';
import { exportPdf } from '@/lib/export/download';

export default function ComparePage() {
  const { est, res, update } = useEstimate();
  const rc = useStore((s) => s.rateCard);
  const log = useStore((s) => s.log);
  if (!est || !res) return <NoEstimate />;
  const cur = res.currency;
  const M = res.models;

  const rows: { label: string; tip?: string; get: (m: ModelResult) => string; neg?: (m: ModelResult) => boolean }[] = [
    { label: 'Implementation revenue', get: (m) => money(m.implementationRevenue, cur) },
    { label: 'Monthly recurring revenue', tip: TIPS.monthlyCharge, get: (m) => money(m.mrr, cur) },
    { label: 'Annual revenue (year 1)', tip: TIPS.annualRevenue, get: (m) => money(m.annualRevenue, cur) },
    { label: 'Monthly delivery cost (provider)', get: (m) => money(m.monthlyDeliveryCost, cur) },
    { label: 'Annual delivery cost (incl. implementation)', get: (m) => money(m.annualDeliveryCost, cur) },
    { label: 'Annual gross profit', get: (m) => money(m.annualGrossProfit, cur), neg: (m) => m.annualGrossProfit < 0 },
    { label: 'Recurring gross margin', tip: TIPS.grossMargin, get: (m) => pctFmt(m.recurringMargin), neg: (m) => (m.recurringMargin ?? 0) < 0 },
    { label: 'Annual gross margin', get: (m) => pctFmt(m.annualGrossMargin), neg: (m) => (m.annualGrossMargin ?? 0) < 0 },
    { label: 'Cost per agent / month', get: (m) => money(m.costPerAgent, cur) },
    { label: 'Cost per ABU', get: (m) => unitPrice(m.costPerAbu, cur) },
    { label: 'Cost per ACU', get: (m) => unitPrice(m.costPerAcu, cur) },
    { label: 'Client pass-through / month', get: (m) => money(m.clientPassThroughMonthly, cur) },
    { label: 'Client total monthly cost', get: (m) => money(m.clientMonthlyCost, cur) },
    { label: 'Three-year revenue', get: (m) => money(m.threeYear.revenue, cur) },
    { label: 'Three-year gross profit', get: (m) => money(m.threeYear.grossProfit, cur), neg: (m) => m.threeYear.grossProfit < 0 },
    { label: 'Total contract value', tip: TIPS.tcv, get: (m) => money(m.tcv, cur) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compare Models — commercial model comparison"
        title="Seven commercial models, one cost base"
        sub="Every model prices the same delivery cost. The cost-recovery matrix proves that each cost is recovered exactly once — never twice."
        actions={
          <Button size="sm" onClick={() => exportPdf('compare', est, res, rc).then((ok) => ok && log('Exported PDF', `Commercial Model Comparison — ${est.name}`))}>
            <FileDown size={14} /> Comparison PDF
          </Button>
        }
      />
      <RecommendationCard res={res} est={est} update={update} />

      <Card>
        <CardTitle sub="Click a model to make it the selected structure for the dashboard, ROI and reports.">Select a model</CardTitle>
        <ModelPicker res={res} est={est} update={update} />
      </Card>

      <Card pad={false}>
        <div className="p-5 pb-0">
          <CardTitle sub="Year 1 unless stated. Year 2–3 include volume growth and annual price escalation.">Side-by-side comparison</CardTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr>
                <Th className="pl-5">Metric</Th>
                {MODEL_KEYS.map((k) => (
                  <Th key={k} right className={cx(k === res.selectedModel && 'bg-brand-50 text-brand-700')}>
                    {M[k].label}
                    {k === res.recommendation.model && <div className="font-normal tracking-normal normal-case text-brand">recommended</div>}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td className="pl-5 text-muted">Structure</Td>
                {MODEL_KEYS.map((k) => (
                  <Td key={k} right className={cx('text-[11px] text-muted', k === res.selectedModel && 'bg-brand-50/60')}>
                    {M[k].structureLabel}
                  </Td>
                ))}
              </tr>
              {rows.map((r) => (
                <tr key={r.label}>
                  <Td className="pl-5 text-ink">{r.label}</Td>
                  {MODEL_KEYS.map((k) => (
                    <Td key={k} right className={cx(k === res.selectedModel && 'bg-brand-50/60', r.neg?.(M[k]) && 'text-bad')}>
                      {r.get(M[k])}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle sub="Monthly revenue and delivery cost (bars), recurring margin (line)">Year-1 monthly economics</CardTitle>
          <ModelCompareChart res={res} highlight={res.selectedModel} />
        </Card>
        <Card>
          <CardTitle sub="Revenue and gross profit over the first three years">Three-year revenue projection</CardTitle>
          <ThreeYearModelsChart res={res} />
        </Card>
      </div>

      <Card>
        <CardTitle tip={TIPS.recovery} sub="Which revenue component recovers each cost pool. 'client' = paid by the client at cost; 'at-risk' = carried by the provider under gainshare.">
          Cost-recovery matrix — duplicate recovery prevention
        </CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <Th>Model</Th>
                {COST_POOLS.map((p) => (
                  <Th key={p}>
                    {POOL_META[p].label}
                    <div className="font-normal tracking-normal normal-case">{moneyCompact(res.operating.pools[p], cur)}/mo</div>
                  </Th>
                ))}
                <Th>Check</Th>
              </tr>
            </thead>
            <tbody>
              {MODEL_KEYS.map((k: ModelKey) => (
                <tr key={k}>
                  <Td className="font-medium text-ink">{M[k].label}</Td>
                  {COST_POOLS.map((p) => (
                    <Td key={p}>
                      {M[k].recovery[p].length ? (
                        M[k].recovery[p].map((c) => (
                          <Badge key={c} tone={c === 'client' ? 'info' : c === 'at-risk' ? 'warn' : 'brand'}>
                            {c}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </Td>
                  ))}
                  <Td>{M[k].doubleRecovery ? <Badge tone="bad">Double recovery</Badge> : M[k].unrecovered.length ? <Badge tone="warn">Unrecovered</Badge> : <Badge tone="brand">Once each ✓</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MODEL_KEYS.map((k) => {
          const m = M[k];
          return (
            <Card key={k} className={k === res.selectedModel ? 'border-brand/40' : ''}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{m.label}</div>
                  <div className="text-xs text-muted">{m.description}</div>
                </div>
                {k === res.selectedModel && <Badge tone="brand">Selected</Badge>}
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {m.components.map((c) => (
                  <li key={c.key} className="flex items-start justify-between gap-3">
                    <span>
                      <span className="text-ink">{c.label}</span>
                      <span className="block text-[11px] text-muted">{c.basis}</span>
                    </span>
                    <span className="num font-medium">{money(c.monthly, cur)}</span>
                  </li>
                ))}
              </ul>
              {m.notes.map((n) => (
                <p key={n} className="mt-2 text-[11px] text-warn">
                  {n}
                </p>
              ))}
            </Card>
          );
        })}
      </div>

      <CommercialTermsEditor est={est} res={res} update={update} defaultOpen />
    </div>
  );
}
