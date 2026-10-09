'use client';

import { useMemo, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/store';
import { useEstimate } from '@/lib/useEstimate';
import { newId } from '@/data/templates';
import { presetLevers, runScenario, PRESET_INFO, applyLevers, type ScenarioLevers, type ScenarioPreset } from '@/engine/scenario';
import type { Complexity, EstimateResults } from '@/engine/types';
import { currencyMeta, money, moneyCompact, num, pctFmt, unitPrice } from '@/lib/format';
import { NoEstimate } from '@/components/Shell';
import { Badge, Button, Callout, Card, CardTitle, FieldShell, NumberInput, PageHeader, Segmented, Select, Slider, Td, Th, cx } from '@/components/ui';
import { ScenarioChart } from '@/components/charts';

export default function SimulatorPage() {
  const { est, res } = useEstimate();
  const rc = useStore((s) => s.rateCard);
  const router = useRouter();
  const [levers, setLevers] = useState<ScenarioLevers>({});
  const [active, setActive] = useState<ScenarioPreset | 'custom'>('baseline');

  const runs = useMemo(() => {
    if (!est || !res) return null;
    const presets = (['baseline', 'optimized', 'stress'] as ScenarioPreset[]).map((p) => ({ key: p, label: PRESET_INFO[p].label, run: runScenario(est, res, presetLevers(p, est), rc) }));
    const custom = { key: 'custom' as const, label: 'Custom', run: runScenario(est, res, levers, rc) };
    return { presets, custom };
  }, [est, res, rc, levers]);

  if (!est || !res || !runs) return <NoEstimate />;
  const cur = res.currency;
  const sym = currencyMeta(cur).symbol.trim();
  const base = res;
  const custom = runs.custom.run;
  const set = (patch: ScenarioLevers) => {
    setLevers((l) => ({ ...l, ...patch }));
    setActive('custom');
  };
  const vf = levers.volumeFactor ?? 1;
  const baseAgentOps = base.operating.pools.agentops;

  const metric = (r: EstimateResults, lockedR: EstimateResults) => ({
    cost: r.operating.total,
    acuCost: r.acu.deliveryCostPerAcu,
    abuCost: r.abu.costPerAbuFullyLoaded,
    abuPrice: r.abu.price,
    acuPrice: r.acu.price,
    mrrRepriced: r.selected.mrr,
    gpLocked: lockedR.selected.monthlyGrossProfit,
    gmLocked: lockedR.selected.recurringMargin,
    gpRepriced: r.selected.monthlyGrossProfit,
    roi: lockedR.value.roi3,
  });
  const all = [...runs.presets, runs.custom].map((x) => ({ key: x.key, label: x.label, ...metric(x.run.repriced, x.run.locked) }));
  const b = all[0];
  const c = all[3];

  const delta = (now: number | null, was: number | null) => {
    if (now == null || was == null || was === 0) return null;
    const d = ((now - was) / Math.abs(was)) * 100;
    if (Math.abs(d) < 0.05) return null;
    return <span className={cx('ml-1.5 text-[11px] font-medium', d > 0 ? 'text-warn' : 'text-brand')}>{d > 0 ? '+' : ''}{d.toFixed(1)}%</span>;
  };

  const saveAsEstimate = () => {
    const inputs = applyLevers(est, levers);
    const copy = { ...inputs, id: newId(), name: `${est.name} — scenario`, isSample: false, status: 'draft' as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    useStore.setState((s) => ({ estimates: [copy, ...s.estimates], currentId: copy.id }));
    useStore.getState().log('Saved scenario as estimate', copy.name);
    router.push('/dashboard/');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Scenario Simulator — what-if analysis"
        title="How do volume, model and automation rate change the price?"
        sub="Move a lever and every figure recalculates instantly. 'Repriced' re-sets prices from the new costs (what you would quote now); 'locked prices' holds today's prices (what happens to margin on a signed deal)."
        actions={
          <>
            <Button size="sm" onClick={() => { setLevers({}); setActive('baseline'); }}>
              <RotateCcw size={14} /> Reset
            </Button>
            <Button size="sm" variant="primary" onClick={saveAsEstimate} disabled={Object.keys(levers).length === 0}>
              <Save size={14} /> Save scenario as estimate
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(['baseline', 'optimized', 'stress'] as ScenarioPreset[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setLevers(presetLevers(p, est));
              setActive(p);
            }}
            className={cx('rounded-xl border px-4 py-2.5 text-left transition-colors', active === p ? 'border-brand bg-brand-50' : 'border-line bg-surface hover:border-brand/40')}
          >
            <div className="text-sm font-semibold">{PRESET_INFO[p].label}</div>
            <div className="max-w-xs text-[11px] text-muted">{PRESET_INFO[p].description}</div>
          </button>
        ))}
        {active === 'custom' && <Badge tone="info" className="self-center">Custom levers</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardTitle sub="Starting point: the current estimate">Levers</CardTitle>
          <div className="space-y-5">
            <Slider label="Transaction volume" min={0.1} max={3} step={0.05} value={vf} onChange={(v) => set({ volumeFactor: v })} display={`${num(base.volume.submitted * vf)} / month (${Math.round(vf * 100)}%)`} />
            <Slider label="AI completion rate" min={5} max={100} step={1} value={levers.successRate ?? est.successRate} onChange={(v) => set({ successRate: v })} display={`${levers.successRate ?? est.successRate}%`} />
            <FieldShell label="LLM model">
              <Select value={levers.modelId ?? est.modelId} onChange={(v) => set({ modelId: v })} options={rc.models.map((m) => ({ value: m.id, label: m.name }))} ariaLabel="LLM model" />
            </FieldShell>
            <Slider label="Token consumption" min={0.3} max={2.5} step={0.05} value={levers.tokenFactor ?? 1} onChange={(v) => set({ tokenFactor: v })} display={`${Math.round((levers.tokenFactor ?? 1) * 100)}% of baseline`} />
            <Slider label="Number of AI agents" min={1} max={Math.max(20, est.agents * 2)} step={1} value={levers.agents ?? est.agents} onChange={(v) => set({ agents: v })} display={`${levers.agents ?? est.agents}`} />
            <Slider
              label="AgentOps cost / month"
              min={0}
              max={Math.max(1, Math.round(baseAgentOps * 3))}
              step={Math.max(1, Math.round(baseAgentOps / 100))}
              value={levers.agentOpsMonthly ?? baseAgentOps}
              onChange={(v) => set({ agentOpsMonthly: v })}
              display={moneyCompact(levers.agentOpsMonthly ?? baseAgentOps, cur)}
            />
            <FieldShell label="Process complexity">
              <Segmented<Complexity>
                size="sm"
                value={levers.complexity ?? est.complexity}
                onChange={(v) => set({ complexity: v })}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
              />
            </FieldShell>
            <Slider label="Target gross margin" min={0} max={80} step={1} value={levers.targetMargin ?? est.targetMargin} onChange={(v) => set({ targetMargin: v })} display={`${levers.targetMargin ?? est.targetMargin}%`} />
            <FieldShell label={`Subscription price per ${est.commercial.subscriptionUnit} / month`} hint={`Baseline: ${money(base.prices.subscriptionUnitPrice, cur)} (subscription) · ${money(base.prices.hybridSubUnitPrice, cur)} (hybrid platform fee)`}>
              <NumberInput value={levers.subscriptionPrice ?? null} nullable onChange={(v) => set({ subscriptionPrice: v })} prefix={sym} placeholder="Auto" min={0} ariaLabel="Subscription price" />
            </FieldShell>
          </div>
        </Card>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ResultCard label="Monthly delivery cost" now={money(c.cost, cur)} was={`Baseline ${money(b.cost, cur)}`} d={delta(c.cost, b.cost)} />
            <ResultCard label="Cost per ACU" now={unitPrice(c.acuCost, cur)} was={`Baseline ${unitPrice(b.acuCost, cur)}`} d={delta(c.acuCost, b.acuCost)} />
            <ResultCard label="Cost per ABU" now={unitPrice(c.abuCost, cur)} was={`Baseline ${unitPrice(b.abuCost, cur)}`} d={delta(c.abuCost, b.abuCost)} />
            <ResultCard label="Recommended selling price" now={`${unitPrice(c.abuPrice, cur)} / ABU`} was={`Baseline ${unitPrice(b.abuPrice, cur)} · ACU ${unitPrice(c.acuPrice, cur)}`} d={delta(c.abuPrice, b.abuPrice)} />
            <ResultCard
              label="Provider gross profit (locked prices)"
              now={`${moneyCompact(c.gpLocked, cur)} / mo`}
              was={`margin ${pctFmt(c.gmLocked)} · repriced ${moneyCompact(c.gpRepriced, cur)}`}
              d={delta(c.gpLocked, b.gpLocked)}
              tone={c.gpLocked < 0 ? 'bad' : undefined}
            />
            <ResultCard label="Client 3-year ROI (locked prices)" now={pctFmt(c.roi, 0)} was={`baseline ${pctFmt(b.roi, 0)}`} tone={(c.roi ?? 0) < 0 ? 'bad' : undefined} />
          </div>

          {custom.locked.selected.recurringMargin != null && custom.locked.selected.recurringMargin < 0 && (
            <Callout tone="bad">At today&apos;s prices this scenario runs at a loss. Re-price, add a minimum commitment, or move to a structure that recovers the fixed costs.</Callout>
          )}

          <Card>
            <CardTitle sub={`Selected model: ${base.selected.label} (${base.selected.structureLabel})`}>Baseline, Optimized, Stress and Custom</CardTitle>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr>
                    <Th>Metric</Th>
                    {all.map((x) => (
                      <Th key={x.key} right className={cx(active === x.key && 'bg-brand-50 text-brand-700')}>
                        {x.label}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Monthly delivery cost', (x: (typeof all)[number]) => money(x.cost, cur)],
                    ['Cost per ACU', (x: (typeof all)[number]) => unitPrice(x.acuCost, cur)],
                    ['Cost per ABU', (x: (typeof all)[number]) => unitPrice(x.abuCost, cur)],
                    ['Recommended ABU price (repriced)', (x: (typeof all)[number]) => unitPrice(x.abuPrice, cur)],
                    ['Recommended ACU price (repriced)', (x: (typeof all)[number]) => unitPrice(x.acuPrice, cur)],
                    ['Monthly charge (repriced)', (x: (typeof all)[number]) => money(x.mrrRepriced, cur)],
                    ['Gross profit / month (locked prices)', (x: (typeof all)[number]) => money(x.gpLocked, cur)],
                    ['Gross margin (locked prices)', (x: (typeof all)[number]) => pctFmt(x.gmLocked)],
                    ['Client 3-year ROI (locked prices)', (x: (typeof all)[number]) => pctFmt(x.roi, 0)],
                  ].map(([label, fn]) => (
                    <tr key={label as string}>
                      <Td className="text-ink">{label as string}</Td>
                      {all.map((x) => (
                        <Td key={x.key} right className={cx(active === x.key && 'bg-brand-50/60')}>
                          {(fn as (x: (typeof all)[number]) => string)(x)}
                        </Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <ScenarioChart rows={all.map((x) => ({ name: x.label, cost: x.cost, price: x.abuPrice, gp: x.gpLocked }))} currency={cur} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ label, now, was, d, tone }: { label: string; now: string; was: string; d?: React.ReactNode; tone?: 'bad' }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className={cx('num mt-2 text-xl font-semibold', tone === 'bad' ? 'text-bad' : 'text-ink')}>
        {now}
        {d}
      </div>
      <div className="mt-1 text-xs text-muted">{was}</div>
    </div>
  );
}
