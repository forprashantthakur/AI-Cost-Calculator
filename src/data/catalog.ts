import type { Complexity, HostingKey, Level, SdlcInputs, SlaKey, SubscriptionUnit } from '@/engine/types';

/* ------------------------------------------------------------------------- */
/*  Industries and business functions                                        */
/* ------------------------------------------------------------------------- */

export const INDUSTRIES = [
  { id: 'banking', name: 'Banking' },
  { id: 'financial-services', name: 'Financial Services' },
  { id: 'insurance', name: 'Insurance' },
  { id: 'manufacturing', name: 'Manufacturing' },
  { id: 'automotive', name: 'Automotive' },
  { id: 'pharma', name: 'Pharmaceutical & Life Sciences' },
  { id: 'retail', name: 'Retail' },
  { id: 'ecommerce', name: 'E-commerce' },
  { id: 'logistics', name: 'Logistics & Transportation' },
  { id: 'energy', name: 'Energy & Utilities' },
  { id: 'healthcare', name: 'Healthcare' },
  { id: 'telecom', name: 'Telecom' },
  { id: 'real-estate', name: 'Real Estate' },
  { id: 'education', name: 'Education' },
  { id: 'professional-services', name: 'Professional Services' },
  { id: 'technology', name: 'Technology' },
  { id: 'other', name: 'Other / Custom' },
] as const;

export type IndustryId = (typeof INDUSTRIES)[number]['id'];

export const FUNCTIONS = [
  { id: 'finance', name: 'Finance' },
  { id: 'procurement', name: 'Procurement' },
  { id: 'hr', name: 'Human Resources' },
  { id: 'it-ops', name: 'IT Operations' },
  { id: 'sdlc', name: 'IT Software Development Life Cycle (SDLC)' },
  { id: 'customer-service', name: 'Customer Service' },
  { id: 'sales-marketing', name: 'Sales & Marketing' },
  { id: 'supply-chain', name: 'Supply Chain' },
  { id: 'manufacturing-ops', name: 'Manufacturing Operations' },
  { id: 'risk-compliance', name: 'Risk & Compliance' },
  { id: 'legal', name: 'Legal' },
  { id: 'enterprise-ops', name: 'Enterprise Operations' },
] as const;

export type FunctionId = (typeof FUNCTIONS)[number]['id'];

/* ------------------------------------------------------------------------- */
/*  Recommendation structures                                                */
/* ------------------------------------------------------------------------- */

export type RecKey =
  | 'abu'
  | 'abu+agentops'
  | 'subscription'
  | 'subscription+abu'
  | 'subscription+acu'
  | 'dev-subscription+acu'
  | 'fixed+subscription'
  | 'fixed+milestones'
  | 'hybrid'
  | 'hybrid-gainshare';

/* ------------------------------------------------------------------------- */
/*  Process defaults (illustrative)                                          */
/* ------------------------------------------------------------------------- */

export interface ProcessDefaults {
  volume: number;
  agents: number;
  complexity: Complexity;
  successRate: number;
  manualMinutes: number;
  aiAssistedMinutes: number;
  /** Fully loaded employee cost per hour — USD for global estimates, INR for India estimates. */
  laborUSD: number;
  laborINR: number;
  modelId: string;
  callsPerTxn: number;
  inputTokensPerCall: number;
  outputTokensPerCall: number;
  cachedInputPct: number;
  ocrPagesPerTxn: number;
  toolCallsPerTxn: number;
  ragQueriesPerTxn: number;
  embeddingTokensPerTxn: number;
  retryRatePct: number;
  duplicateRatePct: number;
  humanReviewRatePct: number;
  humanReviewMinutes: number;
  hosting: HostingKey;
  sla: SlaKey;
  implScale: number;
  cashRealisationPct: number;
  volumeGrowthPct: number;
}

type Archetype =
  | 'document'
  | 'conversational'
  | 'analytical'
  | 'generative'
  | 'review'
  | 'screening'
  | 'sdlc-code'
  | 'sdlc-test'
  | 'sdlc-review'
  | 'sdlc-doc'
  | 'sdlc-ops'
  | 'sdlc-analysis'
  | 'sdlc-support';

const BASE: ProcessDefaults = {
  volume: 10000,
  agents: 2,
  complexity: 'medium',
  successRate: 80,
  manualMinutes: 15,
  aiAssistedMinutes: 3,
  laborUSD: 32,
  laborINR: 650,
  modelId: 'balanced',
  callsPerTxn: 4,
  inputTokensPerCall: 5000,
  outputTokensPerCall: 700,
  cachedInputPct: 30,
  ocrPagesPerTxn: 0,
  toolCallsPerTxn: 4,
  ragQueriesPerTxn: 1,
  embeddingTokensPerTxn: 1000,
  retryRatePct: 8,
  duplicateRatePct: 1,
  humanReviewRatePct: 10,
  humanReviewMinutes: 3,
  hosting: 'shared',
  sla: 'standard',
  implScale: 1,
  cashRealisationPct: 30,
  volumeGrowthPct: 10,
};

