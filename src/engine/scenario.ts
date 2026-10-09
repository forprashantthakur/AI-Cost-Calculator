import { computeEstimate, resolveInputs } from './compute';
import type { Complexity, EstimateInputs, EstimateResults, RateCard } from './types';

/** What-if levers. Undefined = unchanged from the baseline estimate. */
export interface ScenarioLevers {
  volumeFactor?: number;
  successRate?: number;
  modelId?: string;
  tokenFactor?: number;
  retryFactor?: number;
  cachedInputPct?: number;
  agents?: number;
  agentOpsMonthly?: number | null;
  complexity?: Complexity;
  targetMargin?: number;
  subscriptionPrice?: number | null;
}

export type ScenarioPreset = 'baseline' | 'optimized' | 'stress';

export const PRESET_INFO: Record<ScenarioPreset, { label: string; description: string }> = {
  baseline: { label: 'Baseline', description: 'The estimate exactly as entered.' },
  optimized: {
    label: 'Optimized',
    description: 'Prompt and cache tuning: 20% fewer tokens, +20 pts cache hits, half the retries and +7 pts success.',
  },
  stress: {
    label: 'Stress',
    description: 'Adverse run: 25% more volume, 40% more tokens, double retries and −15 pts success.',
  },
};

export function presetLevers(preset: ScenarioPreset, base: EstimateInputs): ScenarioLevers {
  switch (preset) {
    case 'baseline':
      return {};
    case 'optimized':
      return {
        tokenFactor: 0.8,
        retryFactor: 0.5,
        cachedInputPct: Math.min(90, base.cachedInputPct + 20),
        successRate: Math.min(98, base.successRate + 7),
      };
    case 'stress':
      return {
        volumeFactor: 1.25,
        tokenFactor: 1.4,
        retryFactor: 2,
        successRate: Math.max(5, base.successRate - 15),
      };
  }
}

export function applyLevers(base: EstimateInputs, l: ScenarioLevers): EstimateInputs {
  const t = l.tokenFactor ?? 1;
  const out: EstimateInputs = {
    ...base,
    monthlyVolume: base.monthlyVolume * (l.volumeFactor ?? 1),
    successRate: l.successRate ?? base.successRate,
    modelId: l.modelId ?? base.modelId,
    inputTokensPerCall: base.inputTokensPerCall * t,
    outputTokensPerCall: base.outputTokensPerCall * t,
    retryRatePct: base.retryRatePct * (l.retryFactor ?? 1),
    cachedInputPct: l.cachedInputPct ?? base.cachedInputPct,
    agents: l.agents ?? base.agents,
    agentOpsOverride: l.agentOpsMonthly !== undefined ? l.agentOpsMonthly : base.agentOpsOverride,
    complexity: l.complexity ?? base.complexity,
    useComplexityMix: l.complexity ? false : base.useComplexityMix,
    targetMargin: l.targetMargin ?? base.targetMargin,
    commercial: {
      ...base.commercial,
      subscriptionPriceOverride: l.subscriptionPrice !== undefined ? l.subscriptionPrice : base.commercial.subscriptionPriceOverride,
    },
  };
  // SDLC volume is normally derived from engineering drivers; a volume lever
  // switches it to the scaled explicit figure.
  if (base.sdlc?.deriveVolume && l.volumeFactor !== undefined && l.volumeFactor !== 1) {
    out.monthlyVolume = resolveInputs(base).monthlyVolume * l.volumeFactor;
    out.sdlc = { ...base.sdlc, deriveVolume: false };
  }
  return out;
}

export interface ScenarioRun {
  inputs: EstimateInputs;
  /** Prices re-set from the scenario's own costs (what you would quote now). */
  repriced: EstimateResults;
  /** Baseline prices held fixed (what happens to margin on a signed deal). */
  locked: EstimateResults;
}

export function runScenario(base: EstimateInputs, baseResults: EstimateResults, levers: ScenarioLevers, rc: RateCard): ScenarioRun {
  const inputs = applyLevers(base, levers);
  const repriced = computeEstimate(inputs, rc);
  const locked = computeEstimate(
    {
      ...inputs,
      // Lock to the baseline's prices and commercial structure.
      commercial: {
        ...inputs.commercial,
        selectedModel: baseResults.selectedModel,
        agentOpsBilling: baseResults.agentOpsBilling,
        hybrid: base.commercial.hybrid ?? baseResults.recommendation.hybrid,
        lockedPrices:
          levers.subscriptionPrice != null
            ? { ...baseResults.prices, subscriptionUnitPrice: levers.subscriptionPrice, hybridSubUnitPrice: levers.subscriptionPrice }
            : baseResults.prices,
      },
    },
    rc,
  );
  return { inputs, repriced, locked };
}
