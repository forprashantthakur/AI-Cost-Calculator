import { D, d, div, n, n0, pct, clamp, sum, ZERO, type Dec } from './decimal';
import type { EstimateInputs, RateCard, SdlcMetricKey, SdlcMetricResult, ValueResult } from './types';
import type { VolumeCalc } from './operating';

export interface BenefitCalc {
  manualHours: Dec;
  aiHours: Dec;
  hoursSaved: Dec;
  capacityValue: Dec;
  hard: Dec;
  avoidance: Dec;
  uplift: Dec;
  financial: Dec;
  validated: Dec;
  assumed: Dec;
}

/**
 * Client value for one month at a given volume.
 *
 * Capacity value (hours saved × loaded cost) is NOT cash. Only the share the
 * client actually converts into reduced spend (cash realisation), plus cost
 * avoidance and attributable revenue margin, counts as a financial benefit.
 * Transactions the agent does not complete fall back to fully manual handling.
 */
export function computeBenefits(inp: EstimateInputs, vol: VolumeCalc): BenefitCalc {
  const manualMin = D.max(0, d(inp.manualMinutes));
  const aiMin = D.max(0, d(inp.aiAssistedMinutes));
  const manualHours = vol.unique.times(manualMin).div(60);
  const aiHours = vol.accepted.times(aiMin).plus(vol.failed.times(manualMin)).div(60);
  const hoursSaved = manualHours.minus(aiHours);
  const capacityValue = hoursSaved.times(d(inp.employeeCostPerHour));
  const hard = D.max(0, capacityValue).times(clamp(pct(inp.value.cashRealisationPct), 0, 1));
  const avoidance = D.max(0, d(inp.value.costAvoidanceAnnual)).div(12);
  const uplift = D.max(0, d(inp.value.revenueUpliftAnnual)).div(12);
  const items: [Dec, string][] = [
    [hard, inp.value.cashRealisationStatus],
    [avoidance, inp.value.costAvoidanceStatus],
    [uplift, inp.value.revenueUpliftStatus],
  ];
  const validated = sum(...items.filter(([, s]) => s === 'validated').map(([v]) => v));
  const financial = sum(hard, avoidance, uplift);
  return { manualHours, aiHours, hoursSaved, capacityValue, hard, avoidance, uplift, financial, validated, assumed: financial.minus(validated) };
}

export interface YearCharge {
  year: number;
  benefitMonthly: Dec;
  validatedMonthly: Dec;
  /** Provider charges + client-paid pass-through, per month. */
  clientMonthly: Dec;
}

/**
 * ROI = (financial benefits − total AI investment) / total AI investment.
 * Investment = implementation price + every recurring charge the client pays
 * (provider charges plus any pass-through costs paid directly).
 */
