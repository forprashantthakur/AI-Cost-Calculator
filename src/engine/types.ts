/* ------------------------------------------------------------------------- */
/*  Core vocabulary                                                          */
/* ------------------------------------------------------------------------- */

export type Complexity = 'low' | 'medium' | 'high';
export const COMPLEXITIES: Complexity[] = ['low', 'medium', 'high'];

export type CurrencyCode = 'USD' | 'INR' | 'EUR' | 'GBP' | 'AUD' | 'SGD' | 'AED' | 'JPY' | 'CAD';

/** The seven commercial models. */
export type ModelKey = 'fixed' | 'acu' | 'abu' | 'subscription' | 'agentops' | 'gainshare' | 'hybrid';
export const MODEL_KEYS: ModelKey[] = ['fixed', 'acu', 'abu', 'subscription', 'agentops', 'gainshare', 'hybrid'];

export type HostingKey = 'shared' | 'private' | 'onprem';
export type SlaKey = 'standard' | 'enhanced' | 'premium';
export type BenefitStatus = 'assumed' | 'validated';
export type BaselineSource = 'measured' | 'assumed' | 'none';
export type SubscriptionUnit = 'agent' | 'user' | 'developer' | 'team';
export type ClientPreference = 'none' | 'predictable' | 'outcomes' | 'usage' | 'risk-share';
export type AgentOpsBilling = 'bundled' | 'separate';
export type AcuMethod = 'cost' | 'weighted';
export type Level = 'high' | 'medium' | 'low';

/**
 * Cost pools. Every monthly cost line belongs to exactly one pool, and every
 * commercial model assigns every pool to exactly one revenue component (or to
 * the client as pass-through, or "at risk" under gainshare). That assignment
 * is what prevents the same cost being recovered twice.
 */
export type CostPool = 'consumption' | 'platform' | 'agentops' | 'service';
export const COST_POOLS: CostPool[] = ['consumption', 'platform', 'agentops', 'service'];

/* ------------------------------------------------------------------------- */
/*  Rate card (Settings)                                                     */
/* ------------------------------------------------------------------------- */

export interface ModelRate {
  id: string;
  provider: string;
  name: string;
  /** USD per 1M tokens. */
  inputPer1M: number;
  outputPer1M: number;
  /** USD per 1M cached input tokens (cache reads). */
  cachedInputPer1M: number;
  effectiveDate: string;
  source: string;
  illustrative: boolean;
}

/**
 * One designation on the people rate card (for example "Implement · Manager").
 * Rates are per hour in the rate card's resource currency.
 */
export interface ResourceRate {
  /** Stable key, e.g. "implement-manager". */
  id: string;
  /** Member firm or practice: Advise, Implement, Operate… */
  memberFirm: string;
  designation: string;
  /** Standard hourly rack rate — the list price charged to clients. */
  rackRatePerHour: number;
  /** Standard hourly delivery cost to the provider. */
  costRatePerHour: number;
}

/** One role in the AgentOps team: hours per month staffed from a designation. */
export interface AgentOpsRoleDef {
  id: string;
  label: string;
  /** ResourceRate id. */
  resourceId: string;
  /** Hours per month regardless of agent count, before the SLA multiplier. */
  baseHoursPerMonth: number;
  /** Additional hours per month for each AI agent, before the SLA multiplier. */
  hoursPerAgentPerMonth: number;
}

/** How people-based fees (implementation, AgentOps team) are priced. */
export type PeoplePricing = 'discount' | 'margin';

export interface ImplActivityDef {
  id: string;
  label: string;
  /** ResourceRate id of the designation doing the work. */
  roleId: string;
  /** Hours at medium complexity for one agent. */
  baseHours: number;
}

export interface AcuWeights {
  inputTokensPer1K: number;
  cachedTokensPer1K: number;
  outputTokensPer1K: number;
  ocrPage: number;
  toolCall: number;
  orchestrationRun: number;
  vectorQuery: number;
  embeddingTokensPer1K: number;
}

