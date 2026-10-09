'use client';

import { useStore } from '@/store/store';
import type { EstimateInputs, EstimateResults } from '@/engine/types';
import { money, moneyCompact, num, pctFmt, unitPrice } from '@/lib/format';
import { TIPS } from '@/lib/tips';
import { Card, CardTitle, Stat, Td, Th, Callout } from '@/components/ui';
import { ModelPicker, RecommendationCard } from '@/components/pricing';
import { CommercialTermsEditor } from '@/components/CommercialTermsEditor';

type Up = (fn: (e: EstimateInputs) => EstimateInputs) => void;

export function Step4Pricing({ est, res, update }: { est: EstimateInputs; res: EstimateResults; update: Up }) {
  const rc = useStore((s) => s.rateCard);
  const cur = res.currency;
  const acu = res.acu;
  const abu = res.abu;
  const sep = res.agentOpsBilling === 'separate';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardTitle tip={TIPS.abu} sub={`1 ABU = ${est.abuUnit.toLowerCase()} · weights Low ${rc.abuWeights.low} / Medium ${rc.abuWeights.medium} / High ${rc.abuWeights.high}`}>
            ABU — AI Business Unit economics
          </CardTitle>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Accepted weighted ABUs / month" value={num(abu.weighted)} sub={`${num(res.volume.accepted)} accepted × weight ${res.volume.abuWeight.toFixed(2)}`} tip={TIPS.weightedAbus} />
            <Stat label="Cost per successful ABU" value={unitPrice(abu.costPerAbuFullyLoaded, cur)} sub="Fully loaded, incl. failures & retries" tip={TIPS.costPerAbu} />
            <Stat label="Recommended ABU price" value={unitPrice(abu.price, cur)} sub={abu.priceOverridden ? 'Customer-specific override' : sep ? 'Excludes AgentOps (billed separately)' : `At ${pctFmt(est.targetMargin, 1)} target margin`} tip={TIPS.abuPrice} emphasis tone="good" />
            <Stat label="Monthly ABU revenue" value={moneyCompact(abu.monthlyRevenue, cur)} sub="ABU model, after tiers and commitment" />
          </div>
          <table className="mt-4 w-full text-sm">
            <tbody>
              <tr>
                <Td>Cost per ABU recovered through the ABU price</Td>
                <Td right>{unitPrice(abu.costPerAbuRecoverable, cur)}</Td>
              </tr>
              <tr>
                <Td>of which failed attempts & retries</Td>
                <Td right>{unitPrice(abu.failureCostPerAbu, cur)}</Td>
              </tr>
              <tr>
                <Td>Cost per accepted transaction (unweighted)</Td>
                <Td right>{unitPrice(abu.costPerAcceptedTxn, cur)}</Td>
              </tr>
              <tr>
                <Td>Price per accepted transaction at this complexity</Td>
                <Td right>{unitPrice(abu.price != null ? abu.price * res.volume.abuWeight : null, cur)}</Td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card>
          <CardTitle
            tip={TIPS.acu}
            sub={
              acu.method === 'cost'
                ? `Method A — cost-normalised: ${money(rc.acu.referenceCost, rc.acu.referenceCurrency)} of eligible AI consumption = 1 ACU (${rc.acu.version})`
                : `Method B — weighted resources (${rc.acu.version})`
            }
          >
            ACU — AI Consumption Unit economics
          </CardTitle>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Total ACUs / month" value={num(acu.total)} sub={`${num(acu.perTxn, 2)} per transaction · ${num(acu.perAgent)} per agent`} />
            <Stat label="Fully loaded cost per ACU" value={unitPrice(acu.deliveryCostPerAcu, cur)} sub={`Consumption only: ${unitPrice(acu.consumptionCostPerAcu, cur)}`} />
            <Stat label="Recommended ACU price" value={unitPrice(acu.price, cur)} sub={acu.priceOverridden ? 'Customer-specific override' : sep ? 'Excludes AgentOps (billed separately)' : `At ${pctFmt(est.targetMargin, 1)} target margin`} tip={TIPS.acuPrice} emphasis tone="good" />
            <Stat label="Monthly ACU revenue" value={moneyCompact(acu.monthlyRevenue, cur)} sub="ACU model, after tiers and commitment" />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Measured resource</Th>
                  <Th right>Quantity</Th>
                  <Th right>ACU factor</Th>
                  <Th right>ACUs</Th>
                </tr>
              </thead>
              <tbody>
                {acu.components.map((c) => (
                  <tr key={c.key}>
                    <Td>{c.label}</Td>
                    <Td right>{c.key === 'eligible' ? money(c.quantity, cur) : num(c.quantity)}</Td>
                    <Td right>{num(c.weight, 6)}</Td>
                    <Td right>{num(c.acus)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted">ACU delivery cost = eligible AI consumption {moneyCompact(acu.eligibleCost, cur)} plus attributable platform, service{sep ? '' : ' and AgentOps'} cost. One token is never assumed to equal one ACU.</p>
        </Card>
      </div>

      <RecommendationCard res={res} est={est} update={update} />

      <Card>
        <CardTitle sub="Select the model to present. Every model recovers each cost pool exactly once." tip={TIPS.recovery}>
          Choose the commercial model
        </CardTitle>
        <ModelPicker res={res} est={est} update={update} />
        {res.selected.notes.length > 0 && (
          <div className="mt-4 space-y-2">
            {res.selected.notes.map((n) => (
              <Callout key={n} tone="info">
                {n}
              </Callout>
            ))}
          </div>
        )}
      </Card>

      <CommercialTermsEditor est={est} res={res} update={update} />
    </div>
  );
}
