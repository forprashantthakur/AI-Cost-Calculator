import type { ProcessDef, RecKey } from '@/data/catalog';
import type { AgentOpsBilling, EstimateInputs, HybridConfig, ModelKey, Recommendation } from './types';

interface RecConfig {
  label: string;
  model: ModelKey;
  agentOpsBilling: AgentOpsBilling;
  hybrid: HybridConfig | null;
  why: string;
}

const HY = (usage: HybridConfig['usage'], agentOps = false, gainshare = false, subscription = true): HybridConfig => ({
  subscription,
  usage,
  agentOps,
  gainshare,
});

export const REC_CONFIG: Record<RecKey, RecConfig> = {
  abu: {
    label: 'ABU (price per accepted outcome)',
    model: 'abu',
    agentOpsBilling: 'bundled',
    hybrid: null,
    why: 'Each completed transaction is easy to count and verify, so the client pays only for accepted outcomes.',
  },
  'abu+agentops': {
    label: 'ABU + Managed AgentOps',
    model: 'abu',
    agentOpsBilling: 'separate',
    hybrid: null,
    why: 'High, measurable transaction volumes suit a price per accepted outcome, while a separate AgentOps fee keeps the fixed cost of running the agents visible and stable.',
  },
  subscription: {
    label: 'Subscription (capacity-based)',
    model: 'subscription',
    agentOpsBilling: 'bundled',
    hybrid: null,
    why: 'Work arrives in a predictable cycle, so a fixed monthly capacity fee with an included allowance gives the client budget certainty.',
  },
  'subscription+abu': {
    label: 'Subscription + ABU',
    model: 'hybrid',
    agentOpsBilling: 'bundled',
    hybrid: HY('abu'),
    why: 'A platform subscription recovers the fixed cost of an always-on service, and a price per accepted outcome scales the charge with the work actually delivered.',
  },
  'subscription+acu': {
    label: 'Subscription + ACU',
    model: 'hybrid',
    agentOpsBilling: 'bundled',
    hybrid: HY('acu'),
    why: 'Outcomes are hard to define as discrete billable units, so a platform subscription plus metered AI consumption ties price to actual usage.',
  },
  'dev-subscription+acu': {
    label: 'Developer subscription + ACU',
    model: 'hybrid',
    agentOpsBilling: 'bundled',
    hybrid: HY('acu'),
    why: 'Coding assistants are used by a known developer population, so a per-developer subscription covers the platform and ACUs meter heavy AI usage. Suggestions and lines of code are not billable outcomes.',
  },
  'fixed+subscription': {
    label: 'Fixed fee + Subscription',
    model: 'subscription',
    agentOpsBilling: 'bundled',
    hybrid: null,
    why: 'Low, lumpy volumes of high-value work suit a fixed implementation fee followed by a flat subscription rather than per-unit pricing.',
  },
  'fixed+milestones': {
    label: 'Fixed fee + milestones',
    model: 'fixed',
    agentOpsBilling: 'bundled',
    hybrid: null,
    why: 'Modernisation is a bounded programme with a defined scope, so fixed fees tied to milestones match how the client budgets and accepts the work.',
  },
  hybrid: {
    label: 'Hybrid (Subscription + ABU + AgentOps)',
    model: 'hybrid',
    agentOpsBilling: 'separate',
    hybrid: HY('abu', true),
    why: 'A multi-agent workflow has fixed platform cost, variable AI consumption and its own operations effort, so each is recovered by a separate component — once only.',
  },
  'hybrid-gainshare': {
    label: 'Hybrid + Gainshare',
    model: 'hybrid',
    agentOpsBilling: 'bundled',
    hybrid: HY('acu', false, true),
    why: 'The benefit is a measurable financial improvement, so a base subscription and usage charge cover cost and a gainshare rewards validated results.',
  },
};

/**
 * Rules-based recommendation. The process template supplies a starting point;
 * client preference, outcome measurability, volume predictability, hosting
 * and SLA then adjust it. Always a starting point, never a mandatory rule.
 */
