import { D, d, div, n, n0, pct, clamp, sum, ZERO, ONE, priceFromMargin, type Dec } from './decimal';
import type {
  Complexity,
  CostLine,
  CostPool,
  EstimateInputs,
  ImplementationResult,
  OperatingResult,
  RateCard,
  TokenResult,
  VolumeResult,
} from './types';
import { COMPLEXITIES, COST_POOLS } from './types';

/* ------------------------------------------------------------------------- */
/*  Helpers                                                                  */
/* ------------------------------------------------------------------------- */

/** Units of the estimate currency per 1 USD. */
export const fxRate = (rc: RateCard, currency: EstimateInputs['currency']): Dec => d(rc.fx[currency] ?? 1);

/** Converts people rates from the rate card's resource currency into the estimate currency. */
export const resourceFx = (rc: RateCard, currency: EstimateInputs['currency']): Dec =>
  d(rc.fx[currency] ?? 1).div(d(rc.fx[rc.resourceCurrency] ?? 1));

/** A designation from the people rate card, or undefined. */
export const findResource = (rc: RateCard, id: string) => rc.resourceRates.find((r) => r.id === id);

/** "Implement · Manager" style label for a designation id. */
export const resourceLabel = (rc: RateCard, id: string) => {
  const r = findResource(rc, id);
  return r ? `${r.memberFirm} · ${r.designation}` : id;
};

/** Discount off rack rate as a fraction 0–1. */
export const discountFraction = (inp: EstimateInputs): Dec => clamp(pct(inp.discountPct ?? 0), 0, 1);

/** Convert an amount between currencies through USD. */
export const convert = (rc: RateCard, amount: number, from: EstimateInputs['currency'], to: EstimateInputs['currency']): Dec =>
  d(amount).div(d(rc.fx[from] ?? 1)).times(d(rc.fx[to] ?? 1));

/** Normalised complexity shares (sum = 1). */
export function complexityShares(inp: EstimateInputs): Record<Complexity, Dec> {
  const shares: Record<Complexity, Dec> = { low: ZERO, medium: ZERO, high: ZERO };
  if (inp.useComplexityMix) {
    const total = sum(...COMPLEXITIES.map((c) => Math.max(0, inp.complexityMix[c] ?? 0)));
    if (total.gt(0)) {
      for (const c of COMPLEXITIES) shares[c] = d(Math.max(0, inp.complexityMix[c] ?? 0)).div(total);
      return shares;
    }
  }
  shares[inp.complexity] = ONE;
  return shares;
}

/* ------------------------------------------------------------------------- */
/*  Volume funnel                                                            */
/* ------------------------------------------------------------------------- */

export interface VolumeCalc {
  V: Dec;
  unique: Dec;
  duplicates: Dec;
  executions: Dec;
  retries: Dec;
  accepted: Dec;
  failed: Dec;
  abuWeight: Dec;
  effort: Dec;
  weightedAbus: Dec;
}

/**
 * Submitted → unique (duplicates removed) → accepted (success rate).
 * Executions include every retry and failed attempt, so their cost is incurred,
 * but only unique accepted transactions become ABUs — a transaction is never
 * counted twice, however many times it is submitted or retried.
 */
export function computeVolume(inp: EstimateInputs, rc: RateCard): VolumeCalc {
  const V = D.max(0, d(inp.monthlyVolume));
  const dup = clamp(pct(inp.duplicateRatePct), 0, 1);
  const unique = V.times(ONE.minus(dup));
  const duplicates = V.minus(unique);
  const s = clamp(pct(inp.successRate), 0, 1);
  const r = D.max(0, pct(inp.retryRatePct));
  const executions = V.times(ONE.plus(r));
  const accepted = unique.times(s);
  const failed = unique.minus(accepted);
  const shares = complexityShares(inp);
  const abuWeight = sum(...COMPLEXITIES.map((c) => shares[c].times(d(rc.abuWeights[c]))));
  const effort = sum(...COMPLEXITIES.map((c) => shares[c].times(d(rc.effortMultipliers[c]))));
  return {
    V,
    unique,
    duplicates,
    executions,
    retries: executions.minus(V),
    accepted,
    failed,
    abuWeight,
    effort,
    weightedAbus: accepted.times(abuWeight),
  };
}

