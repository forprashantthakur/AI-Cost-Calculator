'use client';

import type { BaselineSource, BenefitStatus, EstimateInputs, EstimateResults, SdlcMetricKey } from '@/engine/types';
import { currencyMeta, money, moneyCompact, months, num, pctFmt, unitPrice } from '@/lib/format';
import { TIPS } from '@/lib/tips';
import { ValueChart } from '@/components/charts';
import { Badge, Callout, Card, CardTitle, NumberInput, Select, Stat, Td, Th } from '@/components/ui';

type Up = (fn: (e: EstimateInputs) => EstimateInputs) => void;

const STATUS: { value: BenefitStatus; label: string }[] = [
  { value: 'assumed', label: 'Assumption' },
  { value: 'validated', label: 'Validated actual' },
];

export function Step5Value({ est, res, update }: { est: EstimateInputs; res: EstimateResults; update: Up }) {
  const cur = res.currency;
  const sym = currencyMeta(cur).symbol.trim();
  const v = res.value;
  const val = est.value;
  const setV = <K extends keyof EstimateInputs['value']>(k: K, x: EstimateInputs['value'][K]) => update((e) => ({ ...e, value: { ...e.value, [k]: x } }));

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle sub="Productivity is not automatically cash. Only spend that actually falls — or is avoided — counts as a financial benefit.">Client productivity and financial value</CardTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Current manual effort" value={`${num(v.manualHours)} h`} sub="per month" />
          <Stat label="AI-assisted manual effort" value={`${num(v.aiAssistedHours)} h`} sub="incl. fallback for non-completed work" />
          <Stat label="Hours saved" value={`${num(v.hoursSaved)} h`} sub={`${pctFmt(v.productivityPct)} productivity improvement`} tip={TIPS.productivity} tone="good" />
          <Stat label="Redeployable capacity" value={`${num(v.redeployableFte, 1)} FTE`} tip={TIPS.fte} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
          <div>
            <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Financial benefits — mark each as an assumption or a validated actual</div>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Benefit</Th>
                  <Th>Input</Th>
                  <Th>Status</Th>
                  <Th right>Per month</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>
                    <div className="font-medium text-ink">Verified hard savings</div>
                    <div className="text-[11px] text-muted">Share of capacity value ({moneyCompact(v.capacityValueMonthly, cur)}/mo) converted to reduced spend</div>
                  </Td>
                  <Td className="w-36">
                    <NumberInput value={val.cashRealisationPct} onChange={(x) => setV('cashRealisationPct', x ?? 0)} min={0} max={100} suffix="%" ariaLabel="Cash realisation" />
                  </Td>
                  <Td className="w-40">
                    <Select value={val.cashRealisationStatus} onChange={(x) => setV('cashRealisationStatus', x)} options={STATUS} ariaLabel="Hard savings status" />
                  </Td>
                  <Td right>{money(v.hardSavingsMonthly, cur)}</Td>
                </tr>
                <tr>
                  <Td>
                    <div className="font-medium text-ink">Cost avoidance</div>
                    <div className="text-[11px] text-muted">e.g. hires or contractors not needed for growth (annual)</div>
                  </Td>
                  <Td>
                    <NumberInput value={val.costAvoidanceAnnual} onChange={(x) => setV('costAvoidanceAnnual', x ?? 0)} min={0} prefix={sym} ariaLabel="Cost avoidance" />
                  </Td>
                  <Td>
                    <Select value={val.costAvoidanceStatus} onChange={(x) => setV('costAvoidanceStatus', x)} options={STATUS} ariaLabel="Cost avoidance status" />
                  </Td>
                  <Td right>{money(v.costAvoidanceMonthly, cur)}</Td>
                </tr>
                <tr>
                  <Td>
                    <div className="font-medium text-ink">Revenue uplift (attributable margin)</div>
                    <div className="text-[11px] text-muted">Enter margin contribution, not gross revenue (annual)</div>
                  </Td>
                  <Td>
                    <NumberInput value={val.revenueUpliftAnnual} onChange={(x) => setV('revenueUpliftAnnual', x ?? 0)} min={0} prefix={sym} ariaLabel="Revenue uplift" />
                  </Td>
                  <Td>
                    <Select value={val.revenueUpliftStatus} onChange={(x) => setV('revenueUpliftStatus', x)} options={STATUS} ariaLabel="Revenue uplift status" />
                  </Td>
                  <Td right>{money(v.revenueUpliftMonthly, cur)}</Td>
                </tr>
                <tr className="bg-canvas">
                  <Td strong>Financial benefit</Td>
                  <Td colSpan={2} className="text-xs text-muted">
                    Validated {moneyCompact(v.validatedBenefitMonthly, cur)} · Assumed {moneyCompact(v.assumedBenefitMonthly, cur)}
                  </Td>
                  <Td right strong>
                    {money(v.financialBenefitMonthly, cur)}
                  </Td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Monthly value versus charge</div>
            <ValueChart res={res} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Annual financial benefit" value={moneyCompact(v.annualFinancialBenefit, cur)} sub={`${moneyCompact(v.annualValidatedBenefit, cur)} validated`} tip={TIPS.financialBenefit} />
          <Stat label="Annual net financial benefit" value={moneyCompact(v.annualNetFinancialBenefit, cur)} sub="Benefit − recurring charges (yr 1)" tone={v.annualNetFinancialBenefit >= 0 ? 'good' : 'bad'} />
          <Stat label="3-year ROI (business case)" value={pctFmt(v.roi3, 0)} sub={`Year 1: ${pctFmt(v.roiYear1, 0)}`} tip={TIPS.roi} tone={(v.roi3 ?? 0) >= 0 ? 'good' : 'bad'} emphasis />
          <Stat label="3-year ROI (validated only)" value={pctFmt(v.roi3Validated, 0)} tip={TIPS.roiValidated} tone={(v.roi3Validated ?? 0) >= 0 ? 'good' : 'warn'} />
          <Stat label="Payback period" value={months(v.paybackMonths)} tip={TIPS.payback} />
        </div>
        {v.financialBenefitMonthly === 0 && (
          <div className="mt-4">
            <Callout tone="warn">No financial benefit has been entered, so ROI is −100% by definition. The capacity value of {moneyCompact(v.capacityValueMonthly, cur)} per month is productivity, not cash.</Callout>
          </div>
        )}
      </Card>

      {res.sdlc && <SdlcValue est={est} res={res} update={update} />}
    </div>
  );
}