export function recommend(inp: EstimateInputs, proc: ProcessDef, hasFinancialBenefit: boolean): Recommendation {
  let key: RecKey = proc.recommendation;
  const reasons: string[] = [];
  const pref = inp.commercial.clientPreference;
  const meas = proc.measurability;
  const pred = proc.predictability;

  if (pref === 'predictable' && (key === 'abu' || key === 'abu+agentops')) {
    key = 'subscription';
    reasons.push('The client prefers predictable spend, so a subscription with an included ABU allowance replaces pure per-outcome pricing.');
  } else if (pref === 'outcomes') {
    if (meas !== 'low' && key !== 'abu' && key !== 'abu+agentops') {
      key = inp.sla === 'standard' ? 'abu' : 'abu+agentops';
      reasons.push('The client wants to pay for results and the outcome is measurable, so pricing moves to accepted ABUs.');
    } else if (meas === 'low') {
      reasons.push('The client prefers outcome pricing, but this outcome is hard to measure objectively, so a usage-based structure is safer for both sides.');
    }
  } else if (pref === 'usage' && key !== 'subscription+acu' && key !== 'dev-subscription+acu') {
    key = 'subscription+acu';
    reasons.push('The client prefers to pay for consumption, so ACUs meter AI usage on top of a platform subscription.');
  } else if (pref === 'risk-share') {
    if (hasFinancialBenefit) {
      key = 'hybrid-gainshare';
      reasons.push('The client wants to share risk, and financial benefits are defined, so part of the fee is linked to validated benefits.');
    } else {
      reasons.push('The client wants to share risk, but no financial benefit is defined yet, so gainshare cannot be priced.');
    }
  }

  if (pref === 'none' && meas === 'low' && (key === 'abu' || key === 'abu+agentops')) {
    key = 'subscription+acu';
    reasons.push('Outcome acceptance is hard to measure, so ACU consumption is used instead of ABUs.');
  }

  const cfg = { ...REC_CONFIG[key] };
  let agentOpsBilling = cfg.agentOpsBilling;
  let hybrid = cfg.hybrid ? { ...cfg.hybrid } : null;
  let label = cfg.label;

  if (inp.sla === 'premium' && agentOpsBilling === 'bundled' && cfg.model !== 'fixed') {
    agentOpsBilling = 'separate';
    if (hybrid) hybrid.agentOps = true;
    label = `${label} + AgentOps`;
    reasons.push('A 24×7 premium SLA makes operations effort material, so it is priced as a separate AgentOps fee.');
  }
  if (inp.hosting !== 'shared' && cfg.model === 'abu') {
    reasons.push('Dedicated or client-hosted infrastructure adds fixed cost; consider a minimum monthly commitment to protect against low volumes.');
  }

  const why = [REC_CONFIG[key].why, ...reasons].slice(0, 3);
  const alt: Record<RecKey, string[]> = {
    abu: ['Subscription with included ABUs', 'Hybrid'],
    'abu+agentops': ['ABU (AgentOps bundled)', 'Subscription + ABU'],
    subscription: ['Subscription + ABU', 'Fixed fee'],
    'subscription+abu': ['ABU + AgentOps', 'Subscription with allowance'],
    'subscription+acu': ['Subscription + accepted-task ABU', 'ACU'],
    'dev-subscription+acu': ['Accepted-task ABU', 'Subscription'],
    'fixed+subscription': ['Subscription + ACU', 'ABU per approved deliverable'],
    'fixed+milestones': ['ABU per accepted modernisation task', 'Hybrid'],
    hybrid: ['Subscription + ABU', 'ABU + AgentOps'],
    'hybrid-gainshare': ['Subscription + ACU', 'Gainshare'],
  };

  return {
    key,
    label,
    model: cfg.model,
    agentOpsBilling,
    hybrid,
    explanation: why.join(' '),
    factors: [
      { label: 'Outcome measurability', value: meas },
      { label: 'Volume predictability', value: pred },
      { label: 'Infrastructure', value: inp.hosting === 'shared' ? 'shared (variable)' : inp.hosting === 'private' ? 'dedicated (fixed)' : 'client-hosted (fixed)' },
      { label: 'SLA', value: inp.sla },
      { label: 'Client preference', value: pref === 'none' ? 'not stated' : pref },
    ],
    alternatives: alt[key],
  };
}
