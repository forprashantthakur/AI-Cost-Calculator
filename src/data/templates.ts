import type { CurrencyCode, EstimateInputs, ImplActivityInput, RateCard, SdlcInputs } from '@/engine/types';
import { DEFAULT_SDLC, getProcess, type ProcessDef } from './catalog';

const round = (v: number, step = 1) => Math.round(v / step) * step;
const money = (v: number) => (Math.abs(v) >= 1000 ? round(v, 100) : Math.round(v * 100) / 100);

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `est-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Employee cost per hour: localised INR rates for India estimates, USD converted by FX otherwise. */
export const laborRate = (proc: ProcessDef, currency: CurrencyCode, rc: RateCard) =>
  currency === 'INR' ? proc.defaults.laborINR : money(proc.defaults.laborUSD * (rc.fx[currency] ?? 1));

export function defaultActivities(proc: ProcessDef, rc: RateCard, agents: number, complexity: EstimateInputs['complexity']): ImplActivityInput[] {
  const cf = rc.implComplexityFactor[complexity] ?? 1;
  const af = 1 + rc.implPerExtraAgent * Math.max(0, agents - 1);
  const ragless = proc.defaults.ragQueriesPerTxn === 0 && proc.defaults.embeddingTokensPerTxn === 0;
  return rc.implActivities.map((a) => ({
    id: a.id,
    label: a.label,
    roleId: a.roleId,
    hours: round(a.baseHours * cf * af * proc.defaults.implScale * (a.id === 'rag' && ragless ? 0.25 : 1), 4),
  }));
}

export function defaultSdlc(currency: CurrencyCode, rc: RateCard): SdlcInputs {
  const { cicdMonthlyCostUSD, metrics, ...rest } = DEFAULT_SDLC;
  return {
    ...rest,
    cicdMonthlyCost: money(cicdMonthlyCostUSD * (rc.fx[currency] ?? 1)),
    metrics: JSON.parse(JSON.stringify(metrics)),
  };
}

export function implCostFromActivities(acts: ImplActivityInput[], rc: RateCard, currency: CurrencyCode) {
  const fx = (rc.fx[currency] ?? 1) * (rc.deliveryCostIndex?.[currency] ?? 1);
  return acts.reduce((s, a) => s + a.hours * (rc.implRoles.find((r) => r.id === a.roleId)?.ratePerHour ?? 0) * fx, 0);
}

/**
 * Create a complete, computable estimate from a process template. Every value
 * is an editable, illustrative starting point.
 */
export function createEstimate(
  opts: { processId: string; industryId: string; functionId?: string; currency: CurrencyCode; name?: string; client?: string; customProcessName?: string },
  rc: RateCard,
): EstimateInputs {
  const base = getProcess(opts.processId);
  const proc: ProcessDef = { ...base, defaults: { ...base.defaults, ...((rc.processOverrides?.[base.id] ?? {}) as Partial<ProcessDef['defaults']>) } };
  const dft = proc.defaults;
  const fx = rc.fx[opts.currency] ?? 1;
  const labor = laborRate(proc, opts.currency, rc);
  const isSdlc = proc.functionId === 'sdlc';
  const sdlc = isSdlc ? defaultSdlc(opts.currency, rc) : null;
  const acts = defaultActivities(proc, rc, dft.agents, dft.complexity);
  const unit = proc.subscriptionUnit ?? (isSdlc ? 'team' : 'agent');
  const units = unit === 'developer' ? sdlc?.developers ?? 40 : unit === 'team' ? sdlc?.teams ?? 5 : unit === 'user' ? 2000 : dft.agents;
  const now = new Date().toISOString();

  return {
    id: newId(),
    name: opts.name ?? `${proc.name} estimate`,
    client: opts.client ?? '',
    createdAt: now,
    updatedAt: now,
    rateCardVersion: rc.version,
    status: 'draft',
    industryId: opts.industryId,
    functionId: opts.functionId ?? proc.functionId,
    processId: proc.id,
    customProcessName: opts.customProcessName ?? '',
    abuUnit: proc.abuUnit,
    acceptanceCriteria: proc.acceptance,
    workflowStages: proc.stages ?? [],
    currency: opts.currency,

    monthlyVolume: dft.volume,
    agents: dft.agents,
    complexity: dft.complexity,
    useComplexityMix: false,
    complexityMix: { low: 30, medium: 50, high: 20 },
    successRate: dft.successRate,
    manualMinutes: dft.manualMinutes,
    employeeCostPerHour: labor,
    aiAssistedMinutes: dft.aiAssistedMinutes,
    targetMargin: rc.defaultMargins.run,

    modelId: dft.modelId,
    callsPerTxn: dft.callsPerTxn,
    inputTokensPerCall: dft.inputTokensPerCall,
    outputTokensPerCall: dft.outputTokensPerCall,
    cachedInputPct: dft.cachedInputPct,
    ocrPagesPerTxn: dft.ocrPagesPerTxn,
    toolCallsPerTxn: dft.toolCallsPerTxn,
    ragQueriesPerTxn: dft.ragQueriesPerTxn,
    embeddingTokensPerTxn: dft.embeddingTokensPerTxn,
    retryRatePct: dft.retryRatePct,
    duplicateRatePct: dft.duplicateRatePct,
    humanReviewRatePct: dft.humanReviewRatePct,
    humanReviewMinutes: dft.humanReviewMinutes,
    humanReviewCostPerHour: labor,
    hosting: dft.hosting,
    sla: dft.sla,
    orchestrationCostPerRunOverride: null,
    infraOverride: null,
    observabilityOverride: null,
    agentOpsOverride: null,
    evalCostMonthly: money(60 * dft.agents * fx),
    otherMonthly: 0,
    volumeGrowthPct: dft.volumeGrowthPct,

    implMode: 'detailed',
    implSimpleCost: money(implCostFromActivities(acts, rc, opts.currency)),
    implActivities: acts,
    implMarginPct: rc.defaultMargins.implementation,

    commercial: {
      selectedModel: null,
      agentOpsBilling: 'auto',
      hybrid: null,
      contractYears: 3,
      escalationPct: 3,
      minMonthlyCommitment: 0,
      volumeTiers: [],
      subscriptionUnit: unit,
      subscriptionUnits: units,
      subscriptionPriceOverride: null,
      includedAbusOverride: null,
      overagePremiumPct: 15,
      abuPriceOverride: null,
      acuPriceOverride: null,
      agentOpsFeeOverride: null,
      gainsharePct: 20,
      clientPreference: 'none',
    },
    value: {
      cashRealisationPct: isSdlc ? 20 : dft.cashRealisationPct,
      cashRealisationStatus: 'assumed',
      costAvoidanceAnnual: 0,
      costAvoidanceStatus: 'assumed',
      revenueUpliftAnnual: 0,
      revenueUpliftStatus: 'assumed',
    },
    sdlc,
    notes: '',
  };
}

/**
 * Sum the token profiles of several SDLC stage agents into one multi-agent
 * workflow. Returns the fields to prefill; all remain editable.
 */
export function composeWorkflow(stageIds: string[]): Partial<EstimateInputs> | null {
  const stages = stageIds.map(getProcess).filter((p) => p.kind === 'sdlc-agent');
  if (!stages.length) return null;
  const s = (f: (p: ProcessDef) => number) => stages.reduce((a, p) => a + f(p), 0);
  const calls = s((p) => p.defaults.callsPerTxn);
  const weighted = (f: (p: ProcessDef) => number) => (calls ? s((p) => f(p) * p.defaults.callsPerTxn) / calls : 0);
  return {
    workflowStages: stages.map((p) => p.id),
    agents: stages.length,
    callsPerTxn: calls,
    inputTokensPerCall: round(weighted((p) => p.defaults.inputTokensPerCall), 100),
    outputTokensPerCall: round(weighted((p) => p.defaults.outputTokensPerCall), 50),
    toolCallsPerTxn: s((p) => p.defaults.toolCallsPerTxn),
    ragQueriesPerTxn: s((p) => p.defaults.ragQueriesPerTxn),
    embeddingTokensPerTxn: s((p) => p.defaults.embeddingTokensPerTxn),
    manualMinutes: s((p) => p.defaults.manualMinutes),
    aiAssistedMinutes: s((p) => p.defaults.aiAssistedMinutes),
  };
}

/** Convert every monetary input of an estimate to another currency. */
export function convertEstimateCurrency(inp: EstimateInputs, to: CurrencyCode, rc: RateCard): EstimateInputs {
  if (inp.currency === to) return inp;
  const f = (rc.fx[to] ?? 1) / (rc.fx[inp.currency] ?? 1);
  const c = (v: number) => money(v * f);
  const co = (v: number | null) => (v == null ? null : Math.round(v * f * 1e6) / 1e6);
  return {
    ...inp,
    currency: to,
    employeeCostPerHour: c(inp.employeeCostPerHour),
    humanReviewCostPerHour: c(inp.humanReviewCostPerHour),
    orchestrationCostPerRunOverride: co(inp.orchestrationCostPerRunOverride),
    infraOverride: co(inp.infraOverride),
    observabilityOverride: co(inp.observabilityOverride),
    agentOpsOverride: co(inp.agentOpsOverride),
    evalCostMonthly: c(inp.evalCostMonthly),
    otherMonthly: c(inp.otherMonthly),
    implSimpleCost: c(inp.implSimpleCost),
    commercial: {
      ...inp.commercial,
      minMonthlyCommitment: c(inp.commercial.minMonthlyCommitment),
      subscriptionPriceOverride: co(inp.commercial.subscriptionPriceOverride),
      abuPriceOverride: co(inp.commercial.abuPriceOverride),
      acuPriceOverride: co(inp.commercial.acuPriceOverride),
      agentOpsFeeOverride: co(inp.commercial.agentOpsFeeOverride),
    },
    value: { ...inp.value, costAvoidanceAnnual: c(inp.value.costAvoidanceAnnual), revenueUpliftAnnual: c(inp.value.revenueUpliftAnnual) },
    sdlc: inp.sdlc ? { ...inp.sdlc, cicdMonthlyCost: c(inp.sdlc.cicdMonthlyCost) } : null,
  };
}

/**
 * Switch an existing estimate to another process template, keeping its
 * identity, name, client, industry and currency.
 */
export function applyProcess(est: EstimateInputs, processId: string, functionId: string, rc: RateCard): EstimateInputs {
  const proc = getProcess(processId);
  const fresh = createEstimate({ processId, industryId: est.industryId, functionId, currency: est.currency, client: est.client }, rc);
  const autoName = !est.name || est.name.endsWith(' estimate');
  return {
    ...fresh,
    id: est.id,
    createdAt: est.createdAt,
    status: est.status,
    name: autoName ? `${proc.name} estimate` : est.name,
    commercial: { ...fresh.commercial, clientPreference: est.commercial.clientPreference },
  };
}