export interface RateCard {
  version: string;
  effectiveDate: string;
  source: string;
  baseCurrency: 'USD';
  /** Units of each currency per 1 USD. */
  fx: Record<CurrencyCode, number>;
  fxEffectiveDate: string;
  fxSource: string;
  /** Legacy (rate cards before RC-2026.11): no longer applied. People costs come from `resourceRates`. */
  deliveryCostIndex?: Record<CurrencyCode, number>;
  models: ModelRate[];
  /** USD unit rates. */
  ocrPerPage: number;
  embeddingPer1M: number;
  vectorQueryPer1K: number;
  orchestrationPerRun: number;
  toolCallCost: number;
  infraBasePerMonth: number;
  infraPerAgentPerMonth: number;
  observabilityPerAgentPerMonth: number;
  hostingMultipliers: Record<HostingKey, number>;
  slaMultipliers: Record<SlaKey, number>;
  /** People rate card: designations with rack and cost rates per hour, in `resourceCurrency`. */
  resourceRates: ResourceRate[];
  resourceCurrency: CurrencyCode;
  /** Date the people rates were last updated (ISO). */
  resourceRatesUpdated: string;
  resourceRatesSource: string;
  /** Discount off rack rate that new estimates start with (%). */
  defaultDiscountPct: number;
  /** AgentOps team staffing, costed at the designations' cost rates. */
  agentOpsTeam: AgentOpsRoleDef[];
  implActivities: ImplActivityDef[];
  implComplexityFactor: Record<Complexity, number>;
  /** Extra implementation effort per additional agent (fraction of base). */
  implPerExtraAgent: number;
  acu: {
    method: AcuMethod;
    /** Method A: this much eligible consumption = 1 ACU. */
    referenceCost: number;
    referenceCurrency: CurrencyCode;
    /** Method B: ACUs per measured resource unit. */
    weights: AcuWeights;
    version: string;
    effectiveDate: string;
  };
  abuWeights: Record<Complexity, number>;
  /** Resource-consumption multiplier by complexity (tokens, OCR pages, tool calls). */
  effortMultipliers: Record<Complexity, number>;
  defaultMargins: { implementation: number; run: number };
  fteHoursPerMonth: number;
  changeLog: { date: string; version: string; note: string }[];
  /** Admin edits to process template defaults, keyed by process id. */
  processOverrides?: Record<string, Record<string, number | string>>;
}

/* ------------------------------------------------------------------------- */
/*  Estimate inputs                                                          */
/* ------------------------------------------------------------------------- */

export interface ImplActivityInput {
  id: string;
  label: string;
  roleId: string;
  hours: number;
}

export interface VolumeTier {
  /** Upper bound of billable units in this tier (null = no upper bound). */
  upTo: number | null;
  discountPct: number;
}

export interface HybridConfig {
  subscription: boolean;
  usage: 'abu' | 'acu' | 'none';
  agentOps: boolean;
  gainshare: boolean;
}

export interface CommercialTerms {
  /** null = use the recommended model. */
  selectedModel: ModelKey | null;
  /** 'auto' = follow the recommendation. */
  agentOpsBilling: AgentOpsBilling | 'auto';
  /** null = follow the recommendation. */
  hybrid: HybridConfig | null;
  contractYears: number;
  escalationPct: number;
  minMonthlyCommitment: number;
  volumeTiers: VolumeTier[];
  subscriptionUnit: SubscriptionUnit;
  subscriptionUnits: number;
  subscriptionPriceOverride: number | null;
  includedAbusOverride: number | null;
  overagePremiumPct: number;
  abuPriceOverride: number | null;
  acuPriceOverride: number | null;
  agentOpsFeeOverride: number | null;
  gainsharePct: number;
  clientPreference: ClientPreference;
  /** Set by the scenario simulator to hold baseline prices fixed ("locked prices" mode). */
  lockedPrices?: LockedPrices | null;
}

export interface LockedPrices {
  abuPrice: number | null;
  acuPrice: number | null;
  agentOpsFee: number;
  fixedFee: number;
  subscriptionUnitPrice: number;
  includedAbus: number;
  overagePrice: number | null;
  hybridSubUnitPrice: number;
  hybridUsagePrice: number | null;
}

export interface ValueInputs {
  /** Share of the freed capacity value that becomes an actual cash saving. */
  cashRealisationPct: number;
  cashRealisationStatus: BenefitStatus;
  costAvoidanceAnnual: number;
  costAvoidanceStatus: BenefitStatus;
  /** Attributable margin contribution from revenue uplift (annual). */
  revenueUpliftAnnual: number;
  revenueUpliftStatus: BenefitStatus;
}

export type SdlcMetricKey =
  | 'cycleTimeDays'
  | 'leadTimeHours'
  | 'reviewTurnaroundHours'
  | 'defectEscapeRatePct'
  | 'defectResolutionHours'
  | 'deploymentsPerMonth'
  | 'changeFailureRatePct'
  | 'mttrHours';

export interface SdlcMetricInput {
  baseline: number | null;
  improvementPct: number;
  source: BaselineSource;
}

export interface SdlcInputs {
  developers: number;
  teams: number;
  sprintsPerMonth: number;
  storiesPerSprint: number;
  avgStoryPoints: number;
  prsPerMonth: number;
  codeReviewsPerMonth: number;
  testCasesPerMonth: number;
  defectsPerMonth: number;
  buildsPerMonth: number;
  deploymentsPerMonth: number;
  ticketsPerMonth: number;
  cicdMonthlyCost: number;
  /** When true, monthly volume is derived from the SDLC drivers. */
  deriveVolume: boolean;
  metrics: Record<SdlcMetricKey, SdlcMetricInput>;
}