export const volumeResult = (v: VolumeCalc): VolumeResult => ({
  submitted: n0(v.V),
  unique: n0(v.unique),
  duplicates: n0(v.duplicates),
  executions: n0(v.executions),
  retries: n0(v.retries),
  accepted: n0(v.accepted),
  failed: n0(v.failed),
  abuWeight: n0(v.abuWeight),
  effortFactor: n0(v.effort),
  weightedAbus: n0(v.weightedAbus),
});

/* ------------------------------------------------------------------------- */
/*  Monthly operating cost                                                   */
/* ------------------------------------------------------------------------- */

export interface OperatingCalc {
  vol: VolumeCalc;
  quantities: {
    inputTokens: Dec;
    inputUncached: Dec;
    inputCached: Dec;
    outputTokens: Dec;
    embeddingTokens: Dec;
    vectorQueries: Dec;
    ocrPages: Dec;
    toolCalls: Dec;
    orchestrationRuns: Dec;
  };
  lines: { key: string; label: string; pool: CostPool; monthly: Dec; quantity: Dec | null; unit: string; rate: Dec | null; per: number; note: string }[];
  pools: Record<CostPool, Dec>;
  llm: { input: Dec; cached: Dec; output: Dec; total: Dec };
  agentOps: { id: string; label: string; designation: string; hours: Dec; costRate: Dec; rackRate: Dec; monthly: Dec; rackMonthly: Dec }[];
  agentOpsTotal: Dec;
  agentOpsOverridden: boolean;
  /** AgentOps team at rack rates per month; null when the cost is overridden. */
  agentOpsRack: Dec | null;
  total: Dec;
  failureCost: Dec;
}

