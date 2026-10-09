'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ClientPreference, EstimateInputs, EstimateResults, HybridConfig, SubscriptionUnit, VolumeTier } from '@/engine/types';
import { currencyMeta, num, unitPrice } from '@/lib/format';
import { Button, Collapsible, NumberField, NumberInput, SelectField, Toggle, Badge } from '@/components/ui';

type Up = (fn: (e: EstimateInputs) => EstimateInputs) => void;

export const PREFERENCES: { value: ClientPreference; label: string }[] = [
  { value: 'none', label: 'No stated preference' },
  { value: 'predictable', label: 'Predictable monthly spend' },
  { value: 'outcomes', label: 'Pay only for outcomes' },
  { value: 'usage', label: 'Pay for actual usage' },
  { value: 'risk-share', label: 'Share risk and reward' },
];

export function CommercialTermsEditor({ est, res, update, defaultOpen = false }: { est: EstimateInputs; res: EstimateResults; update: Up; defaultOpen?: boolean }) {
  const c = est.commercial;
  const cur = est.currency;
  const sym = currencyMeta(cur).symbol.trim();
  const setC = <K extends keyof EstimateInputs['commercial']>(k: K, v: EstimateInputs['commercial'][K]) => update((e) => ({ ...e, commercial: { ...e.commercial, [k]: v } }));
  const hybrid: HybridConfig = c.hybrid ?? res.recommendation.hybrid ?? { subscription: true, usage: 'abu', agentOps: false, gainshare: false };
  const setHybrid = (patch: Partial<HybridConfig>) => setC('hybrid', { ...hybrid, ...patch });
  const tiers = c.volumeTiers;
  const setTier = (i: number, patch: Partial<VolumeTier>) => setC('volumeTiers', tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      title="Commercial terms"
      sub="Contract duration, escalation, commitments, allowances, overage, volume discounts, hybrid structure and customer-specific prices."
      badge={<Badge>Optional</Badge>}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Contract duration" value={c.contractYears} onChange={(v) => setC('contractYears', Math.max(1, Math.round(v ?? 1)))} min={1} max={10} step={1} suffix="years" />
          <NumberField label="Annual price escalation" value={c.escalationPct} onChange={(v) => setC('escalationPct', v ?? 0)} suffix="%" tip="Applied to all price terms from year 2." />
          <NumberField
            label="Minimum monthly commitment"
            tip="Floor on usage-based charges (ABU, ACU and hybrid usage)."
            value={c.minMonthlyCommitment}
            onChange={(v) => setC('minMonthlyCommitment', v ?? 0)}
            min={0}
            prefix={sym}
          />
          <SelectField<ClientPreference> label="Client preference" value={c.clientPreference} onChange={(v) => setC('clientPreference', v)} options={PREFERENCES} tip="Feeds the recommendation engine." />
        </div>

        <div>
          <div className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Subscription</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField<SubscriptionUnit>
              label="Subscription unit"
              value={c.subscriptionUnit}
              onChange={(v) => setC('subscriptionUnit', v)}
              options={[
                { value: 'agent', label: 'Per agent' },
                { value: 'user', label: 'Per user' },
                { value: 'developer', label: 'Per developer' },
                { value: 'team', label: 'Per team / capacity block' },
              ]}
            />
            <NumberField label="Number of units" value={c.subscriptionUnits} onChange={(v) => setC('subscriptionUnits', Math.max(0, v ?? 0))} min={0} />
            <NumberField
              label="Subscription price per unit / month"
              tip="Leave empty for the recommended price."
              value={c.subscriptionPriceOverride}
              onChange={(v) => setC('subscriptionPriceOverride', v)}
              nullable
              min={0}
              prefix={sym}
              placeholder={`Auto: ${unitPrice(res.prices.subscriptionUnitPrice, cur)}`}
            />
            <NumberField
              label="Included ABUs per month"
              tip="Allowance inside the subscription. Leave empty to include the baseline volume."
              value={c.includedAbusOverride}
              onChange={(v) => setC('includedAbusOverride', v)}
              nullable
              min={0}
              placeholder={`Auto: ${num(res.prices.includedAbus)}`}
            />
            <NumberField label="Overage premium over ABU price" value={c.overagePremiumPct} onChange={(v) => setC('overagePremiumPct', v ?? 0)} suffix="%" />
          </div>
        </div>

        <div>
          <div className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Customer-specific prices</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField label="ABU price override" value={c.abuPriceOverride} onChange={(v) => setC('abuPriceOverride', v)} nullable min={0} prefix={sym} placeholder={`Auto: ${unitPrice(res.prices.abuPrice, cur)}`} />
            <NumberField label="ACU price override" value={c.acuPriceOverride} onChange={(v) => setC('acuPriceOverride', v)} nullable min={0} prefix={sym} placeholder={`Auto: ${unitPrice(res.prices.acuPrice, cur)}`} />
            <NumberField label="AgentOps fee override / month" value={c.agentOpsFeeOverride} onChange={(v) => setC('agentOpsFeeOverride', v)} nullable min={0} prefix={sym} placeholder={`Auto: ${unitPrice(res.prices.agentOpsFee, cur)}`} />
            <NumberField label="Gainshare percentage" value={c.gainsharePct} onChange={(v) => setC('gainsharePct', v ?? 0)} min={0} max={100} suffix="%" tip="Share of independently validated financial benefits." />
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Hybrid structure {c.hybrid == null && <Badge tone="brand">following recommendation</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Toggle checked={hybrid.subscription} onChange={(v) => setHybrid({ subscription: v })} label="Platform subscription" />
            <SelectField<HybridConfig['usage']>
              label="Usage component"
              value={hybrid.usage}
              onChange={(v) => setHybrid({ usage: v })}
              options={[
                { value: 'abu', label: 'ABU (per outcome)' },
                { value: 'acu', label: 'ACU (per consumption)' },
                { value: 'none', label: 'None' },
              ]}
              className="w-48"
            />
            <Toggle checked={hybrid.agentOps} onChange={(v) => setHybrid({ agentOps: v })} label="Separate AgentOps fee" />
            <Toggle checked={hybrid.gainshare} onChange={(v) => setHybrid({ gainshare: v })} label="Gainshare upside" />
            {c.hybrid != null && (
              <Button size="sm" variant="ghost" onClick={() => setC('hybrid', null)}>
                Reset to recommendation
              </Button>
            )}
          </div>
        </div>

        <div>
          <div className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Volume-based discounts (graduated, on billable ABUs / ACUs)</div>
          {tiers.length === 0 && <p className="mb-2 text-sm text-muted">No volume discounts.</p>}
          <div className="space-y-2">
            {tiers.map((t, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-20 text-muted">Up to</span>
                <NumberInput className="w-40" value={t.upTo} nullable placeholder="No limit" onChange={(v) => setTier(i, { upTo: v })} ariaLabel="Tier upper bound" />
                <span className="text-muted">units →</span>
                <NumberInput className="w-28" value={t.discountPct} suffix="%" onChange={(v) => setTier(i, { discountPct: v ?? 0 })} min={0} max={100} ariaLabel="Tier discount" />
                <span className="text-muted">discount</span>
                <button className="rounded p-1.5 text-muted hover:bg-bad-50 hover:text-bad" onClick={() => setC('volumeTiers', tiers.filter((_, j) => j !== i))} aria-label="Remove tier">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setC('volumeTiers', [...tiers, { upTo: null, discountPct: 0 }])}>
              <Plus size={13} /> Add tier
            </Button>
            {tiers.length === 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const base = Math.max(1000, Math.round(res.volume.weightedAbus / 1000) * 1000);
                  setC('volumeTiers', [
                    { upTo: base, discountPct: 0 },
                    { upTo: base * 2, discountPct: 5 },
                    { upTo: null, discountPct: 10 },
                  ]);
                }}
              >
                Add standard 0% / 5% / 10% tiers
              </Button>
            )}
          </div>
        </div>
      </div>
    </Collapsible>
  );
}