export interface EstimateInputs {
  id: string;
  name: string;
  client: string;
  createdAt: string;
  updatedAt: string;
  rateCardVersion: string;
  isSample?: boolean;
  status: 'draft' | 'final';

  industryId: string;
  functionId: string;
  processId: string;
  customProcessName: string;
  abuUnit: string;
  acceptanceCriteria: string;
  workflowStages: string[];
  currency: CurrencyCode;

  /* Basic */
  monthlyVolume: number;
  agents: number;
  complexity: Complexity;
  useComplexityMix: boolean;
  complexityMix: Record<Complexity, number>;
  successRate: number;
  manualMinutes: number;
  employeeCostPerHour: number;
  aiAssistedMinutes: number;
  targetMargin: number;

  /* Advanced */
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
  humanReviewCostPerHour: number;
  hosting: HostingKey;
  sla: SlaKey;
  orchestrationCostPerRunOverride: number | null;
  infraOverride: number | null;
  observabilityOverride: number | null;
  agentOpsOverride: number | null;
  evalCostMonthly: number;
  otherMonthly: number;
  volumeGrowthPct: number;

  /* Implementation */
  implMode: 'simple' | 'detailed';
  implSimpleCost: number;
  implActivities: ImplActivityInput[];
  implMarginPct: number;

  /* People pricing (implementation and the AgentOps team) */
  /** 'discount' = rack rate × hours × (1 − discount); 'margin' = cost ÷ (1 − target margin). */
  peoplePricing: PeoplePricing;
  /** Discount off rack rate, % (used when peoplePricing = 'discount'). */
  discountPct: number;

  commercial: CommercialTerms;
  value: ValueInputs;
  sdlc: SdlcInputs | null;
  notes: string;
}

/* ------------------------------------------------------------------------- */
/*  Results                                                                  */
/* ------------------------------------------------------------------------- */

export interface CostLine {
  key: string;
  label: string;
  pool: CostPool;
  monthly: number;
  /** Measured driver quantity (tokens, pages, calls…); null for fixed lines. */
  quantity: number | null;
  /** Unit of the quantity, e.g. "input tokens". */
  unit: string;
  /** Rate per `per` units of quantity, in the estimate currency. */
  rate: number | null;
  per: number;
  note: string;
}

export interface VolumeResult {
  submitted: number;
  unique: number;
  duplicates: number;
  executions: number;
  retries: number;
  accepted: number;
  failed: number;
  abuWeight: number;
  effortFactor: number;
  weightedAbus: number;
}

export interface TokenResult {
  inputUncached: number;
  inputCached: number;
  output: number;
  total: number;
  perSubmittedTxn: number;
}

export interface ImplementationResult {
  mode: 'simple' | 'detailed';
  activities: { id: string; label: string; role: string; hours: number; rate: number; cost: number; rackRate: number; rackFee: number }[];
  hours: number;
  deliveryCost: number;
  /** Target implementation margin input (%), used when pricing on margin. */
  marginPct: number;
  /** Basis actually applied (discount needs a rack fee, so simple mode prices on margin). */
  pricingBasis: PeoplePricing;
  /** Rack-rate fee (hours × rack rate) before discount; null in simple mode. */
  rackFee: number | null;
  /** Discount input (%). */
  discountPct: number;
  /** Discount the selling price represents against the rack fee (%); null without a rack fee. */
  effectiveDiscountPct: number | null;
  /** Gross margin the selling price earns (%). */
  actualMarginPct: number;
  /** Discount off rack rate that would deliver the target implementation margin (%). */
  discountAtTargetMargin: number | null;
  price: number;
}

export interface OperatingResult {
  lines: CostLine[];
  pools: Record<CostPool, number>;
  llm: { input: number; cached: number; output: number; total: number };
  total: number;
  annual: number;
  perSubmittedTxn: number | null;
  perAgent: number | null;
  agentOpsComponents: { id: string; label: string; designation: string; hours: number; costRate: number; rackRate: number; monthly: number; rackMonthly: number }[];
  agentOpsOverridden: boolean;
  /** AgentOps team at rack rates per month; null when the AgentOps cost is overridden. */
  agentOpsRackFee: number | null;
  failureAndRetryCost: number;
}

export interface AcuResult {
  method: AcuMethod;
  total: number;
  perTxn: number | null;
  perAgent: number | null;
  eligibleCost: number;
  referenceCostInCurrency: number;
  consumptionCostPerAcu: number | null;
  /** Fully loaded recoverable cost per ACU (standalone ACU model). */
  deliveryCostPerAcu: number | null;
  price: number | null;
  priceOverridden: boolean;
  monthlyRevenue: number;
  components: { key: string; label: string; quantity: number; weight: number; acus: number }[];
}