export function computeOperating(inp: EstimateInputs, rc: RateCard, vol = computeVolume(inp, rc)): OperatingCalc {
  const fx = fxRate(rc, inp.currency);
  const usd = (v: number) => d(v).times(fx);
  const model = rc.models.find((m) => m.id === inp.modelId) ?? rc.models[0];
  const agents = D.max(0, d(inp.agents));
  const { V, unique, executions, effort } = vol;

  /* ---- AI consumption quantities -------------------------------------- */
  // Tokens are consumed on every execution: first attempts, retries and
  // attempts that ultimately fail.
  const inputTokens = executions.times(d(inp.callsPerTxn)).times(d(inp.inputTokensPerCall)).times(effort);
  const cachedShare = clamp(pct(inp.cachedInputPct), 0, 1);
  // A cached input token is billed once, at the cached rate — never also at
  // the full input rate.
  const inputCached = inputTokens.times(cachedShare);
  const inputUncached = inputTokens.minus(inputCached);
  const outputTokens = executions.times(d(inp.callsPerTxn)).times(d(inp.outputTokensPerCall)).times(effort);
  const embeddingTokens = executions.times(d(inp.embeddingTokensPerTxn)).times(effort);
  const vectorQueries = executions.times(d(inp.ragQueriesPerTxn)).times(effort);
  // OCR runs once per submitted document; retries reuse the extracted text,
  // so pages are not charged again (no overlapping compute charge).
  const ocrPages = V.times(d(inp.ocrPagesPerTxn)).times(effort);
  const toolCalls = executions.times(d(inp.toolCallsPerTxn)).times(effort);
  const orchestrationRuns = executions;

  const rIn = usd(model?.inputPer1M ?? 0);
  const rCached = usd(model?.cachedInputPer1M ?? 0);
  const rOut = usd(model?.outputPer1M ?? 0);
  const llmInput = inputUncached.div(1e6).times(rIn);
  const llmCached = inputCached.div(1e6).times(rCached);
  const llmOutput = outputTokens.div(1e6).times(rOut);
  const rEmb = usd(rc.embeddingPer1M);
  const rVec = usd(rc.vectorQueryPer1K);
  const rOcr = usd(rc.ocrPerPage);
  const rTool = usd(rc.toolCallCost);
  const rOrch = inp.orchestrationCostPerRunOverride != null ? d(inp.orchestrationCostPerRunOverride) : usd(rc.orchestrationPerRun);
  const embedding = embeddingTokens.div(1e6).times(rEmb);
  const vector = vectorQueries.div(1000).times(rVec);
  const ocr = ocrPages.times(rOcr);
  const tools = toolCalls.times(rTool);
  const orchestration = orchestrationRuns.times(rOrch);

  /* ---- Platform -------------------------------------------------------- */
  const hostingMult = d(rc.hostingMultipliers[inp.hosting] ?? 1);
  const infra =
    inp.infraOverride != null
      ? d(inp.infraOverride)
      : usd(rc.infraBasePerMonth).plus(usd(rc.infraPerAgentPerMonth).times(agents)).times(hostingMult);
  const observability = inp.observabilityOverride != null ? d(inp.observabilityOverride) : usd(rc.observabilityPerAgentPerMonth).times(agents);
  const evaluation = D.max(0, d(inp.evalCostMonthly));
  const cicd = inp.sdlc ? D.max(0, d(inp.sdlc.cicdMonthlyCost)) : ZERO;
  const other = D.max(0, d(inp.otherMonthly));

  /* ---- AgentOps -------------------------------------------------------- */
  // AgentOps team: hours per role (base + per agent) × SLA multiplier, costed
  // at each designation's cost rate. Rack rates give the list-price fee.
  const slaMult = d(rc.slaMultipliers[inp.sla] ?? 1);
  const resFx = resourceFx(rc, inp.currency);
  const agentOps = rc.agentOpsTeam.map((t) => {
    const res = findResource(rc, t.resourceId);
    const hours = D.max(0, d(t.baseHoursPerMonth).plus(d(t.hoursPerAgentPerMonth).times(agents)).times(slaMult));
    const costRate = d(res?.costRatePerHour ?? 0).times(resFx);
    const rackRate = d(res?.rackRatePerHour ?? 0).times(resFx);
    return {
      id: t.id,
      label: t.label,
      designation: resourceLabel(rc, t.resourceId),
      hours,
      costRate,
      rackRate,
      monthly: hours.times(costRate),
      rackMonthly: hours.times(rackRate),
    };
  });
  const agentOpsComputed = sum(...agentOps.map((a) => a.monthly));
  const agentOpsHours = sum(...agentOps.map((a) => a.hours));
  const agentOpsOverridden = inp.agentOpsOverride != null;
  const agentOpsTotal = agentOpsOverridden ? D.max(0, d(inp.agentOpsOverride)) : agentOpsComputed;
  const agentOpsRack = agentOpsOverridden ? null : sum(...agentOps.map((a) => a.rackMonthly));

  /* ---- Human review (provider-side human-in-the-loop) ------------------ */
  const reviewed = unique.times(clamp(pct(inp.humanReviewRatePct), 0, 1));
  const reviewHours = reviewed.times(d(inp.humanReviewMinutes)).div(60);
  const rReview = d(inp.humanReviewCostPerHour);
  const humanReview = reviewHours.times(rReview);

  const L = (
    key: string,
    label: string,
    pool: CostPool,
    monthly: Dec,
    quantity: Dec | null,
    unit: string,
    rate: Dec | null,
    per: number,
    note = '',
  ) => ({ key, label, pool, monthly, quantity, unit, rate, per, note });

  const lines = [
    L('llm-input', 'LLM input tokens', 'consumption', llmInput, inputUncached, 'uncached input tokens', rIn, 1e6, model ? `${model.name}` : ''),
    L('llm-cached', 'LLM cached input tokens', 'consumption', llmCached, inputCached, 'cached input tokens', rCached, 1e6, 'Billed once at the cached rate'),
    L('llm-output', 'LLM output tokens', 'consumption', llmOutput, outputTokens, 'output tokens', rOut, 1e6),
    L('ocr', 'OCR and document extraction', 'consumption', ocr, ocrPages, 'pages', rOcr, 1, 'Once per submitted document; retries reuse extracted text'),
    L('embeddings', 'Embeddings', 'consumption', embedding, embeddingTokens, 'embedding tokens', rEmb, 1e6),
    L('vector', 'Vector search', 'consumption', vector, vectorQueries, 'queries', rVec, 1000),
    L('orchestration', 'Agent orchestration', 'consumption', orchestration, orchestrationRuns, 'agent runs', rOrch, 1),
    L('tools', 'Tool / API execution', 'consumption', tools, toolCalls, 'tool calls', rTool, 1),
    L('infra', 'Cloud infrastructure', 'platform', infra, null, '', null, 1, inp.infraOverride != null ? 'Manual override' : `Base + per agent × ${inp.hosting} hosting factor`),
    L('observability', 'Monitoring & observability tooling', 'platform', observability, null, '', null, 1, 'Tooling only — monitoring staff effort sits in AgentOps'),
    L('evaluation', 'AI quality / evaluation runs', 'platform', evaluation, null, '', null, 1, 'Eval compute and golden-set runs'),
    ...(inp.sdlc ? [L('cicd', 'CI/CD and development environments', 'platform', cicd, null, '', null, 1)] : []),
    L('agentops', 'AgentOps services', 'agentops', agentOpsTotal, agentOpsOverridden ? null : agentOpsHours, 'team hours', null, 1, agentOpsOverridden ? 'Manual override' : `Operate team at rate-card cost rates, ${inp.sla} SLA`),
    L('human-review', 'Human-in-the-loop review', 'service', humanReview, reviewHours, 'review hours', rReview, 1),
    L('other', 'Other attributable costs', 'service', other, null, '', null, 1),
  ];

  const pools = Object.fromEntries(COST_POOLS.map((p) => [p, sum(...lines.filter((l) => l.pool === p).map((l) => l.monthly))])) as Record<
    CostPool,
    Dec
  >;
  const total = sum(...lines.map((l) => l.monthly));

  /* ---- Cost of failures and retries (already inside total) ------------- */
  // Execution-driven cost not ending in an accepted transaction, plus
  // per-document and per-review cost of transactions that were not accepted.
  const execDriven = sum(llmInput, llmCached, llmOutput, embedding, vector, tools, orchestration);
  const wastedExecShare = executions.gt(0) ? D.max(0, executions.minus(vol.accepted)).div(executions) : ZERO;
  const failedDocShare = V.gt(0) ? D.max(0, V.minus(vol.accepted)).div(V) : ZERO;
  const failedReviewShare = unique.gt(0) ? D.max(0, unique.minus(vol.accepted)).div(unique) : ZERO;
  const failureCost = execDriven.times(wastedExecShare).plus(ocr.times(failedDocShare)).plus(humanReview.times(failedReviewShare));

  return {
    vol,
    quantities: { inputTokens, inputUncached, inputCached, outputTokens, embeddingTokens, vectorQueries, ocrPages, toolCalls, orchestrationRuns },
    lines,
    pools,
    llm: { input: llmInput, cached: llmCached, output: llmOutput, total: sum(llmInput, llmCached, llmOutput) },
    agentOps,
    agentOpsTotal,
    agentOpsOverridden,
    agentOpsRack,
    total,
    failureCost,
  };
}