function SdlcValue({ est, res, update }: { est: EstimateInputs; res: EstimateResults; update: Up }) {
  const s = res.sdlc!;
  const cur = res.currency;
  const setM = (k: SdlcMetricKey, patch: Partial<NonNullable<EstimateInputs['sdlc']>['metrics'][SdlcMetricKey]>) =>
    update((e) => ({ ...e, sdlc: { ...e.sdlc!, metrics: { ...e.sdlc!.metrics, [k]: { ...e.sdlc!.metrics[k], ...patch } } } }));
  return (
    <Card>
      <CardTitle sub="Gains are projected only where a measured or clearly assumed baseline exists. With no baseline, nothing is claimed.">SDLC delivery metrics</CardTitle>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cost per accepted development task" value={unitPrice(s.costPerAcceptedTask, cur)} sub={`Client price: ${unitPrice(s.pricePerAcceptedTask, cur)}`} />
        <Stat label="Cost per release" value={unitPrice(s.costPerRelease, cur)} sub={`Client price: ${unitPrice(s.pricePerRelease, cur)}`} />
        <Stat label="Stories per month" value={num(s.storiesPerMonth)} sub={`${num(s.storyPointsPerMonth)} story points — not billable`} />
        <Stat label="Work items driving volume" value={num(s.derivedVolume, 1)} sub={s.driverLabel} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr>
              <Th>Metric</Th>
              <Th>Baseline source</Th>
              <Th right>Baseline</Th>
              <Th right>Assumed improvement</Th>
              <Th right>Projected</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {s.metrics.map((m) => (
              <tr key={m.key}>
                <Td className="text-ink">
                  {m.label} <span className="text-[11px] text-faint">({m.unit})</span>
                </Td>
                <Td className="w-40">
                  <Select<BaselineSource>
                    value={m.source}
                    onChange={(v) => setM(m.key, { source: v })}
                    options={[
                      { value: 'measured', label: 'Measured' },
                      { value: 'assumed', label: 'Assumed' },
                      { value: 'none', label: 'No baseline' },
                    ]}
                    ariaLabel={`${m.label} baseline source`}
                  />
                </Td>
                <Td right className="w-32">
                  <NumberInput value={m.baseline} nullable onChange={(v) => setM(m.key, { baseline: v })} ariaLabel={`${m.label} baseline`} placeholder="—" />
                </Td>
                <Td right className="w-32">
                  <NumberInput value={m.improvementPct} onChange={(v) => setM(m.key, { improvementPct: v ?? 0 })} suffix="%" min={0} max={100} ariaLabel={`${m.label} improvement`} />
                </Td>
                <Td right strong>
                  {m.projected != null ? num(m.projected, 2) : '—'}
                </Td>
                <Td>
                  {m.claimed ? <Badge tone={m.source === 'measured' ? 'brand' : 'warn'}>{m.source === 'measured' ? 'Measured baseline' : 'Assumed baseline'}</Badge> : <Badge>Not claimed</Badge>}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted">{est.sdlc ? 'Improvements are planning assumptions until measured after deployment.' : ''}</p>
    </Card>
  );
}

