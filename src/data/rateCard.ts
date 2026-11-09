import type { CurrencyCode, RateCard, ResourceRate } from '@/engine/types';

/** Key for a designation: "Implement" + "Senior Consultant" → "implement-senior-consultant". */
export const resourceKey = (memberFirm: string, designation: string) =>
  `${memberFirm} ${designation}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const R = (memberFirm: string, designation: string, rackRatePerHour: number, costRatePerHour: number): ResourceRate => ({
  id: resourceKey(memberFirm, designation),
  memberFirm,
  designation,
  rackRatePerHour,
  costRatePerHour,
});

/** People rate card — Pricing Tool v2.4, last rate update 08 Oct 2026. INR per hour. */
export const DEFAULT_RESOURCE_RATES: ResourceRate[] = [
  R('Advise', 'Partner', 34000, 0),
  R('Advise', 'Director', 25000, 12819),
  R('Advise', 'Associate Director', 18000, 3989),
  R('Advise', 'Manager', 13000, 2630),
  R('Advise', 'Senior Consultant', 10000, 1887),
  R('Advise', 'Consultant', 7500, 1150),
  R('Advise', 'Analyst', 4500, 1031),
  R('Operate', 'Director', 19000, 12571),
  R('Operate', 'Associate Director', 10000, 4387),
  R('Operate', 'Manager', 6000, 2361),
  R('Operate', 'Senior Consultant', 4500, 1610),
  R('Operate', 'Consultant', 3500, 1115),
  R('Operate', 'Analyst', 2500, 939),
  R('Implement', 'Director', 19000, 10724),
  R('Implement', 'Associate Director', 10000, 4150),
  R('Implement', 'Manager', 6000, 2784),
  R('Implement', 'Senior Consultant', 4500, 1864),
  R('Implement', 'Consultant', 3500, 1082),
  R('Implement', 'Analyst', 2500, 932),
];

/**
 * DEFAULT RATE CARD.
 *
 * People rates (designations with rack and cost rates) come from the Pricing
 * Tool v2.4 rate card. Model, cloud and tool rates are illustrative
 * placeholders, not vendor quotes: model tiers are deliberately generic.
 * Replace them with contracted or published rates — and record the source and
 * effective date — in Settings before any client use.
 */
export const DEFAULT_RATE_CARD: RateCard = {
  version: 'RC-2026.11',
  effectiveDate: '2026-11-09',
  source: 'People rates from the Pricing Tool v2.4 rate card (08 Oct 2026); model, cloud and tool rates are illustrative placeholders — replace before client use',
  baseCurrency: 'USD',
  fx: { USD: 1, INR: 85, EUR: 0.92, GBP: 0.79, AUD: 1.52, SGD: 1.35, AED: 3.6725, JPY: 150, CAD: 1.37 },
  fxEffectiveDate: '2026-10-01',
  fxSource: 'Illustrative conversion rates — replace with treasury or contract FX rates',
  models: [
    {
      id: 'frontier',
      provider: 'Illustrative provider',
      name: 'Frontier reasoning tier',
      inputPer1M: 5,
      outputPer1M: 25,
      cachedInputPer1M: 0.5,
      effectiveDate: '2026-10-01',
      source: 'Illustrative placeholder — not a vendor quote',
      illustrative: true,
    },
    {
      id: 'balanced',
      provider: 'Illustrative provider',
      name: 'Balanced general-purpose tier',
      inputPer1M: 3,
      outputPer1M: 15,
      cachedInputPer1M: 0.3,
      effectiveDate: '2026-10-01',
      source: 'Illustrative placeholder — not a vendor quote',
      illustrative: true,
    },
    {
      id: 'fast',
      provider: 'Illustrative provider',
      name: 'Fast / economy tier',
      inputPer1M: 0.25,
      outputPer1M: 1.25,
      cachedInputPer1M: 0.025,
      effectiveDate: '2026-10-01',
      source: 'Illustrative placeholder — not a vendor quote',
      illustrative: true,
    },
    {
      id: 'selfhosted',
      provider: 'Self-hosted open-weight',
      name: 'Self-hosted model (token-equivalent GPU cost)',
      inputPer1M: 0.4,
      outputPer1M: 0.8,
      cachedInputPer1M: 0.4,
      effectiveDate: '2026-10-01',
      source: 'Illustrative GPU-hour cost converted to tokens — not a quote',
      illustrative: true,
    },
  ],
  ocrPerPage: 0.0015,
  embeddingPer1M: 0.1,
  vectorQueryPer1K: 0.4,
  orchestrationPerRun: 0.002,
  toolCallCost: 0.0005,
  infraBasePerMonth: 400,
  infraPerAgentPerMonth: 250,
  observabilityPerAgentPerMonth: 80,
  hostingMultipliers: { shared: 1, private: 1.6, onprem: 2.2 },
  slaMultipliers: { standard: 1, enhanced: 1.35, premium: 1.8 },
  resourceCurrency: 'INR',
  resourceRatesUpdated: '2026-10-08',
  resourceRatesSource: 'Pricing Tool v2.4 rate card',
  defaultDiscountPct: 0,
  resourceRates: DEFAULT_RESOURCE_RATES,
  agentOpsTeam: [
    { id: 'monitoring', label: 'Agent monitoring', resourceId: 'operate-analyst', baseHoursPerMonth: 8, hoursPerAgentPerMonth: 4 },
    { id: 'incident', label: 'Incident management', resourceId: 'operate-consultant', baseHoursPerMonth: 4, hoursPerAgentPerMonth: 2 },
    { id: 'support', label: 'L1/L2/L3 support', resourceId: 'operate-consultant', baseHoursPerMonth: 16, hoursPerAgentPerMonth: 8 },
    { id: 'evaluation', label: 'Agent evaluation', resourceId: 'operate-senior-consultant', baseHoursPerMonth: 6, hoursPerAgentPerMonth: 3 },
    { id: 'optimization', label: 'Prompt / model optimisation', resourceId: 'operate-senior-consultant', baseHoursPerMonth: 6, hoursPerAgentPerMonth: 3 },
    { id: 'release', label: 'Release management', resourceId: 'operate-manager', baseHoursPerMonth: 3, hoursPerAgentPerMonth: 1 },
    { id: 'governance', label: 'Governance reporting', resourceId: 'operate-associate-director', baseHoursPerMonth: 2, hoursPerAgentPerMonth: 1 },
  ],
  implActivities: [
    { id: 'discovery', label: 'Discovery and process assessment', roleId: 'advise-manager', baseHours: 60 },
    { id: 'architecture', label: 'Solution architecture', roleId: 'advise-associate-director', baseHours: 60 },
    { id: 'development', label: 'AI agent development', roleId: 'implement-senior-consultant', baseHours: 160 },
    { id: 'prompt', label: 'Prompt and context engineering', roleId: 'implement-consultant', baseHours: 80 },
    { id: 'rag', label: 'RAG and knowledge integration', roleId: 'implement-consultant', baseHours: 80 },
    { id: 'integration', label: 'Enterprise API / ERP integration', roleId: 'implement-senior-consultant', baseHours: 120 },
    { id: 'security', label: 'Security and governance', roleId: 'advise-senior-consultant', baseHours: 40 },
    { id: 'testing', label: 'Testing and evaluation', roleId: 'implement-analyst', baseHours: 100 },
    { id: 'deployment', label: 'Deployment', roleId: 'implement-consultant', baseHours: 40 },
    { id: 'training', label: 'Training and change management', roleId: 'advise-consultant', baseHours: 40 },
    { id: 'management', label: 'Engagement and delivery management', roleId: 'implement-manager', baseHours: 60 },
  ],
  implComplexityFactor: { low: 0.7, medium: 1, high: 1.6 },
  implPerExtraAgent: 0.3,
  acu: {
    method: 'cost',
    referenceCost: 1,
    referenceCurrency: 'INR',
    weights: {
      inputTokensPer1K: 0.25,
      cachedTokensPer1K: 0.025,
      outputTokensPer1K: 1.25,
      ocrPage: 0.15,
      toolCall: 0.05,
      orchestrationRun: 0.2,
      vectorQuery: 0.03,
      embeddingTokensPer1K: 0.01,
    },
    version: 'ACU-2026.1',
    effectiveDate: '2026-10-01',
  },
  abuWeights: { low: 1, medium: 1.5, high: 3 },
  effortMultipliers: { low: 0.7, medium: 1, high: 2 },
  defaultMargins: { implementation: 30, run: 40 },
  fteHoursPerMonth: 160,
  changeLog: [
    { date: '2026-11-09', version: 'RC-2026.11', note: 'People rate card (Advise, Implement, Operate) with rack and cost rates; discount pricing' },
    { date: '2026-10-01', version: 'RC-2026.10-ILLUSTRATIVE', note: 'Initial illustrative rate card' },
  ],
};

export const CURRENCIES: { code: CurrencyCode; symbol: string; label: string; locale: string }[] = [
  { code: 'INR', symbol: '₹', label: 'Indian rupee', locale: 'en-IN' },
  { code: 'USD', symbol: '$', label: 'US dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', label: 'Euro', locale: 'en-IE' },
  { code: 'GBP', symbol: '£', label: 'Pound sterling', locale: 'en-GB' },
  { code: 'AUD', symbol: 'A$', label: 'Australian dollar', locale: 'en-AU' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore dollar', locale: 'en-SG' },
  { code: 'AED', symbol: 'AED ', label: 'UAE dirham', locale: 'en-AE' },
  { code: 'JPY', symbol: '¥', label: 'Japanese yen', locale: 'ja-JP' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian dollar', locale: 'en-CA' },
];