export function operatingResult(op: OperatingCalc, inp: EstimateInputs): OperatingResult {
  const lines: CostLine[] = op.lines.map((l) => ({
    key: l.key,
    label: l.label,
    pool: l.pool,
    monthly: n0(l.monthly),
    quantity: n(l.quantity),
    unit: l.unit,
    rate: n(l.rate, 8),
    per: l.per,
    note: l.note,
  }));
  return {
    lines,
    pools: Object.fromEntries(COST_POOLS.map((p) => [p, n0(op.pools[p])])) as Record<CostPool, number>,
    llm: { input: n0(op.llm.input), cached: n0(op.llm.cached), output: n0(op.llm.output), total: n0(op.llm.total) },
    total: n0(op.total),
    annual: n0(op.total.times(12)),
    perSubmittedTxn: n(div(op.total, op.vol.V)),
    perAgent: n(div(op.total, inp.agents)),
    agentOpsComponents: op.agentOps.map((a) => ({
      id: a.id,
      label: a.label,
      designation: a.designation,
      hours: n0(a.hours),
      costRate: n0(a.costRate),
      rackRate: n0(a.rackRate),
      monthly: n0(a.monthly),
      rackMonthly: n0(a.rackMonthly),
    })),
    agentOpsOverridden: op.agentOpsOverridden,
    agentOpsRackFee: op.agentOpsRack ? n0(op.agentOpsRack) : null,
    failureAndRetryCost: n0(op.failureCost),
  };
}

