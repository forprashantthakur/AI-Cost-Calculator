'use client';

import { RotateCcw } from 'lucide-react';
import { useStore } from '@/store/store';
import { getProcess } from '@/data/catalog';
import { defaultActivities, implCostFromActivities } from '@/data/templates';
import type { AgentOpsBilling, EstimateInputs, EstimateResults } from '@/engine/types';
import { currencyMeta, money, moneyCompact, num, numCompact, pctFmt } from '@/lib/format';
import { TIPS } from '@/lib/tips';
import { CostLinesBar, PoolDonut, POOL_META } from '@/components/charts';
import { Button, Callout, Card, CardTitle, NumberField, NumberInput, Segmented, Select, Stat, Td, Th } from '@/components/ui';

type Up = (fn: (e: EstimateInputs) => EstimateInputs) => void;

export function Step3Costs({ est, res, update }: { est: EstimateInputs; res: EstimateResults; update: Up }) {
  const rc = useStore((s) => s.rateCard);
  const cur = est.currency;
  const sym = currencyMeta(cur).symbol.trim();
  const impl = res.implementation;
  const op = res.operating;

  return (
    <div className="space-y-5">
      {/* A. Implementation */}
      <Card>
        <CardTitle
          tip={TIPS.implementationPrice}
          sub="Discovery, architecture, build, prompt & context engineering, RAG, integration, security, testing, deployment and change."
          action={
            <Segmented
              size="sm"
              value={est.implMode}
              onChange={(m) => update((e) => ({ ...e, implMode: m }))}
              options={[
                { value: 'simple', label: 'Simple' },
                { value: 'detailed', label: 'Detailed' },
              ]}
            />
          }
        >
          A. One-time implementation cost
        </CardTitle>
        {est.implMode === 'simple' ? (
          <div className="grid grid-cols-1 max-w-2xl gap-4 sm:grid-cols-2">
            <NumberField label="Estimated implementation delivery cost" value={est.implSimpleCost} onChange={(v) => update((e) => ({ ...e, implSimpleCost: v ?? 0 }))} min={0} prefix={sym} />
            <NumberField label="Target implementation margin" value={est.implMarginPct} onChange={(v) => update((e) => ({ ...e, implMarginPct: v ?? 0 }))} min={0} max={95} suffix="%" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <Th>Activity</Th>
                    <Th>Role</Th>
                    <Th right>Hours</Th>
                    <Th right>Rate / hour</Th>
                    <Th right>Cost</Th>
                  </tr>
                </thead>
                <tbody>
                  {est.implActivities.map((a, i) => {
                    const r = impl.activities[i];
                    return (
                      <tr key={a.id}>
                        <Td className="text-ink">{a.label}</Td>
                        <Td>
                          <Select
                            value={a.roleId}
                            onChange={(v) => update((e) => ({ ...e, implActivities: e.implActivities.map((x, j) => (j === i ? { ...x, roleId: v } : x)) }))}
                            options={rc.implRoles.map((ro) => ({ value: ro.id, label: ro.label }))}
                            ariaLabel={`Role for ${a.label}`}
                          />
                        </Td>
                        <Td right className="w-28">
                          <NumberInput
                            value={a.hours}
                            min={0}
                            ariaLabel={`Hours for ${a.label}`}
                            onChange={(v) => update((e) => ({ ...e, implActivities: e.implActivities.map((x, j) => (j === i ? { ...x, hours: v ?? 0 } : x)) }))}
                          />
                        </Td>
                        <Td right>{money(r?.rate, cur)}</Td>
                        <Td right>{money(r?.cost, cur)}</Td>
                      </tr>
                    );
                  })}
                  <tr>
                    <Td strong>Total</Td>
                    <Td />
                    <Td right strong>
                      {num(impl.hours)}
                    </Td>
                    <Td />
                    <Td right strong>
                      {money(impl.deliveryCost, cur)}
                    </Td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <NumberField className="w-56" label="Target implementation margin" value={est.implMarginPct} onChange={(v) => update((e) => ({ ...e, implMarginPct: v ?? 0 }))} min={0} max={95} suffix="%" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  update((e) => {
                    const acts = defaultActivities(getProcess(e.processId), rc, e.agents, e.complexity);
                    return { ...e, implActivities: acts, implSimpleCost: Math.round(implCostFromActivities(acts, rc, e.currency)) };
                  })
                }
              >
                <RotateCcw size={13} /> Recalculate hours from template, agents and complexity
              </Button>
            </div>
          </>
        )}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Implementation delivery cost" value={moneyCompact(impl.deliveryCost, cur)} sub={money(impl.deliveryCost, cur)} />
          <Stat label="Implementation margin" value={pctFmt(impl.marginPct, 1)} />
          <Stat label="Implementation selling price" value={moneyCompact(impl.price, cur)} sub={money(impl.price, cur)} tip={TIPS.implementationPrice} emphasis />
        </div>
      </Card>

      {/* B. Monthly operating cost */}
      <Card>
        <CardTitle tip={TIPS.monthlyCost} sub="Every line shows its measured driver and unit rate. Failed executions and retries are included; cached tokens and OCR are never double-counted.">
          B. Monthly AI operating cost
        </CardTitle>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead>
                <tr>
                  <Th>Cost line</Th>
                  <Th right>Monthly driver</Th>
                  <Th right>Unit rate</Th>
                  <Th right>Monthly cost</Th>
                  <Th right>Share</Th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(POOL_META) as (keyof typeof POOL_META)[]).map((pool) => (
                  <PoolRows key={pool} pool={pool} res={res} />
                ))}
                <tr className="bg-canvas">
                  <Td strong>Total monthly delivery cost</Td>
                  <Td />
                  <Td />
                  <Td right strong>
                    {money(op.total, cur)}
                  </Td>
                  <Td right>100%</Td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <PoolDonut res={res} />
            <ul className="mt-2 space-y-1.5 text-xs">
              {(Object.keys(POOL_META) as (keyof typeof POOL_META)[]).map((p) => (
                <li key={p} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: POOL_META[p].color }} />
                    {POOL_META[p].label}
                  </span>
                  <span className="num font-medium">{moneyCompact(op.pools[p], cur)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Monthly delivery cost" value={moneyCompact(op.total, cur)} sub={`${moneyCompact(op.annual, cur)} per year`} tip={TIPS.monthlyCost} emphasis />
          <Stat label="Cost per submitted transaction" value={money(op.perSubmittedTxn, cur, 2)} />
          <Stat label="Cost per agent / month" value={moneyCompact(op.perAgent, cur)} />
          <Stat label="Failure & retry cost" value={moneyCompact(op.failureAndRetryCost, cur)} sub={`${pctFmt((op.failureAndRetryCost / (op.total || 1)) * 100)} of total — allocated to accepted ABUs`} tip={TIPS.failureCost} />
        </div>
        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Cost breakdown chart</div>
          <CostLinesBar res={res} />
        </div>
        <div className="mt-3 text-xs text-muted">
          Volume funnel: {num(res.volume.submitted)} submitted → {num(res.volume.unique)} unique → {num(res.volume.executions)} executions (incl. {num(res.volume.retries)} retries) → {num(res.volume.accepted)} accepted ·{' '}
          {numCompact(res.tokens.total)} tokens / month
        </div>
      </Card>

      {/* C. AgentOps */}
      <Card>
        <CardTitle tip={TIPS.agentOps} sub="AgentOps can be bundled into ABU/ACU prices or billed as a separate fee — never both.">
          C. AgentOps cost
        </CardTitle>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Component</Th>
                <Th right>Monthly cost</Th>
              </tr>
            </thead>
            <tbody>
              {op.agentOpsComponents.map((c) => (
                <tr key={c.id}>
                  <Td>{c.label}</Td>
                  <Td right>{money(c.monthly, cur)}</Td>
                </tr>
              ))}
              <tr className="bg-canvas">
                <Td strong>{op.agentOpsOverridden ? 'Total (manual override applies)' : `Total — ${est.sla} SLA, ${est.agents} agent(s)`}</Td>
                <Td right strong>
                  {money(op.pools.agentops, cur)}
                </Td>
              </tr>
            </tbody>
          </table>
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 text-xs font-medium text-ink-2">How is AgentOps recovered?</div>
              <Segmented<AgentOpsBilling | 'auto'>
                value={est.commercial.agentOpsBilling}
                onChange={(v) => update((e) => ({ ...e, commercial: { ...e.commercial, agentOpsBilling: v } }))}
                options={[
                  { value: 'auto', label: `Recommended (${res.recommendation.agentOpsBilling === 'separate' ? 'separate' : 'bundled'})` },
                  { value: 'bundled', label: 'Bundled in unit price' },
                  { value: 'separate', label: 'Separate fee' },
                ]}
                size="sm"
              />
            </div>
            {res.agentOpsBilling === 'separate' ? (
              <Callout tone="good" title="Billed as a separate Managed AgentOps fee">
                {money(res.agentOpsFee, cur)} per month. Its cost ({moneyCompact(op.pools.agentops, cur)}) is excluded from ABU and ACU prices, so it is recovered once.
              </Callout>
            ) : (
              <Callout tone="info" title="Bundled into unit prices">
                AgentOps cost is recovered through the ABU/ACU price and no separate fee is charged.
              </Callout>
            )}
            <NumberField
              label="AgentOps cost override / month"
              value={est.agentOpsOverride}
              onChange={(v) => update((e) => ({ ...e, agentOpsOverride: v }))}
              nullable
              min={0}
              prefix={sym}
              placeholder="Auto from rate card"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

function PoolRows({ pool, res }: { pool: keyof typeof POOL_META; res: EstimateResults }) {
  const cur = res.currency;
  const lines = res.operating.lines.filter((l) => l.pool === pool);
  const total = res.operating.total || 1;
  return (
    <>
      <tr>
        <td colSpan={5} className="pt-3 pb-1 text-[11px] font-semibold tracking-wide uppercase" style={{ color: POOL_META[pool].color }}>
          {POOL_META[pool].label}
        </td>
      </tr>
      {lines.map((l) => (
        <tr key={l.key}>
          <Td className="text-ink">
            {l.label}
            {l.note && <div className="text-[11px] text-faint">{l.note}</div>}
          </Td>
          <Td right className="text-muted">
            {l.quantity != null ? `${numCompact(l.quantity)} ${l.unit}` : '—'}
          </Td>
          <Td right className="text-muted">
            {l.rate != null ? `${money(l.rate, cur, l.rate < 0.01 ? 6 : l.rate < 1 ? 4 : 2)}${l.per === 1e6 ? ' / 1M' : l.per === 1000 ? ' / 1K' : ''}` : 'fixed'}
          </Td>
          <Td right>{money(l.monthly, cur)}</Td>
          <Td right className="text-muted">
            {pctFmt((l.monthly / total) * 100)}
          </Td>
        </tr>
      ))}
    </>
  );
}