const ARCHETYPES: Record<Archetype, Partial<ProcessDefaults>> = {
  document: { volume: 10000, agents: 3, successRate: 85, manualMinutes: 15, aiAssistedMinutes: 3, ocrPagesPerTxn: 3, callsPerTxn: 4, inputTokensPerCall: 5000, outputTokensPerCall: 700, toolCallsPerTxn: 4, ragQueriesPerTxn: 1, embeddingTokensPerTxn: 2000, humanReviewRatePct: 12 },
  conversational: { volume: 30000, agents: 2, successRate: 70, manualMinutes: 10, aiAssistedMinutes: 2, laborUSD: 28, laborINR: 550, modelId: 'fast', callsPerTxn: 5, inputTokensPerCall: 3000, outputTokensPerCall: 400, cachedInputPct: 50, toolCallsPerTxn: 3, ragQueriesPerTxn: 2, embeddingTokensPerTxn: 500, retryRatePct: 5, humanReviewRatePct: 5, humanReviewMinutes: 2, implScale: 0.9 },
  analytical: { volume: 3000, agents: 2, successRate: 80, manualMinutes: 40, aiAssistedMinutes: 10, laborUSD: 40, laborINR: 800, callsPerTxn: 6, inputTokensPerCall: 9000, outputTokensPerCall: 1500, cachedInputPct: 40, toolCallsPerTxn: 6, retryRatePct: 6, humanReviewRatePct: 15, humanReviewMinutes: 8, implScale: 1.1 },
  generative: { volume: 500, agents: 2, successRate: 75, manualMinutes: 240, aiAssistedMinutes: 60, laborUSD: 55, laborINR: 1100, modelId: 'frontier', callsPerTxn: 10, inputTokensPerCall: 14000, outputTokensPerCall: 4000, cachedInputPct: 40, ocrPagesPerTxn: 5, toolCallsPerTxn: 5, ragQueriesPerTxn: 4, embeddingTokensPerTxn: 8000, retryRatePct: 10, humanReviewRatePct: 50, humanReviewMinutes: 20 },
  review: { volume: 400, agents: 2, successRate: 80, manualMinutes: 90, aiAssistedMinutes: 20, laborUSD: 70, laborINR: 1500, modelId: 'frontier', callsPerTxn: 10, inputTokensPerCall: 20000, outputTokensPerCall: 2500, cachedInputPct: 50, ocrPagesPerTxn: 25, toolCallsPerTxn: 4, ragQueriesPerTxn: 3, embeddingTokensPerTxn: 20000, retryRatePct: 6, humanReviewRatePct: 30, humanReviewMinutes: 15, implScale: 1.2 },
  screening: { volume: 5000, agents: 1, successRate: 88, manualMinutes: 8, aiAssistedMinutes: 1.5, laborUSD: 30, laborINR: 600, modelId: 'fast', callsPerTxn: 2, inputTokensPerCall: 4000, outputTokensPerCall: 500, cachedInputPct: 60, ocrPagesPerTxn: 2, toolCallsPerTxn: 2, ragQueriesPerTxn: 1, embeddingTokensPerTxn: 1500, retryRatePct: 4, humanReviewRatePct: 10, humanReviewMinutes: 2, implScale: 0.8 },
  'sdlc-code': { agents: 2, successRate: 60, manualMinutes: 480, aiAssistedMinutes: 300, laborUSD: 55, laborINR: 1400, modelId: 'frontier', callsPerTxn: 20, inputTokensPerCall: 30000, outputTokensPerCall: 3000, cachedInputPct: 60, toolCallsPerTxn: 10, ragQueriesPerTxn: 6, embeddingTokensPerTxn: 5000, retryRatePct: 15, duplicateRatePct: 0, humanReviewRatePct: 0, humanReviewMinutes: 0, implScale: 0.8, cashRealisationPct: 0, volumeGrowthPct: 5 },
  'sdlc-test': { agents: 1, successRate: 75, manualMinutes: 120, aiAssistedMinutes: 30, laborUSD: 45, laborINR: 1100, modelId: 'balanced', callsPerTxn: 12, inputTokensPerCall: 18000, outputTokensPerCall: 4000, cachedInputPct: 50, toolCallsPerTxn: 8, ragQueriesPerTxn: 2, embeddingTokensPerTxn: 3000, retryRatePct: 10, duplicateRatePct: 0, humanReviewRatePct: 0, humanReviewMinutes: 0, implScale: 0.7, cashRealisationPct: 0, volumeGrowthPct: 5 },
  'sdlc-review': { agents: 1, successRate: 85, manualMinutes: 45, aiAssistedMinutes: 15, laborUSD: 60, laborINR: 1500, modelId: 'balanced', callsPerTxn: 6, inputTokensPerCall: 25000, outputTokensPerCall: 2000, cachedInputPct: 50, toolCallsPerTxn: 4, ragQueriesPerTxn: 2, embeddingTokensPerTxn: 2000, retryRatePct: 5, duplicateRatePct: 0, humanReviewRatePct: 0, humanReviewMinutes: 0, implScale: 0.6, cashRealisationPct: 0, volumeGrowthPct: 5 },
  'sdlc-doc': { agents: 1, successRate: 80, manualMinutes: 120, aiAssistedMinutes: 30, laborUSD: 50, laborINR: 1200, modelId: 'balanced', callsPerTxn: 8, inputTokensPerCall: 15000, outputTokensPerCall: 5000, cachedInputPct: 40, toolCallsPerTxn: 3, ragQueriesPerTxn: 4, embeddingTokensPerTxn: 6000, retryRatePct: 6, duplicateRatePct: 0, humanReviewRatePct: 0, humanReviewMinutes: 0, implScale: 0.6, cashRealisationPct: 0, volumeGrowthPct: 5 },
  'sdlc-ops': { agents: 1, successRate: 95, manualMinutes: 30, aiAssistedMinutes: 5, laborUSD: 55, laborINR: 1300, modelId: 'fast', callsPerTxn: 3, inputTokensPerCall: 4000, outputTokensPerCall: 600, cachedInputPct: 60, toolCallsPerTxn: 12, ragQueriesPerTxn: 1, embeddingTokensPerTxn: 500, retryRatePct: 5, duplicateRatePct: 0, humanReviewRatePct: 0, humanReviewMinutes: 0, implScale: 0.7, cashRealisationPct: 0, volumeGrowthPct: 10 },
  'sdlc-analysis': { agents: 1, successRate: 75, manualMinutes: 180, aiAssistedMinutes: 45, laborUSD: 60, laborINR: 1500, modelId: 'frontier', callsPerTxn: 10, inputTokensPerCall: 16000, outputTokensPerCall: 3500, cachedInputPct: 40, toolCallsPerTxn: 4, ragQueriesPerTxn: 4, embeddingTokensPerTxn: 6000, retryRatePct: 8, duplicateRatePct: 0, humanReviewRatePct: 0, humanReviewMinutes: 0, implScale: 0.7, cashRealisationPct: 0, volumeGrowthPct: 5 },
  'sdlc-support': { agents: 1, successRate: 65, manualMinutes: 120, aiAssistedMinutes: 40, laborUSD: 50, laborINR: 1200, modelId: 'balanced', callsPerTxn: 12, inputTokensPerCall: 20000, outputTokensPerCall: 2500, cachedInputPct: 50, toolCallsPerTxn: 8, ragQueriesPerTxn: 3, embeddingTokensPerTxn: 3000, retryRatePct: 10, duplicateRatePct: 0, humanReviewRatePct: 0, humanReviewMinutes: 0, implScale: 0.7, cashRealisationPct: 0, volumeGrowthPct: 5 },
};

/* ------------------------------------------------------------------------- */
/*  Process library                                                          */
/* ------------------------------------------------------------------------- */

export type SdlcDriverField = keyof Pick<
  SdlcInputs,
  'prsPerMonth' | 'codeReviewsPerMonth' | 'testCasesPerMonth' | 'defectsPerMonth' | 'buildsPerMonth' | 'deploymentsPerMonth' | 'ticketsPerMonth'
> | 'stories';

export interface ProcessDef {
  id: string;
  name: string;
  functionId: FunctionId;
  /** 'all' = cross-industry template. */
  industries: 'all' | IndustryId[];
  kind: 'business' | 'sdlc-agent' | 'sdlc-template';
  sdlcStage?: string;
  agentName?: string;
  abuUnit: string;
  acceptance: string;
  description: string;
  recommendation: RecKey;
  measurability: Level;
  predictability: Level;
  defaults: ProcessDefaults;
  stages?: string[];
  sdlcDriver?: { field: SdlcDriverField; factor: number; label: string };
  subscriptionUnit?: SubscriptionUnit;
}

interface Spec {
  id: string;
  name: string;
  fn: FunctionId;
  ind?: IndustryId[];
  arch: Archetype;
  abu: string;
  acc?: string;
  desc: string;
  rec: RecKey;
  meas?: Level;
  pred?: Level;
  d?: Partial<ProcessDefaults>;
  kind?: ProcessDef['kind'];
  stage?: string;
  agent?: string;
  stages?: string[];
  driver?: ProcessDef['sdlcDriver'];
  unit?: SubscriptionUnit;
}

