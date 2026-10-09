import type { EstimateInputs, RateCard } from '@/engine/types';
import { createEstimate } from './templates';

type Patch = Partial<Omit<EstimateInputs, 'commercial' | 'value' | 'sdlc'>> & {
  commercial?: Partial<EstimateInputs['commercial']>;
  value?: Partial<EstimateInputs['value']>;
  sdlc?: Partial<NonNullable<EstimateInputs['sdlc']>>;
};

interface SampleSpec {
  id: string;
  title: string;
  processId: string;
  industryId: string;
  currency: EstimateInputs['currency'];
  client: string;
  patch?: Patch;
}

/** Twelve illustrative sample estimates. Client names are fictitious. */
export const SAMPLE_SPECS: SampleSpec[] = [
  {
    id: 'sample-mfg-ap',
    title: 'Manufacturing — Accounts Payable Agent',
    processId: 'accounts-payable',
    industryId: 'manufacturing',
    currency: 'INR',
    client: 'Apex Components Ltd (fictitious)',
    patch: { value: { cashRealisationPct: 60 } },
  },
  {
    id: 'sample-bank-kyc',
    title: 'Banking — KYC Agent',
    processId: 'kyc',
    industryId: 'banking',
    currency: 'INR',
    client: 'Meridian Bank (fictitious)',
    patch: {
      useComplexityMix: true,
      complexityMix: { low: 40, medium: 45, high: 15 },
      value: { cashRealisationPct: 50, costAvoidanceAnnual: 4800000, costAvoidanceStatus: 'validated' },
    },
  },
  {
    id: 'sample-ins-claims',
    title: 'Insurance — Claims Processing Agent',
    processId: 'claims-processing',
    industryId: 'insurance',
    currency: 'INR',
    client: 'Sentinel General Insurance (fictitious)',
    patch: {
      commercial: {
        minMonthlyCommitment: 500000,
        volumeTiers: [
          { upTo: 10000, discountPct: 0 },
          { upTo: 20000, discountPct: 5 },
          { upTo: null, discountPct: 10 },
        ],
      },
      value: { cashRealisationPct: 55 },
    },
  },
  {
    id: 'sample-retail-cs',
    title: 'Retail — Customer Service Agent',
    processId: 'customer-query-resolution',
    industryId: 'retail',
    currency: 'USD',
    client: 'Northwind Retail Group (fictitious)',
    patch: { value: { cashRealisationPct: 30, revenueUpliftAnnual: 120000 } },
  },
  {
    id: 'sample-hr-recruitment',
    title: 'HR — Recruitment Agent',
    processId: 'recruitment',
    industryId: 'professional-services',
    currency: 'INR',
    client: 'Brightpath Consulting (fictitious)',
    patch: { value: { cashRealisationPct: 40, costAvoidanceAnnual: 6000000 } },
  },
  {
    id: 'sample-proc-contracts',
    title: 'Procurement — Contract Analysis Agent',
    processId: 'contract-analysis',
    industryId: 'pharma',
    currency: 'INR',
    client: 'Helix Life Sciences (fictitious)',
    patch: { monthlyVolume: 1200, value: { cashRealisationPct: 60, costAvoidanceAnnual: 3600000 } },
  },
  {
    id: 'sample-it-servicedesk',
    title: 'IT — Service Desk Agent',
    processId: 'it-service-desk',
    industryId: 'telecom',
    currency: 'INR',
    client: 'Skyline Telecom (fictitious)',
    patch: { commercial: { clientPreference: 'outcomes' }, value: { cashRealisationPct: 60 } },
  },
  {
    id: 'sample-sdlc-coding',
    title: 'IT SDLC — AI Coding Assistant',
    processId: 'tpl-ai-coding-assistant',
    industryId: 'technology',
    currency: 'USD',
    client: 'Quantum Software Inc (fictitious)',
    patch: {
      sdlc: { developers: 120, teams: 12, storiesPerSprint: 10 },
      commercial: { subscriptionUnits: 120 },
      value: { cashRealisationPct: 0, costAvoidanceAnnual: 240000, costAvoidanceStatus: 'assumed' },
    },
  },
  {
    id: 'sample-sdlc-testing',
    title: 'IT SDLC — Automated Testing Agent',
    processId: 'tpl-automated-testing',
    industryId: 'banking',
    currency: 'INR',
    client: 'Meridian Bank (fictitious)',
    patch: { value: { cashRealisationPct: 15, costAvoidanceAnnual: 9600000 } },
  },
  {
    id: 'sample-sdlc-legacy',
    title: 'IT SDLC — Legacy Modernization Agent',
    processId: 'tpl-legacy-modernization',
    industryId: 'insurance',
    currency: 'INR',
    client: 'Sentinel General Insurance (fictitious)',
    patch: { monthlyVolume: 60, sdlc: { deriveVolume: false }, commercial: { contractYears: 2 }, volumeGrowthPct: 0, value: { cashRealisationPct: 15, costAvoidanceAnnual: 18000000 } },
  },
  {
    id: 'sample-sdlc-devops',
    title: 'IT SDLC — DevOps Deployment Agent',
    processId: 'tpl-devops-deployment',
    industryId: 'ecommerce',
    currency: 'INR',
    client: 'Cartwheel Commerce (fictitious)',
    patch: { sdlc: { deploymentsPerMonth: 400, buildsPerMonth: 6000 }, value: { cashRealisationPct: 25, costAvoidanceAnnual: 3600000 } },
  },
  {
    id: 'sample-sdlc-e2e',
    title: 'IT SDLC — End-to-End Agentic SDLC',
    processId: 'tpl-e2e-agentic-sdlc',
    industryId: 'financial-services',
    currency: 'INR',
    client: 'Crestline Capital (fictitious)',
    patch: { sdlc: { developers: 200, teams: 24 }, value: { cashRealisationPct: 20, costAvoidanceAnnual: 24000000 } },
  },
];

export function buildSample(spec: SampleSpec, rc: RateCard): EstimateInputs {
  const base = createEstimate({ processId: spec.processId, industryId: spec.industryId, currency: spec.currency, name: spec.title, client: spec.client }, rc);
  const p = spec.patch ?? {};
  const { commercial, value, sdlc, ...rest } = p;
  const est: EstimateInputs = {
    ...base,
    ...rest,
    id: spec.id,
    isSample: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    commercial: { ...base.commercial, ...(commercial ?? {}) },
    value: { ...base.value, ...(value ?? {}) },
    sdlc: base.sdlc ? { ...base.sdlc, ...(sdlc ?? {}) } : null,
  };
  if (spec.id === 'sample-sdlc-e2e' && est.sdlc) {
    est.sdlc.metrics.leadTimeHours = { baseline: 120, improvementPct: 30, source: 'measured' };
    est.sdlc.metrics.deploymentsPerMonth = { baseline: 12, improvementPct: 50, source: 'measured' };
    est.sdlc.metrics.mttrHours = { baseline: null, improvementPct: 0, source: 'none' };
  }
  return est;
}

export const buildSamples = (rc: RateCard): EstimateInputs[] => SAMPLE_SPECS.map((s) => buildSample(s, rc));
