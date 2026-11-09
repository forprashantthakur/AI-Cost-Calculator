'use client';

import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useStore } from '@/store/store';
import { getProcess } from '@/data/catalog';
import { defaultActivities, implCostFromActivities } from '@/data/templates';
import type { AgentOpsBilling, EstimateInputs, EstimateResults, PeoplePricing } from '@/engine/types';
import { currencyMeta, dateLabel, money, moneyCompact, num, numCompact, pctFmt } from '@/lib/format';
import { TIPS } from '@/lib/tips';
import { CostLinesBar, PoolDonut, POOL_META } from '@/components/charts';
import { Button, Callout, Card, CardTitle, NumberField, NumberInput, Segmented, Select, Stat, Td, TextInput, Th } from '@/components/ui';

type Up = (fn: (e: EstimateInputs) => EstimateInputs) => void;

export function Step3Costs({ est, res, update }: { est: EstimateInputs; res: EstimateResults; update: Up }) {
  const rc = useStore((s) => s.rateCard);
  const cur = est.currency;
  const sym = currencyMeta(cur).symbol.trim();
  const impl = res.implementation;
  const op = res.operating;
  const aoMargin = res.agentOpsFee > 0 ? ((res.agentOpsFee - op.pools.agentops) / res.agentOpsFee) * 100 : null;
  const designationGroups = Array.from(new Set(rc.resourceRates.map((r) => r.memberFirm))).map((firm) => ({
    label: firm,
    options: rc.resourceRates.filter((r) => r.memberFirm === firm).map((r) => ({ value: r.id, label: `${r.memberFirm} · ${r.designation}` })),
  }));

  return (
    <div className="space-y-5">
      {/* A. Implementation */}
      <Card>
        <CardTitle
          tip={TIPS.implementationPrice}
          sub={`People effort costed at the rate card: ${rc.resourceRatesSource}, rates updated ${dateLabel(rc.resourceRatesUpdated)}. Edit rates in Settings › People rate card.`}
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
          A. One-time implementation
        </CardTitle>
        {est.implMode === 'simple' ? (
          <div className="grid grid-cols-1 max-w-2xl gap-4 sm:grid-cols-2">
            <NumberField label="Estimated implementation delivery cost" value={est.implSimpleCost} onChange={(v) => update((e) => ({ ...e, implSimpleCost: v ?? 0 }))} min={0} prefix={sym} />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead>
                  <tr>
                    <Th>Activity</Th>
                    <Th>Designation</Th>
                    <Th right>Hours</Th>
                    <Th right>Cost / hour</Th>
                    <Th right>Rack / hour</Th>
                    <Th right>Cost</Th>
                    <Th right>Rack fee</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {est.implActivities.map((a, i) => {
                    const r = impl.activities[i];
                    const setAct = (patch: Partial<typeof a>) => update((e) => ({ ...e, implActivities: e.implActivities.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
                    return (
                      <tr key={a.id}>
                        <Td className="min-w-[220px] text-ink">
                          {a.id.startsWith('custom-') ? <TextInput value={a.label} onChange={(v) => setAct({ label: v })} placeholder="Activity name" /> : a.label}
                        </Td>
                        <Td className="min-w-[270px]">
                          <Select value={a.roleId} onChange={(v) => setAct({ roleId: v })} groups={designationGroups} ariaLabel={`Designation for ${a.label}`} />
                        </Td>
                        <Td right className="w-28">
                          <NumberInput value={a.hours} min={0} ariaLabel={`Hours for ${a.label}`} onChange={(v) => setAct({ hours: v ?? 0 })} />
                        </Td>
                        <Td right className="text-muted">{money(r?.rate, cur, 0)}</Td>
                        <Td right className="text-muted">{money(r?.rackRate, cur, 0)}</Td>
                        <Td right>{money(r?.cost, cur, 0)}</Td>
                        <Td right>{money(r?.rackFee, cur, 0)}</Td>
                        <Td right className="w-10">
                          <button
                            type="button"
                            className="rounded p-1 text-faint hover:bg-line-2 hover:text-bad"
                            title="Remove activity"
                            aria-label={`Remove ${a.label}`}
                            onClick={() => update((e) => ({ ...e, implActivities: e.implActivities.filter((_, j) => j !== i) }))}
                          >
                            <Trash2 size={14} />
                          </button>
                        </Td>
                      </tr>
                    );
                  })}
                  <tr className="bg-canvas">
                    <Td strong>Total</Td>
                    <Td />
                    <Td right strong>
                      {num(impl.hours)}
                    </Td>
                    <Td />
                    <Td />
                    <Td right strong>
                      {money(impl.deliveryCost, cur, 0)}
                    </Td>
                    <Td right strong>
                      {money(impl.rackFee, cur, 0)}
                    </Td>
                    <Td />
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() =>
                  update((e) => ({
                    ...e,
                    implActivities: [...e.implActivities, { id: `custom-${Date.now().toString(36)}`, label: 'Additional activity', roleId: rc.resourceRates[0]?.id ?? '', hours: 0 }],
                  }))
                }
              >
                <Plus size={13} /> Add activity
              </Button>
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

        <div className="mt-6 grid grid-cols-1 gap-5 border-t border-line pt-5 lg:grid-cols-[minmax(0,320px)_1fr]">
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 text-xs font-medium text-ink-2">Price people effort by</div>
              <Segmented<PeoplePricing>
                size="sm"
                value={est.peoplePricing}
                onChange={(v) => update((e) => ({ ...e, peoplePricing: v }))}
                options={[
                  { value: 'discount', label: 'Rack rate less discount' },
                  { value: 'margin', label: 'Target margin' },
                ]}
              />
              <p className="mt-1.5 text-[11px] text-faint">Applies to the implementation fee and the AgentOps team fee.</p>
            </div>
            {est.peoplePricing === 'discount' && (
              <NumberField
                label="Discount off rack rate"
                tip="Fee = hours × rack rate × (1 − discount). The margin shown is what that fee earns over delivery cost."
                value={est.discountPct}
                onChange={(v) => update((e) => ({ ...e, discountPct: v ?? 0 }))}
                min={0}
                max={100}
                suffix="%"
              />
            )}
            <NumberField
              label="Target implementation margin"
              tip={est.peoplePricing === 'discount' ? 'Used to show the discount that would earn this margin.' : 'Price = delivery cost ÷ (1 − margin).'}
              value={est.implMarginPct}
              onChange={(v) => update((e) => ({ ...e, implMarginPct: v ?? 0 }))}
              min={0}
              max={95}
              suffix="%"
            />
            {est.peoplePricing === 'discount' && impl.pricingBasis === 'margin' && (
              <Callout tone="info">Simple mode has no rack-rate fee, so implementation is priced on target margin. Switch to Detailed to price at a discount.</Callout>
            )}
          </div>
          <div className="grid grid-cols-1 content-start gap-3 sm:grid-cols-3">
            <Stat label="Rack-rate fee" value={impl.rackFee != null ? moneyCompact(impl.rackFee, cur) : '—'} sub={impl.rackFee != null ? `${num(impl.hours)} hours at rack rates` : 'Detailed mode only'} />
            <Stat
              label="Discount"
              value={impl.effectiveDiscountPct != null ? pctFmt(impl.effectiveDiscountPct, 1) : '—'}
              sub={impl.rackFee != null ? `${moneyCompact(Math.max(0, impl.rackFee - impl.price), cur)} off rack` : undefined}
            />
            <Stat label="Implementation selling price" value={moneyCompact(impl.price, cur)} sub={money(impl.price, cur, 0)} tip={TIPS.implementationPrice} emphasis />
            <Stat label="Implementation delivery cost" value={moneyCompact(impl.deliveryCost, cur)} sub={money(impl.deliveryCost, cur, 0)} />
            <Stat label="Implementation margin" value={pctFmt(impl.actualMarginPct, 1)} tone={impl.actualMarginPct < 0 ? 'bad' : impl.actualMarginPct < est.implMarginPct ? 'warn' : 'good'} sub={impl.actualMarginPct < 0 ? 'Below delivery cost' : `Target ${pctFmt(est.implMarginPct, 0)}`} />
            <Stat
              label={`Discount for ${pctFmt(est.implMarginPct, 0)} margin`}
              value={impl.discountAtTargetMargin != null ? pctFmt(impl.discountAtTargetMargin, 1) : '—'}
              sub={impl.discountAtTargetMargin != null && impl.discountAtTargetMargin < 0 ? 'Premium over rack needed' : 'Maximum discount at target margin'}
            />
          </div>
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
        <CardTitle tip={TIPS.agentOps} sub="The AgentOps team is staffed from Operate designations: hours = (base + per agent × agents) × SLA multiplier. Bundled into ABU/ACU prices or billed as a separate fee — never both.">
          C. AgentOps team
        </CardTitle>
        <div className="space-y-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <Th>Role</Th>
                  <Th>Designation</Th>
                  <Th right>Hours / month</Th>
                  <Th right>Cost / month</Th>
                  <Th right>Rack fee / month</Th>
                </tr>
              </thead>
              <tbody>
                {op.agentOpsComponents.map((c) => (
                  <tr key={c.id}>
                    <Td className="text-ink">{c.label}</Td>
                    <Td className="text-muted">{c.designation}</Td>
                    <Td right>{num(c.hours, 1)}</Td>
                    <Td right>{money(c.monthly, cur, 0)}</Td>
                    <Td right className="text-muted">{money(c.rackMonthly, cur, 0)}</Td>
                  </tr>
                ))}
                <tr className="bg-canvas">
                  <Td strong>{op.agentOpsOverridden ? 'Total (manual cost override applies)' : `Total — ${est.sla} SLA, ${est.agents} agent(s)`}</Td>
                  <Td />
                  <Td right strong>
                    {num(op.agentOpsComponents.reduce((a, c) => a + c.hours, 0), 1)}
                  </Td>
                  <Td right strong>
                    {money(op.pools.agentops, cur, 0)}
                  </Td>
                  <Td right strong className="text-muted">
                    {op.agentOpsRackFee != null ? money(op.agentOpsRackFee, cur, 0) : '—'}
                  </Td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,280px)]">
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
              <Callout tone={aoMargin != null && aoMargin < 0 ? 'warn' : 'good'} title={`Managed AgentOps fee: ${money(res.agentOpsFee, cur, 0)} / month`}>
                {res.agentOpsFeeBasis === 'discount'
                  ? `Team at rack rate (${moneyCompact(op.agentOpsRackFee ?? 0, cur)}) less ${pctFmt(est.discountPct, 1)} discount`
                  : res.agentOpsFeeBasis === 'override'
                    ? 'Customer-specific fee'
                    : `Team cost at ${pctFmt(est.targetMargin, 1)} target margin`}
                {aoMargin != null && ` · margin ${pctFmt(aoMargin, 1)}`}. Its cost ({moneyCompact(op.pools.agentops, cur)}) is excluded from ABU and ACU prices, so it is recovered once.
              </Callout>
            ) : (
              <Callout tone="info" title="Bundled into unit prices">
                AgentOps cost is recovered through the ABU/ACU price at the target margin, so no discount applies and no separate fee is charged.
              </Callout>
            )}
            <NumberField
              label="AgentOps cost override / month"
              value={est.agentOpsOverride}
              onChange={(v) => update((e) => ({ ...e, agentOpsOverride: v }))}
              nullable
              min={0}
              prefix={sym}
              placeholder="Auto from the AgentOps team"
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