const MFG: IndustryId[] = ['manufacturing', 'automotive', 'pharma', 'energy', 'other'];
const BANK: IndustryId[] = ['banking', 'financial-services', 'other'];
const INS: IndustryId[] = ['insurance', 'other'];
const LOG: IndustryId[] = ['logistics', 'ecommerce', 'retail', 'manufacturing', 'automotive', 'other'];
const HC: IndustryId[] = ['healthcare', 'pharma', 'insurance', 'other'];

const STORIES = { field: 'stories' as const, factor: 1, label: 'User stories per month (teams × sprints × stories per sprint)' };

const SPECS: Spec[] = [
  /* Finance */
  { id: 'accounts-payable', name: 'Accounts Payable', fn: 'finance', arch: 'document', abu: 'Successfully processed invoice', acc: 'Invoice captured, validated against PO/GRN, coded and posted to ERP without rework', desc: 'Invoice capture, 3-way match, coding and posting', rec: 'abu+agentops', meas: 'high', pred: 'high', d: { volume: 20000 } },
  { id: 'accounts-receivable', name: 'Accounts Receivable', fn: 'finance', arch: 'document', abu: 'Cash application or collection case closed', desc: 'Remittance matching, cash application and dunning', rec: 'abu+agentops', meas: 'high', pred: 'high', d: { volume: 12000, ocrPagesPerTxn: 1 } },
  { id: 'reconciliation', name: 'Reconciliation', fn: 'finance', arch: 'analytical', abu: 'Reconciled account or exception resolved', desc: 'Account and intercompany reconciliation with exception handling', rec: 'abu', meas: 'high', pred: 'high', d: { volume: 6000, manualMinutes: 25, aiAssistedMinutes: 5 } },
  { id: 'financial-close', name: 'Financial Close', fn: 'finance', arch: 'analytical', abu: 'Close task completed and approved', desc: 'Month-end close checklists, accruals and journal preparation', rec: 'subscription', meas: 'medium', pred: 'high', d: { volume: 1500, manualMinutes: 60, aiAssistedMinutes: 20 } },
  { id: 'financial-reporting', name: 'Financial Reporting', fn: 'finance', arch: 'generative', abu: 'Approved report or commentary pack', desc: 'Management reporting and variance commentary', rec: 'fixed+subscription', meas: 'medium', pred: 'high', d: { volume: 120, modelId: 'balanced' } },
  { id: 'record-to-report', name: 'Record-to-Report', fn: 'finance', arch: 'analytical', abu: 'Accepted R2R transaction or task', desc: 'End-to-end journal, reconciliation, close and reporting', rec: 'hybrid', meas: 'medium', pred: 'medium', d: { volume: 8000, agents: 4, manualMinutes: 20, aiAssistedMinutes: 5, implScale: 1.5 } },

  /* Procurement */
  { id: 'source-to-pay', name: 'Source-to-Pay', fn: 'procurement', arch: 'document', abu: 'Accepted S2P transaction', desc: 'Requisition to payment across sourcing, PO, receipt and invoice', rec: 'hybrid', meas: 'medium', pred: 'medium', d: { volume: 15000, agents: 4, implScale: 1.5 } },
  { id: 'supplier-onboarding', name: 'Supplier Onboarding', fn: 'procurement', arch: 'document', abu: 'Supplier onboarded and approved', desc: 'Supplier data collection, validation and risk checks', rec: 'abu', meas: 'high', pred: 'medium', d: { volume: 600, manualMinutes: 90, aiAssistedMinutes: 20, ocrPagesPerTxn: 12 } },
  { id: 'contract-analysis', name: 'Contract Analysis', fn: 'procurement', arch: 'review', abu: 'Accepted contract analysis', acc: 'Key terms, obligations and risks extracted and accepted by the procurement reviewer', desc: 'Supplier contract term extraction and risk flagging', rec: 'abu', meas: 'high', pred: 'medium', d: { volume: 400 } },
  { id: 'po-processing', name: 'Purchase Order Processing', fn: 'procurement', arch: 'document', abu: 'Purchase order created and approved', desc: 'Requisition validation and PO creation', rec: 'abu+agentops', meas: 'high', pred: 'high', d: { volume: 8000, ocrPagesPerTxn: 1, manualMinutes: 12 } },
  { id: 'procurement-analytics', name: 'Procurement Analytics', fn: 'procurement', arch: 'analytical', abu: 'Accepted analysis or insight pack', desc: 'Spend analytics, savings tracking and category insights', rec: 'subscription+acu', meas: 'low', pred: 'low', d: { volume: 300, manualMinutes: 180, aiAssistedMinutes: 45 } },

  /* HR */
  { id: 'recruitment', name: 'Recruitment', fn: 'hr', arch: 'screening', abu: 'Qualified candidate advanced to interview', desc: 'Sourcing, screening and shortlisting candidates', rec: 'subscription+abu', meas: 'medium', pred: 'medium', d: { volume: 3000, agents: 2, manualMinutes: 20, aiAssistedMinutes: 5 } },
  { id: 'resume-screening', name: 'Resume Screening', fn: 'hr', arch: 'screening', abu: 'Screened resume with accepted recommendation', desc: 'Resume parsing and fit scoring against job criteria', rec: 'abu', meas: 'high', pred: 'medium', d: { volume: 8000 } },
  { id: 'interview-scheduling', name: 'Interview Scheduling', fn: 'hr', arch: 'conversational', abu: 'Interview scheduled and confirmed', desc: 'Calendar coordination with candidates and panels', rec: 'abu', meas: 'high', pred: 'medium', d: { volume: 2500, manualMinutes: 15, aiAssistedMinutes: 2 } },
  { id: 'employee-onboarding', name: 'Employee Onboarding', fn: 'hr', arch: 'document', abu: 'New joiner fully onboarded', desc: 'Document collection, provisioning and orientation', rec: 'abu', meas: 'high', pred: 'medium', d: { volume: 300, manualMinutes: 180, aiAssistedMinutes: 40, ocrPagesPerTxn: 10 } },
  { id: 'hr-service-desk', name: 'HR Service Desk', fn: 'hr', arch: 'conversational', abu: 'Resolved employee HR query', desc: 'Policy, leave and benefits queries', rec: 'subscription+abu', meas: 'high', pred: 'high', d: { volume: 15000 } },
  { id: 'payroll-support', name: 'Payroll Support', fn: 'hr', arch: 'conversational', abu: 'Resolved payroll query or correction', desc: 'Payroll query handling and correction requests', rec: 'subscription+abu', meas: 'high', pred: 'high', d: { volume: 5000, manualMinutes: 15 } },

  /* IT Operations */
  { id: 'it-service-desk', name: 'IT Service Desk', fn: 'it-ops', arch: 'conversational', abu: 'Resolved service desk ticket', acc: 'Ticket resolved without escalation and not reopened within 5 business days', desc: 'L1 ticket triage, resolution and fulfilment', rec: 'subscription+abu', meas: 'high', pred: 'high', d: { volume: 12000, agents: 3, manualMinutes: 18, aiAssistedMinutes: 3, sla: 'enhanced' } },
  { id: 'incident-management', name: 'Incident Management', fn: 'it-ops', arch: 'analytical', abu: 'Incident triaged and resolved', desc: 'Alert correlation, triage, diagnosis and runbook execution', rec: 'abu+agentops', meas: 'high', pred: 'low', d: { volume: 2500, manualMinutes: 45, aiAssistedMinutes: 15, sla: 'premium' } },
  { id: 'application-support', name: 'Application Support', fn: 'it-ops', arch: 'analytical', abu: 'Resolved application ticket', desc: 'L2 application support and known-error resolution', rec: 'subscription+abu', meas: 'high', pred: 'medium', d: { volume: 3000, manualMinutes: 60, aiAssistedMinutes: 20 } },
  { id: 'problem-management', name: 'Problem Management', fn: 'it-ops', arch: 'analytical', abu: 'Accepted root-cause analysis', desc: 'Root-cause analysis and recurring-incident elimination', rec: 'subscription+acu', meas: 'low', pred: 'low', d: { volume: 200, manualMinutes: 240, aiAssistedMinutes: 90 } },
  { id: 'change-management-ops', name: 'Change Management', fn: 'it-ops', arch: 'analytical', abu: 'Approved change assessment', desc: 'Change risk scoring and CAB preparation', rec: 'abu', meas: 'high', pred: 'high', d: { volume: 800, manualMinutes: 40, aiAssistedMinutes: 10 } },

  /* Customer Service */
  { id: 'customer-query-resolution', name: 'Customer Query Resolution', fn: 'customer-service', arch: 'conversational', abu: 'Resolved customer case', acc: 'Case resolved in channel with no repeat contact within 7 days', desc: 'Omnichannel query handling with knowledge retrieval', rec: 'subscription+abu', meas: 'high', pred: 'medium', d: { volume: 50000, agents: 3, sla: 'enhanced' } },
  { id: 'complaint-management', name: 'Complaint Management', fn: 'customer-service', arch: 'conversational', abu: 'Complaint resolved and closed', desc: 'Complaint classification, investigation and response drafting', rec: 'subscription+abu', meas: 'high', pred: 'medium', d: { volume: 6000, manualMinutes: 35, aiAssistedMinutes: 10, modelId: 'balanced' } },
  { id: 'case-classification', name: 'Case Classification', fn: 'customer-service', arch: 'screening', abu: 'Correctly classified and routed case', desc: 'Intent detection, classification and routing', rec: 'abu', meas: 'high', pred: 'high', d: { volume: 60000, manualMinutes: 3, aiAssistedMinutes: 0.5, ocrPagesPerTxn: 0 } },
  { id: 'customer-onboarding', name: 'Customer Onboarding', fn: 'customer-service', arch: 'document', abu: 'Customer onboarded and activated', desc: 'Application intake, document checks and activation', rec: 'abu', meas: 'high', pred: 'medium', d: { volume: 4000, manualMinutes: 40, aiAssistedMinutes: 8, ocrPagesPerTxn: 6 } },

  /* Sales & Marketing */
  { id: 'lead-qualification', name: 'Lead Qualification', fn: 'sales-marketing', arch: 'screening', abu: 'Sales-accepted qualified lead', desc: 'Lead enrichment, scoring and routing', rec: 'abu', meas: 'high', pred: 'medium', d: { volume: 10000, manualMinutes: 10, ocrPagesPerTxn: 0 } },
  { id: 'proposal-generation', name: 'Sales Proposal Generation', fn: 'sales-marketing', arch: 'generative', abu: 'Approved proposal draft', desc: 'Tailored proposal drafting from CRM and content library', rec: 'fixed+subscription', meas: 'medium', pred: 'medium', d: { volume: 300 } },
  { id: 'campaign-content', name: 'Campaign Content', fn: 'sales-marketing', arch: 'generative', abu: 'Approved content asset', desc: 'Campaign copy and variant generation', rec: 'subscription+acu', meas: 'medium', pred: 'low', d: { volume: 1500, manualMinutes: 90, aiAssistedMinutes: 20, ocrPagesPerTxn: 0 } },
  { id: 'rfp-responses', name: 'RFP Responses', fn: 'sales-marketing', arch: 'generative', abu: 'Submitted RFP response', desc: 'RFP question answering from the response library', rec: 'fixed+subscription', meas: 'medium', pred: 'low', d: { volume: 40, manualMinutes: 2400, aiAssistedMinutes: 900, callsPerTxn: 60, ocrPagesPerTxn: 40 } },

  /* Supply Chain */
  { id: 'demand-forecasting', name: 'Demand Forecasting', fn: 'supply-chain', arch: 'analytical', abu: 'Accepted forecast cycle per SKU group', desc: 'Forecast generation, adjustment and narrative', rec: 'subscription+acu', meas: 'low', pred: 'high', d: { volume: 2000, manualMinutes: 30, aiAssistedMinutes: 8 } },
  { id: 'inventory-optimization', name: 'Inventory Optimization', fn: 'supply-chain', arch: 'analytical', abu: 'Accepted replenishment recommendation', desc: 'Safety stock and replenishment recommendations', rec: 'hybrid-gainshare', meas: 'medium', pred: 'medium', d: { volume: 5000, manualMinutes: 20, aiAssistedMinutes: 4 } },
  { id: 'order-fulfilment', name: 'Order Fulfilment', fn: 'supply-chain', arch: 'document', abu: 'Order fulfilled without exception', desc: 'Order validation, allocation and exception handling', rec: 'abu', meas: 'high', pred: 'medium', d: { volume: 25000, ocrPagesPerTxn: 1, manualMinutes: 8, aiAssistedMinutes: 1.5 } },
  { id: 'shipment-documentation', name: 'Shipment Documentation', fn: 'supply-chain', arch: 'document', abu: 'Shipment document set completed', desc: 'Bills of lading, customs and compliance documents', rec: 'abu+agentops', meas: 'high', pred: 'medium', d: { volume: 6000, ocrPagesPerTxn: 5, manualMinutes: 25 } },

  /* Manufacturing Operations */
  { id: 'quality-analysis', name: 'Quality Analysis', fn: 'manufacturing-ops', ind: MFG, arch: 'analytical', abu: 'Accepted quality investigation', desc: 'Defect pattern analysis and CAPA drafting', rec: 'subscription+acu', meas: 'medium', pred: 'medium', d: { volume: 800, manualMinutes: 90, aiAssistedMinutes: 25 } },
  { id: 'production-planning', name: 'Production Planning Support', fn: 'manufacturing-ops', ind: MFG, arch: 'analytical', abu: 'Accepted production plan revision', desc: 'Schedule scenario analysis and constraint checks', rec: 'subscription+acu', meas: 'low', pred: 'high', d: { volume: 400, manualMinutes: 120, aiAssistedMinutes: 30 } },
  { id: 'maintenance-work-orders', name: 'Maintenance Work Orders', fn: 'manufacturing-ops', ind: MFG, arch: 'document', abu: 'Work order created and closed', desc: 'Work order creation, parts lookup and closure notes', rec: 'abu', meas: 'high', pred: 'medium', d: { volume: 4000, ocrPagesPerTxn: 1, manualMinutes: 20, aiAssistedMinutes: 5 } },
  { id: 'supplier-quality', name: 'Supplier Quality', fn: 'manufacturing-ops', ind: MFG, arch: 'review', abu: 'Supplier quality case closed', desc: 'Supplier non-conformance and certificate review', rec: 'abu', meas: 'high', pred: 'medium', d: { volume: 600, ocrPagesPerTxn: 8, manualMinutes: 60 } },

  /* Banking (industry-specific) */
  { id: 'kyc', name: 'KYC', fn: 'risk-compliance', ind: BANK, arch: 'document', abu: 'Completed KYC verification', acc: 'Customer identity verified, screening complete and file approved by compliance', desc: 'Identity verification, screening and risk rating', rec: 'abu', meas: 'high', pred: 'medium', d: { volume: 5000, manualMinutes: 45, aiAssistedMinutes: 10, ocrPagesPerTxn: 8, laborUSD: 38, laborINR: 750, humanReviewRatePct: 20, humanReviewMinutes: 5, sla: 'enhanced' } },
  { id: 'loan-origination', name: 'Loan Origination', fn: 'enterprise-ops', ind: BANK, arch: 'document', abu: 'Loan application processed to decision', desc: 'Application intake, document verification and decision support', rec: 'abu+agentops', meas: 'high', pred: 'medium', d: { volume: 3000, manualMinutes: 90, aiAssistedMinutes: 20, ocrPagesPerTxn: 20, laborUSD: 40, laborINR: 800 } },
  { id: 'credit-assessment', name: 'Credit Assessment Support', fn: 'risk-compliance', ind: BANK, arch: 'analytical', abu: 'Accepted credit memo', desc: 'Financial spreading and credit memo drafting', rec: 'abu', meas: 'high', pred: 'medium', d: { volume: 800, manualMinutes: 180, aiAssistedMinutes: 45, ocrPagesPerTxn: 30, modelId: 'frontier', laborUSD: 55, laborINR: 1100 } },
  { id: 'transaction-reconciliation', name: 'Transaction Reconciliation', fn: 'finance', ind: BANK, arch: 'analytical', abu: 'Reconciled transaction break resolved', desc: 'Nostro/vostro and card settlement break resolution', rec: 'abu', meas: 'high', pred: 'high', d: { volume: 20000, manualMinutes: 12, aiAssistedMinutes: 2, modelId: 'fast' } },
  { id: 'fraud-investigation', name: 'Fraud Investigation Support', fn: 'risk-compliance', ind: BANK, arch: 'analytical', abu: 'Investigated alert with accepted disposition', desc: 'Alert triage, evidence gathering and case narrative', rec: 'subscription+abu', meas: 'medium', pred: 'low', d: { volume: 4000, manualMinutes: 40, aiAssistedMinutes: 12, sla: 'premium' } },

  /* Insurance (industry-specific) */
  { id: 'claims-processing', name: 'Claims Processing', fn: 'enterprise-ops', ind: INS, arch: 'document', abu: 'Accepted claim assessment', acc: 'Claim triaged, coverage validated and assessment accepted by the adjuster', desc: 'FNOL intake, coverage checks, assessment and settlement support', rec: 'abu+agentops', meas: 'high', pred: 'medium', d: { volume: 8000, agents: 4, manualMinutes: 60, aiAssistedMinutes: 15, ocrPagesPerTxn: 12, laborUSD: 38, laborINR: 750, humanReviewRatePct: 15, humanReviewMinutes: 6 } },
  { id: 'underwriting-support', name: 'Underwriting Support', fn: 'risk-compliance', ind: INS, arch: 'review', abu: 'Accepted underwriting submission summary', desc: 'Submission ingestion, risk summary and pricing support', rec: 'abu', meas: 'high', pred: 'medium', d: { volume: 1500, manualMinutes: 120 } },
  { id: 'policy-servicing', name: 'Policy Servicing', fn: 'customer-service', ind: INS, arch: 'document', abu: 'Policy change completed', desc: 'Endorsements, renewals and policy changes', rec: 'subscription+abu', meas: 'high', pred: 'high', d: { volume: 10000, manualMinutes: 20, aiAssistedMinutes: 4, ocrPagesPerTxn: 2 } },
  { id: 'customer-claims-queries', name: 'Customer Claims Queries', fn: 'customer-service', ind: INS, arch: 'conversational', abu: 'Resolved claims status query', desc: 'Claim status and documentation queries', rec: 'subscription+abu', meas: 'high', pred: 'medium', d: { volume: 25000 } },

  /* Logistics (industry-specific) */
  { id: 'freight-invoice-processing', name: 'Freight Invoice Processing', fn: 'supply-chain', ind: LOG, arch: 'document', abu: 'Freight invoice audited and approved', desc: 'Freight bill audit against rates and shipment data', rec: 'abu+agentops', meas: 'high', pred: 'high', d: { volume: 30000, ocrPagesPerTxn: 2, manualMinutes: 10, aiAssistedMinutes: 2 } },
  { id: 'shipment-tracking', name: 'Shipment Tracking', fn: 'supply-chain', ind: LOG, arch: 'conversational', abu: 'Resolved shipment status request', desc: 'Proactive tracking updates and customer queries', rec: 'subscription+abu', meas: 'high', pred: 'high', d: { volume: 40000, manualMinutes: 6, aiAssistedMinutes: 1 } },
  { id: 'exception-management', name: 'Exception Management', fn: 'supply-chain', ind: LOG, arch: 'analytical', abu: 'Shipment exception resolved', desc: 'Delay, damage and documentation exception resolution', rec: 'abu', meas: 'high', pred: 'low', d: { volume: 5000, manualMinutes: 30, aiAssistedMinutes: 8 } },
  { id: 'quote-to-cash', name: 'Quote-to-Cash', fn: 'sales-marketing', ind: LOG, arch: 'document', abu: 'Accepted quote-to-cash transaction', desc: 'Rate quoting, booking, billing and collections', rec: 'hybrid', meas: 'medium', pred: 'medium', d: { volume: 12000, agents: 4, implScale: 1.4, ocrPagesPerTxn: 1 } },

  /* Healthcare (industry-specific) */
  { id: 'medical-document-processing', name: 'Medical Document Processing', fn: 'enterprise-ops', ind: HC, arch: 'document', abu: 'Accepted processed medical document', desc: 'Clinical document classification, extraction and coding support', rec: 'abu+agentops', meas: 'high', pred: 'medium', d: { volume: 20000, ocrPagesPerTxn: 6, manualMinutes: 12, aiAssistedMinutes: 2, hosting: 'private', humanReviewRatePct: 15 } },
  { id: 'claims-administration', name: 'Claims Administration', fn: 'finance', ind: HC, arch: 'document', abu: 'Adjudicated claim accepted', desc: 'Healthcare claim validation, coding checks and adjudication support', rec: 'abu+agentops', meas: 'high', pred: 'medium', d: { volume: 15000, ocrPagesPerTxn: 4, manualMinutes: 20, aiAssistedMinutes: 4, hosting: 'private' } },
  { id: 'patient-service-requests', name: 'Patient Service Requests', fn: 'customer-service', ind: HC, arch: 'conversational', abu: 'Resolved patient request', desc: 'Appointments, prescriptions and billing queries', rec: 'subscription+abu', meas: 'high', pred: 'medium', d: { volume: 20000, hosting: 'private' } },

  /* Risk & Compliance (cross-industry) */
  { id: 'regulatory-document-review', name: 'Regulatory Document Review', fn: 'risk-compliance', arch: 'review', abu: 'Accepted regulatory impact assessment', desc: 'Regulatory change analysis and obligation mapping', rec: 'abu', meas: 'medium', pred: 'low', d: { volume: 150, manualMinutes: 240, aiAssistedMinutes: 60, ocrPagesPerTxn: 60 } },
  { id: 'policy-compliance', name: 'Policy Compliance', fn: 'risk-compliance', arch: 'analytical', abu: 'Completed compliance check', desc: 'Control testing and policy-adherence checks', rec: 'subscription+acu', meas: 'medium', pred: 'medium', d: { volume: 2000, manualMinutes: 45, aiAssistedMinutes: 10 } },
  { id: 'audit-evidence', name: 'Audit Evidence Collection', fn: 'risk-compliance', arch: 'document', abu: 'Accepted evidence pack per control', desc: 'Evidence gathering, tagging and packaging for audit', rec: 'abu', meas: 'high', pred: 'medium', d: { volume: 1200, manualMinutes: 60, aiAssistedMinutes: 12, ocrPagesPerTxn: 10 } },

  /* Legal (cross-industry) */
  { id: 'contract-review', name: 'Contract Review', fn: 'legal', arch: 'review', abu: 'Accepted contract review', acc: 'Redlines and risk summary accepted by counsel without material rework', desc: 'Playbook-based review and redlining', rec: 'abu', meas: 'high', pred: 'medium', d: { volume: 500, laborUSD: 95, laborINR: 2500 } },
  { id: 'legal-document-analysis', name: 'Legal Document Analysis', fn: 'legal', arch: 'review', abu: 'Accepted document analysis', desc: 'Litigation and due-diligence document analysis', rec: 'abu', meas: 'medium', pred: 'low', d: { volume: 2000, manualMinutes: 45, aiAssistedMinutes: 10, laborUSD: 90, laborINR: 2200 } },
  { id: 'clause-extraction', name: 'Clause Extraction', fn: 'legal', arch: 'screening', abu: 'Accepted clause extraction set', desc: 'Clause and obligation extraction to a contract repository', rec: 'abu', meas: 'high', pred: 'medium', d: { volume: 3000, ocrPagesPerTxn: 15, manualMinutes: 30, aiAssistedMinutes: 5, laborUSD: 60, laborINR: 1300, modelId: 'balanced' } },

  /* Enterprise Operations (cross-industry) */
  { id: 'enterprise-ai-assistant', name: 'Enterprise AI Assistant', fn: 'enterprise-ops', arch: 'conversational', abu: 'Resolved employee request', desc: 'Knowledge assistant for employees across policies, systems and documents', rec: 'subscription+acu', meas: 'low', pred: 'low', d: { volume: 60000, agents: 2, manualMinutes: 8, aiAssistedMinutes: 2, modelId: 'balanced', ragQueriesPerTxn: 3, cashRealisationPct: 10 }, unit: 'user' },
  { id: 'document-processing', name: 'Intelligent Document Processing', fn: 'enterprise-ops', arch: 'document', abu: 'Accepted processed document', desc: 'Generic document classification and extraction', rec: 'abu+agentops', meas: 'high', pred: 'medium', d: { volume: 25000 } },
  { id: 'email-triage', name: 'Email Triage & Routing', fn: 'enterprise-ops', arch: 'screening', abu: 'Correctly triaged and actioned email', desc: 'Shared-mailbox classification, extraction and routing', rec: 'abu', meas: 'high', pred: 'high', d: { volume: 40000, manualMinutes: 4, aiAssistedMinutes: 0.5, ocrPagesPerTxn: 1 } },

  /* IT SDLC — single-stage agents */
  { id: 'sdlc-requirements', name: 'Requirements Analysis Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Requirements Engineering', agent: 'Requirements Analysis Agent', arch: 'sdlc-analysis', abu: 'Accepted requirement', desc: 'Elicits, structures and validates requirements', rec: 'subscription+abu', meas: 'medium', pred: 'medium', driver: { ...STORIES, label: 'Requirements per month (≈ user stories)' } },
  { id: 'sdlc-user-stories', name: 'User Story Generation Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Business Analysis', agent: 'User Story Generation Agent', arch: 'sdlc-analysis', abu: 'Approved user story', desc: 'Generates user stories with acceptance criteria', rec: 'subscription+abu', meas: 'high', pred: 'high', d: { manualMinutes: 60, aiAssistedMinutes: 15 }, driver: STORIES },
  { id: 'sdlc-architecture', name: 'Architecture Design Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Solution Architecture', agent: 'Architecture Design Agent', arch: 'sdlc-analysis', abu: 'Approved architecture deliverable', desc: 'Drafts architecture options, decisions and diagrams', rec: 'fixed+subscription', meas: 'medium', pred: 'low', d: { manualMinutes: 960, aiAssistedMinutes: 360, laborUSD: 85, laborINR: 2500 }, driver: { field: 'stories', factor: 0.05, label: 'Architecture deliverables per month (≈ 5% of stories)' } },
  { id: 'sdlc-technical-design', name: 'Technical Design Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Technical Design', agent: 'Technical Design Agent', arch: 'sdlc-analysis', abu: 'Accepted design', desc: 'Produces component and API designs', rec: 'subscription+abu', meas: 'medium', pred: 'medium', d: { manualMinutes: 240, aiAssistedMinutes: 60 }, driver: { field: 'stories', factor: 0.3, label: 'Designs per month (≈ 30% of stories)' } },
  { id: 'sdlc-code-generation', name: 'Code Generation Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Software Development', agent: 'Code Generation Agent', arch: 'sdlc-code', abu: 'Accepted development task', acc: 'Pull request merged after human review with tests passing — lines of code and suggestions are not billable', desc: 'Implements development tasks from stories and designs', rec: 'subscription+acu', meas: 'medium', pred: 'medium', driver: STORIES },
  { id: 'sdlc-code-review', name: 'Code Review Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Code Review', agent: 'Code Review Agent', arch: 'sdlc-review', abu: 'Accepted code review', desc: 'Reviews pull requests for defects, standards and security', rec: 'subscription+abu', meas: 'high', pred: 'high', driver: { field: 'codeReviewsPerMonth', factor: 1, label: 'Code reviews per month' } },
  { id: 'sdlc-unit-tests', name: 'Unit Test Generation Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Unit Testing', agent: 'Unit Test Generation Agent', arch: 'sdlc-test', abu: 'Accepted test suite', desc: 'Generates unit test suites for changed code', rec: 'abu', meas: 'high', pred: 'medium', driver: { field: 'prsPerMonth', factor: 1, label: 'Pull requests per month (one suite per PR)' } },
  { id: 'sdlc-test-cases', name: 'Test Case Generation Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Functional Testing', agent: 'Test Case Generation Agent', arch: 'sdlc-test', abu: 'Approved test suite', desc: 'Generates functional test cases from requirements', rec: 'abu', meas: 'high', pred: 'medium', driver: STORIES },
  { id: 'sdlc-test-automation', name: 'Test Automation Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Test Automation', agent: 'Test Automation Agent', arch: 'sdlc-test', abu: 'Accepted automated test script', desc: 'Converts test cases into automated scripts', rec: 'abu', meas: 'high', pred: 'medium', d: { manualMinutes: 60, aiAssistedMinutes: 15 }, driver: { field: 'testCasesPerMonth', factor: 1, label: 'Test cases per month' } },
  { id: 'sdlc-integration-testing', name: 'Integration Testing Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Integration Testing', agent: 'Integration Testing Agent', arch: 'sdlc-test', abu: 'Accepted integration test suite', desc: 'Builds and runs integration test suites', rec: 'abu', meas: 'high', pred: 'medium', d: { manualMinutes: 240, aiAssistedMinutes: 60 }, driver: { field: 'deploymentsPerMonth', factor: 1, label: 'Releases per month (one suite per release)' } },
  { id: 'sdlc-security-review', name: 'Security Review Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Security Testing', agent: 'Security Review Agent', arch: 'sdlc-review', abu: 'Validated security assessment', desc: 'SAST triage, threat modelling and security findings', rec: 'abu', meas: 'high', pred: 'medium', d: { manualMinutes: 480, aiAssistedMinutes: 120, modelId: 'frontier', laborUSD: 80, laborINR: 2200 }, driver: { field: 'deploymentsPerMonth', factor: 1, label: 'Releases per month (one assessment per release)' } },
  { id: 'sdlc-performance-testing', name: 'Performance Testing Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Performance Testing', agent: 'Performance Testing Agent', arch: 'sdlc-test', abu: 'Accepted test execution', desc: 'Designs, runs and analyses load tests', rec: 'subscription+abu', meas: 'high', pred: 'medium', d: { manualMinutes: 360, aiAssistedMinutes: 90 }, driver: { field: 'deploymentsPerMonth', factor: 1, label: 'Releases per month' } },
  { id: 'sdlc-defect-resolution', name: 'Defect Resolution Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Defect Management', agent: 'Defect Resolution Agent', arch: 'sdlc-support', abu: 'Verified resolved defect', desc: 'Diagnoses defects and proposes verified fixes', rec: 'abu', meas: 'high', pred: 'low', driver: { field: 'defectsPerMonth', factor: 1, label: 'Defects per month' } },
  { id: 'sdlc-build-automation', name: 'Build Automation Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'DevOps', agent: 'Build Automation Agent', arch: 'sdlc-ops', abu: 'Successful build', desc: 'Diagnoses and repairs failing builds', rec: 'subscription+abu', meas: 'high', pred: 'high', d: { manualMinutes: 20, aiAssistedMinutes: 2 }, driver: { field: 'buildsPerMonth', factor: 1, label: 'Builds per month' } },
  { id: 'sdlc-deployment', name: 'Deployment Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'CI/CD', agent: 'Deployment Agent', arch: 'sdlc-ops', abu: 'Successful deployment', desc: 'Plans, executes and verifies deployments', rec: 'subscription+abu', meas: 'high', pred: 'high', d: { manualMinutes: 180, aiAssistedMinutes: 30, modelId: 'balanced' }, driver: { field: 'deploymentsPerMonth', factor: 1, label: 'Deployments per month' } },
  { id: 'sdlc-documentation', name: 'Technical Documentation Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Documentation', agent: 'Technical Documentation Agent', arch: 'sdlc-doc', abu: 'Approved document', desc: 'Generates and maintains technical documentation', rec: 'abu', meas: 'high', pred: 'medium', driver: { field: 'stories', factor: 0.5, label: 'Documents per month (≈ 50% of stories)' } },
  { id: 'sdlc-legacy-modernization', name: 'Legacy Modernization Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Application Modernization', agent: 'Legacy Modernization Agent', arch: 'sdlc-code', abu: 'Accepted modernization task', desc: 'Analyses and converts legacy code modules', rec: 'fixed+milestones', meas: 'medium', pred: 'high', d: { manualMinutes: 960, aiAssistedMinutes: 420, inputTokensPerCall: 40000 }, driver: STORIES },
  { id: 'sdlc-app-support', name: 'Application Support Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Production Support', agent: 'Application Support Agent', arch: 'sdlc-support', abu: 'Resolved ticket', desc: 'Triage and resolution of production support tickets', rec: 'subscription+abu', meas: 'high', pred: 'medium', d: { manualMinutes: 60, aiAssistedMinutes: 20 }, driver: { field: 'ticketsPerMonth', factor: 1, label: 'Support tickets per month' } },
  { id: 'sdlc-change-impact', name: 'Change Impact Analysis Agent', fn: 'sdlc', kind: 'sdlc-agent', stage: 'Change Management', agent: 'Change Impact Analysis Agent', arch: 'sdlc-analysis', abu: 'Approved change assessment', desc: 'Assesses code, dependency and business impact of changes', rec: 'abu', meas: 'high', pred: 'medium', d: { manualMinutes: 120, aiAssistedMinutes: 30 }, driver: { field: 'deploymentsPerMonth', factor: 2, label: 'Change requests per month (≈ 2 per release)' } },

  /* IT SDLC — preconfigured templates (multi-agent workflows) */
  { id: 'tpl-ai-coding-assistant', name: 'AI Coding Assistant', fn: 'sdlc', kind: 'sdlc-template', arch: 'sdlc-code', abu: 'Accepted development task', acc: 'Development task merged after human review — suggestions and lines of code are not billable', desc: 'In-IDE assistant for a developer population', rec: 'dev-subscription+acu', meas: 'low', pred: 'high', stages: ['sdlc-code-generation'], d: { agents: 1, successRate: 70, manualMinutes: 480, aiAssistedMinutes: 360, callsPerTxn: 30, inputTokensPerCall: 20000, outputTokensPerCall: 1500, implScale: 0.5 }, driver: STORIES, unit: 'developer' },
  { id: 'tpl-requirements-to-code', name: 'Requirements-to-Code Agent', fn: 'sdlc', kind: 'sdlc-template', arch: 'sdlc-code', abu: 'Accepted development task', desc: 'Requirement → story → design → code workflow', rec: 'subscription+acu', meas: 'medium', pred: 'medium', stages: ['sdlc-requirements', 'sdlc-user-stories', 'sdlc-technical-design', 'sdlc-code-generation'], d: { agents: 4, manualMinutes: 720, aiAssistedMinutes: 360, callsPerTxn: 40, implScale: 1.3 }, driver: STORIES },
  { id: 'tpl-automated-testing', name: 'Automated Testing Agent', fn: 'sdlc', kind: 'sdlc-template', arch: 'sdlc-test', abu: 'Accepted automated test suite', desc: 'Test case generation, automation and execution', rec: 'abu', meas: 'high', pred: 'medium', stages: ['sdlc-test-cases', 'sdlc-test-automation', 'sdlc-unit-tests'], d: { agents: 3, manualMinutes: 240, aiAssistedMinutes: 60, callsPerTxn: 24, implScale: 1 }, driver: STORIES },
  { id: 'tpl-code-review', name: 'Code Review Agent (template)', fn: 'sdlc', kind: 'sdlc-template', arch: 'sdlc-review', abu: 'Accepted code review', desc: 'Automated PR review with security checks', rec: 'subscription+abu', meas: 'high', pred: 'high', stages: ['sdlc-code-review', 'sdlc-security-review'], d: { agents: 2, callsPerTxn: 10 }, driver: { field: 'codeReviewsPerMonth', factor: 1, label: 'Code reviews per month' } },
  { id: 'tpl-legacy-modernization', name: 'Legacy Modernization Agent (template)', fn: 'sdlc', kind: 'sdlc-template', arch: 'sdlc-code', abu: 'Accepted modernization task', desc: 'Code analysis, conversion, testing and documentation for legacy estates', rec: 'fixed+milestones', meas: 'medium', pred: 'high', stages: ['sdlc-legacy-modernization', 'sdlc-unit-tests', 'sdlc-documentation'], d: { agents: 3, manualMinutes: 960, aiAssistedMinutes: 400, inputTokensPerCall: 40000, callsPerTxn: 30, implScale: 1.5 }, driver: STORIES },
  { id: 'tpl-devops-deployment', name: 'DevOps & Deployment Agent', fn: 'sdlc', kind: 'sdlc-template', arch: 'sdlc-ops', abu: 'Successful deployment', desc: 'Build repair, deployment and post-deploy verification', rec: 'subscription+abu', meas: 'high', pred: 'high', stages: ['sdlc-build-automation', 'sdlc-deployment', 'sdlc-change-impact'], d: { agents: 3, manualMinutes: 240, aiAssistedMinutes: 40, callsPerTxn: 12, modelId: 'balanced' }, driver: { field: 'deploymentsPerMonth', factor: 1, label: 'Deployments per month' } },
  { id: 'tpl-e2e-agentic-sdlc', name: 'End-to-End Agentic SDLC', fn: 'sdlc', kind: 'sdlc-template', arch: 'sdlc-code', abu: 'Accepted development task released to production', acc: 'Story implemented, reviewed, tested and deployed — lines of code, suggestions and story points are not billable', desc: 'Multi-agent workflow from requirement to production', rec: 'hybrid', meas: 'medium', pred: 'medium', stages: ['sdlc-requirements', 'sdlc-user-stories', 'sdlc-technical-design', 'sdlc-code-generation', 'sdlc-code-review', 'sdlc-unit-tests', 'sdlc-test-automation', 'sdlc-security-review', 'sdlc-deployment', 'sdlc-documentation'], d: { agents: 10, manualMinutes: 1200, aiAssistedMinutes: 600, callsPerTxn: 80, implScale: 1.2, sla: 'enhanced' }, driver: STORIES },
];

export const PROCESSES: ProcessDef[] = SPECS.map((s) => ({
  id: s.id,
  name: s.name,
  functionId: s.fn,
  industries: s.ind ?? 'all',
  kind: s.kind ?? 'business',
  sdlcStage: s.stage,
  agentName: s.agent,
  abuUnit: s.abu,
  acceptance: s.acc ?? `${s.abu} that meets the agreed quality criteria, counted once per unique business transaction`,
  description: s.desc,
  recommendation: s.rec,
  measurability: s.meas ?? 'medium',
  predictability: s.pred ?? 'medium',
  defaults: { ...BASE, ...ARCHETYPES[s.arch], ...(s.d ?? {}) },
  stages: s.stages,
  sdlcDriver: s.driver,
  subscriptionUnit: s.unit,
}));

export const CUSTOM_PROCESS_ID = 'custom';

export const CUSTOM_PROCESS: ProcessDef = {
  id: CUSTOM_PROCESS_ID,
  name: 'Custom process',
  functionId: 'enterprise-ops',
  industries: 'all',
  kind: 'business',
  abuUnit: 'Accepted business transaction',
  acceptance: 'Transaction completed by the agent and accepted against the agreed criteria, counted once',
  description: 'Define your own process and assumptions',
  recommendation: 'abu',
  measurability: 'medium',
  predictability: 'medium',
  defaults: { ...BASE },
};

export const getProcess = (id: string): ProcessDef =>
  PROCESSES.find((p) => p.id === id) ?? CUSTOM_PROCESS;

export const processesFor = (industryId: string, functionId: string, showAll = false): ProcessDef[] =>
  PROCESSES.filter(
    (p) =>
      p.functionId === functionId &&
      (showAll || industryId === 'other' || p.industries === 'all' || p.industries.includes(industryId as IndustryId)),
  ).sort((a, b) => (a.kind === 'sdlc-template' ? 0 : 1) - (b.kind === 'sdlc-template' ? 0 : 1));

export const industryName = (id: string) => INDUSTRIES.find((i) => i.id === id)?.name ?? id;
export const functionName = (id: string) => FUNCTIONS.find((f) => f.id === id)?.name ?? id;

export const SDLC_STAGE_AGENTS = PROCESSES.filter((p) => p.kind === 'sdlc-agent');
export const SDLC_TEMPLATES = PROCESSES.filter((p) => p.kind === 'sdlc-template');

export const DEFAULT_SDLC: Omit<SdlcInputs, 'cicdMonthlyCost'> & { cicdMonthlyCostUSD: number } = {
  developers: 100,
  teams: 12,
  sprintsPerMonth: 2,
  storiesPerSprint: 10,
  avgStoryPoints: 5,
  prsPerMonth: 700,
  codeReviewsPerMonth: 700,
  testCasesPerMonth: 2000,
  defectsPerMonth: 200,
  buildsPerMonth: 1500,
  deploymentsPerMonth: 40,
  ticketsPerMonth: 300,
  cicdMonthlyCostUSD: 600,
  deriveVolume: true,
  metrics: {
    cycleTimeDays: { baseline: 12, improvementPct: 20, source: 'assumed' },
    leadTimeHours: { baseline: 96, improvementPct: 25, source: 'assumed' },
    reviewTurnaroundHours: { baseline: 24, improvementPct: 40, source: 'assumed' },
    defectEscapeRatePct: { baseline: 8, improvementPct: 15, source: 'assumed' },
    defectResolutionHours: { baseline: 36, improvementPct: 20, source: 'assumed' },
    deploymentsPerMonth: { baseline: 20, improvementPct: 25, source: 'assumed' },
    changeFailureRatePct: { baseline: 15, improvementPct: 20, source: 'assumed' },
    mttrHours: { baseline: 6, improvementPct: 25, source: 'assumed' },
  },
};
