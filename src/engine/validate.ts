import type { ProcessDef } from '@/data/catalog';
import type { EstimateInputs, EstimateResults, Issue, RateCard } from './types';

export function validate(inp: EstimateInputs, raw: EstimateInputs, rc: RateCard, r: EstimateResults, proc: ProcessDef): Issue[] {
  const issues: Issue[] = [];
  const err = (message: string, field?: string) => issues.push({ level: 'error', message, field });
  const warn = (message: string, field?: string) => issues.push({ level: 'warning', message, field });
  const info = (message: string, field?: string) => issues.push({ level: 'info', message, field });

  const nonNeg: (keyof EstimateInputs)[] = [
    'monthlyVolume', 'agents', 'manualMinutes', 'employeeCostPerHour', 'aiAssistedMinutes', 'callsPerTxn', 'inputTokensPerCall',
    'outputTokensPerCall', 'ocrPagesPerTxn', 'toolCallsPerTxn', 'ragQueriesPerTxn', 'embeddingTokensPerTxn', 'retryRatePct',
    'humanReviewMinutes', 'humanReviewCostPerHour', 'evalCostMonthly', 'otherMonthly', 'implSimpleCost',
  ];
  for (const k of nonNeg) if (typeof inp[k] === 'number' && (inp[k] as number) < 0) err(`${String(k)} cannot be negative.`, String(k));

  if (inp.monthlyVolume <= 0) warn('Monthly volume is zero: there are no ABUs, so per-unit costs and prices cannot be calculated. Only fixed costs are shown.', 'monthlyVolume');
  if (inp.successRate <= 0 && inp.monthlyVolume > 0) warn('A 0% success rate produces no billable ABUs; all run cost is unrecovered under ABU pricing.', 'successRate');
  if (inp.successRate > 100 || inp.successRate < 0) err('Success rate must be between 0% and 100%.', 'successRate');
  if (inp.targetMargin >= 95) err('Target gross margin is capped at 95% (price = cost ÷ (1 − margin)).', 'targetMargin');
  if (inp.targetMargin < 0) err('Target gross margin cannot be negative.', 'targetMargin');
  if (inp.implMarginPct >= 95) err('Implementation margin is capped at 95%.', 'implMarginPct');
  if (inp.agents < 1) warn('At least one AI agent is normally required.', 'agents');
  if (inp.cachedInputPct > 100 || inp.cachedInputPct < 0) err('Cached input share must be between 0% and 100%.', 'cachedInputPct');
  if (inp.aiAssistedMinutes > inp.manualMinutes)
    warn('AI-assisted time is higher than current manual time — the agent would reduce productivity.', 'aiAssistedMinutes');
  if (inp.useComplexityMix) {
    const s = inp.complexityMix.low + inp.complexityMix.medium + inp.complexityMix.high;
    if (Math.abs(s - 100) > 0.01) warn(`Complexity mix adds up to ${s}% — it has been normalised to 100%.`, 'complexityMix');
  }
  if (!rc.models.find((m) => m.id === inp.modelId)) warn('Selected model is not in the rate card — the first model was used.', 'modelId');
  if (rc.models.some((m) => m.id === inp.modelId && m.illustrative))
    info('Model token rates are illustrative placeholders. Replace them with contracted rates in Settings before client use.');
  if ((inp.commercial.subscriptionUnits ?? 0) <= 0) warn('Subscription units are zero, so subscription fees cannot be calculated.', 'subscriptionUnits');
  if (inp.commercial.contractYears < 1) err('Contract duration must be at least one year.', 'contractYears');

  const v = inp.value;
  const anyAssumed =
    (v.cashRealisationPct > 0 && v.cashRealisationStatus === 'assumed') ||
    (v.costAvoidanceAnnual > 0 && v.costAvoidanceStatus === 'assumed') ||
    (v.revenueUpliftAnnual > 0 && v.revenueUpliftStatus === 'assumed');
  if (anyAssumed) info('Some financial benefits are assumptions, not validated actuals. ROI is shown both with and without them.');
  if (r.value.financialBenefitMonthly === 0)
    info('No financial benefit is entered. Productivity (capacity) value is shown separately and is not counted as cash.');
  if ((r.selectedModel === 'gainshare' || (r.selectedModel === 'hybrid' && r.recommendation.hybrid?.gainshare)) && r.value.validatedBenefitMonthly < r.value.financialBenefitMonthly)
    warn('Gainshare is payable only on independently validated benefits; part of the benefit base is still assumed.');

  const sel = r.selected;
  if (sel.recurringMargin != null && sel.recurringMargin < 0) warn(`The selected model (${sel.label}) runs at a negative recurring margin at baseline volume.`);
  for (const m of Object.values(r.models)) {
    if (m.doubleRecovery) err(`${m.label}: a cost pool is recovered by more than one revenue component.`);
  }
  if (inp.commercial.abuPriceOverride != null && r.abu.costPerAbuRecoverable != null && inp.commercial.abuPriceOverride < r.abu.costPerAbuRecoverable)
    warn('The customer-specific ABU price is below the cost per ABU.', 'abuPriceOverride');

  if (inp.sdlc) {
    const none = Object.values(inp.sdlc.metrics).filter((m) => m.source === 'none' || m.baseline == null).length;
    if (none) info(`${none} SDLC metric(s) have no baseline, so no improvement is claimed for them.`);
    if (proc.sdlcDriver && !raw.sdlc?.deriveVolume)
      info('Monthly volume is entered manually rather than derived from SDLC drivers.');
  }
  if (inp.sla === 'premium' && r.agentOpsBilling === 'bundled')
    info('Premium SLA with AgentOps bundled into unit prices — consider billing AgentOps separately for transparency.');
  return issues;
}