export function computeValue(
  inp: EstimateInputs,
  rc: RateCard,
  b: BenefitCalc,
  implPrice: Dec,
  years: YearCharge[],
): ValueResult {
  const y1 = years[0];
  const annualBenefit = y1.benefitMonthly.times(12);
  const annualValidated = y1.validatedMonthly.times(12);
  const annualCharges = y1.clientMonthly.times(12);
  const year1Investment = implPrice.plus(annualCharges);
  const three = years.slice(0, 3);
  const threeBenefit = sum(...three.map((y) => y.benefitMonthly.times(12)));
  const threeValidated = sum(...three.map((y) => y.validatedMonthly.times(12)));
  const threeInvestment = implPrice.plus(sum(...three.map((y) => y.clientMonthly.times(12))));
  const roi = (benefit: Dec, inv: Dec) => {
    const r = div(benefit.minus(inv), inv);
    return r ? n(r.times(100), 6) : null;
  };
  const monthlyNet = y1.benefitMonthly.minus(y1.clientMonthly);
  let payback: number | null = null;
  if (monthlyNet.gt(0)) payback = n(implPrice.div(monthlyNet), 6);

  let cumulative = implPrice.neg();
  const yearly = three.map((y) => {
    const benefit = y.benefitMonthly.times(12);
    const investment = y.clientMonthly.times(12).plus(y.year === 1 ? implPrice : ZERO);
    const net = benefit.minus(investment);
    cumulative = cumulative.plus(benefit.minus(y.clientMonthly.times(12)));
    return {
      year: y.year,
      benefit: n0(benefit),
      validatedBenefit: n0(y.validatedMonthly.times(12)),
      investment: n0(investment),
      net: n0(net),
      cumulativeNet: n0(cumulative),
    };
  });

  return {
    manualHours: n0(b.manualHours),
    aiAssistedHours: n0(b.aiHours),
    hoursSaved: n0(b.hoursSaved),
    productivityPct: n(div(b.hoursSaved, b.manualHours)?.times(100) ?? null, 4),
    redeployableFte: n0(b.hoursSaved.div(d(rc.fteHoursPerMonth || 160))),
    capacityValueMonthly: n0(b.capacityValue),
    hardSavingsMonthly: n0(b.hard),
    costAvoidanceMonthly: n0(b.avoidance),
    revenueUpliftMonthly: n0(b.uplift),
    financialBenefitMonthly: n0(b.financial),
    validatedBenefitMonthly: n0(b.validated),
    assumedBenefitMonthly: n0(b.assumed),
    annualFinancialBenefit: n0(annualBenefit),
    annualValidatedBenefit: n0(annualValidated),
    annualClientCharges: n0(annualCharges),
    annualNetFinancialBenefit: n0(annualBenefit.minus(annualCharges)),
    year1Investment: n0(year1Investment),
    roiYear1: roi(annualBenefit, year1Investment),
    threeYearBenefit: n0(threeBenefit),
    threeYearValidatedBenefit: n0(threeValidated),
    threeYearInvestment: n0(threeInvestment),
    roi3: roi(threeBenefit, threeInvestment),
    roi3Validated: roi(threeValidated, threeInvestment),
    paybackMonths: payback,
    yearly,
  };
}

/* ------------------------------------------------------------------------- */
/*  SDLC delivery metrics                                                    */
/* ------------------------------------------------------------------------- */

export const SDLC_METRICS: { key: SdlcMetricKey; label: string; unit: string; higherIsBetter: boolean }[] = [
  { key: 'cycleTimeDays', label: 'Development cycle time', unit: 'days', higherIsBetter: false },
  { key: 'leadTimeHours', label: 'Lead time for changes', unit: 'hours', higherIsBetter: false },
  { key: 'reviewTurnaroundHours', label: 'Code review turnaround', unit: 'hours', higherIsBetter: false },
  { key: 'defectEscapeRatePct', label: 'Defect escape rate', unit: '%', higherIsBetter: false },
  { key: 'defectResolutionHours', label: 'Defect resolution time', unit: 'hours', higherIsBetter: false },
  { key: 'deploymentsPerMonth', label: 'Deployment frequency', unit: 'per month', higherIsBetter: true },
  { key: 'changeFailureRatePct', label: 'Change failure rate', unit: '%', higherIsBetter: false },
  { key: 'mttrHours', label: 'Mean time to restore', unit: 'hours', higherIsBetter: false },
];

/**
 * A gain is only projected when a baseline exists and is marked measured or
 * assumed. With no baseline, the metric is shown as "not claimed".
 */
export function computeSdlcMetrics(inp: EstimateInputs): SdlcMetricResult[] {
  if (!inp.sdlc) return [];
  return SDLC_METRICS.map((m) => {
    const mi = inp.sdlc!.metrics[m.key];
    const claimed = mi.source !== 'none' && mi.baseline != null;
    let projected: number | null = null;
    if (claimed) {
      const base = d(mi.baseline!);
      const f = clamp(pct(mi.improvementPct), 0, 1);
      projected = n(m.higherIsBetter ? base.times(f.plus(1)) : base.times(d(1).minus(f)), 4);
    }
    return { ...m, baseline: mi.baseline, projected, improvementPct: mi.improvementPct, source: mi.source, claimed };
  });
}
