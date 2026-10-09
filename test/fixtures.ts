import { DEFAULT_RATE_CARD } from '@/data/rateCard';
import { createEstimate } from '@/data/templates';
import type { EstimateInputs, RateCard } from '@/engine/types';

export const RC: RateCard = DEFAULT_RATE_CARD;

/**
 * A small, hand-calculable estimate (USD, frontier tier $5 / $25 / $0.50 per 1M):
 *   executions      = 1,000 × (1 + 25% retries)      = 1,250
 *   input tokens    = 1,250 × 2 calls × 1,000        = 2,500,000 (50% cached)
 *   LLM input       = 1.25M × $5    = $6.25
 *   LLM cached      = 1.25M × $0.50 = $0.625
 *   LLM output      = 1,250 × 2 × 500 = 1.25M × $25 = $31.25
 *   orchestration   = 1,250 × $0.002 = $2.50
 *   consumption     = $40.625;  platform = $1,000;  AgentOps = $500
 *   total           = $1,540.625 per month
 *   accepted        = 1,000 × 80% = 800 → 1,200 weighted ABUs (medium = 1.5)
 */
export function simpleEstimate(patch: Partial<EstimateInputs> = {}): EstimateInputs {
  const base = createEstimate({ processId: 'custom', industryId: 'other', currency: 'USD' }, RC);
  return {
    ...base,
    monthlyVolume: 1000,
    agents: 1,
    complexity: 'medium',
    useComplexityMix: false,
    successRate: 80,
    manualMinutes: 12,
    aiAssistedMinutes: 3,
    employeeCostPerHour: 30,
    targetMargin: 40,
    modelId: 'frontier',
    callsPerTxn: 2,
    inputTokensPerCall: 1000,
    outputTokensPerCall: 500,
    cachedInputPct: 50,
    ocrPagesPerTxn: 0,
    toolCallsPerTxn: 0,
    ragQueriesPerTxn: 0,
    embeddingTokensPerTxn: 0,
    retryRatePct: 25,
    duplicateRatePct: 0,
    humanReviewRatePct: 0,
    humanReviewMinutes: 0,
    infraOverride: 1000,
    observabilityOverride: 0,
    agentOpsOverride: 500,
    evalCostMonthly: 0,
    otherMonthly: 0,
    volumeGrowthPct: 0,
    implMode: 'simple',
    implSimpleCost: 10000,
    implMarginPct: 30,
    ...patch,
    commercial: {
      ...base.commercial,
      agentOpsBilling: 'bundled',
      selectedModel: 'abu',
      escalationPct: 0,
      subscriptionUnits: 1,
      ...(patch.commercial ?? {}),
    },
    value: { ...base.value, cashRealisationPct: 50, ...(patch.value ?? {}) },
  };
}