export interface AbuResult {
  weighted: number;
  costPerAbuFullyLoaded: number | null;
  recoverablePool: number;
  costPerAbuRecoverable: number | null;
  price: number | null;
  priceOverridden: boolean;
  monthlyRevenue: number;
  costPerAcceptedTxn: number | null;
  failureCostPerAbu: number | null;
}

export interface RevenueComponent {
  key: string;
  label: string;
  monthly: number;
  recovers: CostPool[];
  basis: string;
}

export interface YearRow {
  year: number;
  monthlyVolume: number;
  weightedAbus: number;
  implementationRevenue: number;
  recurringRevenue: number;
  revenue: number;
  implementationCost: number;
  runCost: number;
  cost: number;
  grossProfit: number;
  grossMargin: number | null;
  clientPassThrough: number;
}

export interface ModelResult {
  key: ModelKey;
  label: string;
  structureLabel: string;
  description: string;
  components: RevenueComponent[];
  /** Which component recovers each pool ('client' = pass-through, 'at-risk' = gainshare). */
  recovery: Record<CostPool, string[]>;
  doubleRecovery: boolean;
  unrecovered: CostPool[];
  implementationRevenue: number;
  implementationCost: number;
  mrr: number;
  monthlyDeliveryCost: number;
  monthlyGrossProfit: number;
  recurringMargin: number | null;
  annualRevenue: number;
  annualDeliveryCost: number;
  annualGrossProfit: number;
  annualGrossMargin: number | null;
  costPerAgent: number | null;
  costPerAbu: number | null;
  costPerAcu: number | null;
  clientPassThroughMonthly: number;
  clientMonthlyCost: number;
  projection: YearRow[];
  threeYear: { revenue: number; cost: number; grossProfit: number; grossMargin: number | null };
  tcv: number;
  notes: string[];
}

export interface Recommendation {
  key: string;
  label: string;
  model: ModelKey;
  agentOpsBilling: AgentOpsBilling;
  hybrid: HybridConfig | null;
  explanation: string;
  factors: { label: string; value: string }[];
  alternatives: string[];
}

export interface ValueResult {
  manualHours: number;
  aiAssistedHours: number;
  hoursSaved: number;
  productivityPct: number | null;
  redeployableFte: number;
  capacityValueMonthly: number;
  hardSavingsMonthly: number;
  costAvoidanceMonthly: number;
  revenueUpliftMonthly: number;
  financialBenefitMonthly: number;
  validatedBenefitMonthly: number;
  assumedBenefitMonthly: number;
  annualFinancialBenefit: number;
  annualValidatedBenefit: number;
  annualClientCharges: number;
  annualNetFinancialBenefit: number;
  year1Investment: number;
  roiYear1: number | null;
  threeYearBenefit: number;
  threeYearValidatedBenefit: number;
  threeYearInvestment: number;
  roi3: number | null;
  roi3Validated: number | null;
  paybackMonths: number | null;
  yearly: { year: number; benefit: number; validatedBenefit: number; investment: number; net: number; cumulativeNet: number }[];
}

export interface SdlcMetricResult {
  key: SdlcMetricKey;
  label: string;
  unit: string;
  higherIsBetter: boolean;
  baseline: number | null;
  projected: number | null;
  improvementPct: number;
  source: BaselineSource;
  claimed: boolean;
}

export interface SdlcResult {
  derivedVolume: number;
  driverLabel: string;
  storiesPerMonth: number;
  storyPointsPerMonth: number;
  costPerAcceptedTask: number | null;
  pricePerAcceptedTask: number | null;
  costPerRelease: number | null;
  pricePerRelease: number | null;
  metrics: SdlcMetricResult[];
}

export interface Issue {
  level: 'error' | 'warning' | 'info';
  field?: string;
  message: string;
}

export interface ReconCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface EstimateResults {
  currency: CurrencyCode;
  rateCardVersion: string;
  volume: VolumeResult;
  tokens: TokenResult;
  implementation: ImplementationResult;
  operating: OperatingResult;
  acu: AcuResult;
  abu: AbuResult;
  agentOpsBilling: AgentOpsBilling;
  agentOpsFee: number;
  /** How the AgentOps fee was set: rack rate less discount, cost plus margin, or a customer-specific override. */
  agentOpsFeeBasis: 'discount' | 'margin' | 'override';
  recommendation: Recommendation;
  models: Record<ModelKey, ModelResult>;
  selectedModel: ModelKey;
  selected: ModelResult;
  value: ValueResult;
  sdlc: SdlcResult | null;
  /** Baseline prices, used by the simulator to hold prices fixed. */
  prices: LockedPrices;
  issues: Issue[];
  checks: ReconCheck[];
}