export const tokenResult = (op: OperatingCalc): TokenResult => {
  const q = op.quantities;
  const total = q.inputTokens.plus(q.outputTokens);
  return {
    inputUncached: n0(q.inputUncached),
    inputCached: n0(q.inputCached),
    output: n0(q.outputTokens),
    total: n0(total),
    perSubmittedTxn: n0(div(total, op.vol.V) ?? ZERO),
  };
};

/* ------------------------------------------------------------------------- */
/*  One-time implementation                                                  */
/* ------------------------------------------------------------------------- */

export interface ImplementationCalc {
  cost: Dec;
  price: Dec;
  hours: Dec;
  /** Hours × rack rate before discount; null in simple mode. */
  rack: Dec | null;
  basis: 'discount' | 'margin';
  activities: { id: string; label: string; role: string; hours: Dec; rate: Dec; cost: Dec; rackRate: Dec; rackFee: Dec }[];
}

/**
 * One-time implementation. Delivery cost = hours × designation cost rate.
 * Selling price, by the estimate's people-pricing basis:
 *   discount: hours × rack rate × (1 − discount)
 *   margin:   delivery cost ÷ (1 − target implementation margin)
 * Simple mode has no rack fee, so it always prices on margin.
 */
export function computeImplementation(inp: EstimateInputs, rc: RateCard): ImplementationCalc {
  const fx = resourceFx(rc, inp.currency);
  const activities = inp.implActivities.map((a) => {
    const res = findResource(rc, a.roleId);
    const rate = d(res?.costRatePerHour ?? 0).times(fx);
    const rackRate = d(res?.rackRatePerHour ?? 0).times(fx);
    const hours = D.max(0, d(a.hours));
    return { id: a.id, label: a.label, role: resourceLabel(rc, a.roleId), hours, rate, cost: hours.times(rate), rackRate, rackFee: hours.times(rackRate) };
  });
  const simple = inp.implMode === 'simple';
  const detailedCost = sum(...activities.map((a) => a.cost));
  const hours = sum(...activities.map((a) => a.hours));
  const cost = simple ? D.max(0, d(inp.implSimpleCost)) : detailedCost;
  const rack = simple ? null : sum(...activities.map((a) => a.rackFee));
  const basis = inp.peoplePricing === 'discount' && rack != null ? 'discount' : 'margin';
  const price = basis === 'discount' && rack ? rack.times(ONE.minus(discountFraction(inp))) : priceFromMargin(cost, inp.implMarginPct);
  return { cost, price, hours, rack, basis, activities };
}

export const implementationResult = (impl: ImplementationCalc, inp: EstimateInputs): ImplementationResult => {
  const rackPos = impl.rack && impl.rack.gt(0) ? impl.rack : null;
  const atTarget = priceFromMargin(impl.cost, inp.implMarginPct);
  return {
    mode: inp.implMode,
    activities: impl.activities.map((a) => ({
      id: a.id,
      label: a.label,
      role: a.role,
      hours: n0(a.hours),
      rate: n0(a.rate),
      cost: n0(a.cost),
      rackRate: n0(a.rackRate),
      rackFee: n0(a.rackFee),
    })),
    hours: n0(impl.hours),
    deliveryCost: n0(impl.cost),
    marginPct: inp.implMarginPct,
    pricingBasis: impl.basis,
    rackFee: impl.rack ? n0(impl.rack) : null,
    discountPct: inp.discountPct ?? 0,
    effectiveDiscountPct: rackPos ? n0(ONE.minus(impl.price.div(rackPos)).times(100), 6) : null,
    actualMarginPct: impl.price.gt(0) ? n0(impl.price.minus(impl.cost).div(impl.price).times(100), 6) : 0,
    discountAtTargetMargin: rackPos ? n0(ONE.minus(atTarget.div(rackPos)).times(100), 6) : null,
    price: n0(impl.price),
  };
};
