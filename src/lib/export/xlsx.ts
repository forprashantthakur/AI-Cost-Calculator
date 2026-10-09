import ExcelJS from 'exceljs';
import type { EstimateInputs, EstimateResults, ModelKey, RateCard } from '@/engine/types';
import { MODEL_KEYS } from '@/engine/types';
import { getProcess, industryName, functionName } from '@/data/catalog';
import { resolveInputs } from '@/engine';
import { sdlcDerivedVolume } from '@/engine/sdlc';

/**
 * Editable Excel pricing workbook.
 *
 * Every calculated figure is a live formula that mirrors the calculation
 * engine, driven by editable input cells (blue) and named ranges. The
 * Reconciliation sheet compares each key formula with the value the
 * calculator showed at export, so dashboard and workbook provably agree.
 */

type Fmt = 'money' | 'int' | 'num' | 'pct' | 'price' | 'text';
const FMT: Record<Fmt, string> = {
  money: '#,##0.00',
  int: '#,##0',
  num: '#,##0.####',
  pct: '0.00%',
  price: '#,##0.000000',
  text: '@',
};

const INK = 'FF1F2328';
const BRAND = 'FF1B6B45';
const INPUT_BLUE = 'FF0B4FB3';
const INPUT_FILL = 'FFF3F7FD';
const HEAD_FILL = 'FFEDF6F1';
const MUTED = 'FF5F6873';

interface Opts {
  /** Include engine values as cached formula results (for previewers that do not recalculate). */
  cacheResults?: boolean;
}

class SheetBuilder {
  ws: ExcelJS.Worksheet;
  row = 1;
  constructor(
    public wb: ExcelJS.Workbook,
    public name: string,
    widths: number[],
  ) {
    this.ws = wb.addWorksheet(name, { views: [{ showGridLines: false }] });
    widths.forEach((w, i) => (this.ws.getColumn(i + 1).width = w));
  }
  title(text: string, sub?: string) {
    const c = this.ws.getCell(this.row, 1);
    c.value = text;
    c.font = { bold: true, size: 14, color: { argb: INK } };
    this.row++;
    if (sub) {
      const s = this.ws.getCell(this.row, 1);
      s.value = sub;
      s.font = { size: 9, italic: true, color: { argb: MUTED } };
      this.row++;
    }
    this.row++;
  }
  section(text: string) {
    this.row++;
    const c = this.ws.getCell(this.row, 1);
    c.value = text;
    c.font = { bold: true, size: 11, color: { argb: BRAND } };
    for (let i = 1; i <= 4; i++) this.ws.getCell(this.row, i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } };
    this.row++;
  }
  private name_(name: string | undefined, col = 2) {
    if (!name) return;
    this.wb.definedNames.add(`${this.name}!$${String.fromCharCode(64 + col)}$${this.row}`, name);
  }
  /** Editable input (blue). `value` null leaves the cell empty (= automatic). */
  input(label: string, value: number | string | null, opts: { name?: string; fmt?: Fmt; unit?: string; list?: string[] } = {}) {
    this.ws.getCell(this.row, 1).value = label;
    const c = this.ws.getCell(this.row, 2);
    if (value !== null && value !== undefined) c.value = value;
    c.font = { color: { argb: INPUT_BLUE }, bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } };
    c.numFmt = FMT[opts.fmt ?? 'num'];
    if (opts.list) c.dataValidation = { type: 'list', allowBlank: true, formulae: [`"${opts.list.join(',')}"`] };
    if (opts.unit) {
      const u = this.ws.getCell(this.row, 3);
      u.value = opts.unit;
      u.font = { size: 9, color: { argb: MUTED } };
    }
    this.name_(opts.name);
    const addr = `${this.name}!$B$${this.row}`;
    this.row++;
    return addr;
  }
  /** Calculated cell (formula). */
  calc(label: string, formula: string, opts: { name?: string; fmt?: Fmt; unit?: string; result?: number | string | null; bold?: boolean; cache?: boolean } = {}) {
    const l = this.ws.getCell(this.row, 1);
    l.value = label;
    if (opts.bold) l.font = { bold: true };
    const c = this.ws.getCell(this.row, 2);
    c.value = opts.cache && opts.result != null ? { formula, result: opts.result } : { formula };
    c.numFmt = FMT[opts.fmt ?? 'num'];
    c.font = { bold: !!opts.bold, color: { argb: INK } };
    if (opts.unit) {
      const u = this.ws.getCell(this.row, 3);
      u.value = opts.unit;
      u.font = { size: 9, color: { argb: MUTED } };
    }
    this.name_(opts.name);
    const addr = `${this.name}!$B$${this.row}`;
    this.row++;
    return addr;
  }
  note(text: string) {
    const c = this.ws.getCell(this.row, 1);
    c.value = text;
    c.font = { size: 9, italic: true, color: { argb: MUTED } };
    this.row++;
  }
}

const header = (ws: ExcelJS.Worksheet, row: number, labels: string[]) => {
  labels.forEach((l, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = l;
    c.font = { bold: true, color: { argb: INK }, size: 10 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD_FILL } };
    c.alignment = { wrapText: true, vertical: 'middle' };
  });
};

const blank = (v: number | null | undefined) => (v == null ? null : v);
const f = (v: number) => (Number.isFinite(v) ? v : 0);

export function buildWorkbook(raw: EstimateInputs, res: EstimateResults, rc: RateCard, opts: Opts = {}): ExcelJS.Workbook {
  const cache = opts.cacheResults ?? true;
  const est = resolveInputs(raw);
  const proc = getProcess(est.processId);
  const model = rc.models.find((m) => m.id === est.modelId) ?? rc.models[0];
  const cur = est.currency;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Enterprise AI Agent Pricing & Value Calculator';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  /* ===================================================================== */
  /* README                                                                */
  /* ===================================================================== */
  const rd = new SheetBuilder(wb, 'README', [110]);
  rd.title('Enterprise AI Agent Pricing & Value Calculator — pricing workbook', 'From AI Agent Consumption to Business Outcomes and Commercial Value.');
  [
    `Estimate: ${est.name}${est.client ? ` — ${est.client}` : ''}`,
    `Process: ${est.customProcessName || proc.name} · ${functionName(est.functionId)} · ${industryName(est.industryId)}`,
    `Currency: ${cur} · Rate card: ${rc.version} (effective ${rc.effectiveDate}) · Exported ${new Date().toISOString().slice(0, 10)}`,
    '',
    'HOW TO USE',
    '• Blue cells on the Inputs and Rates sheets are editable assumptions. Every other figure is a live formula.',
    '• Leave an override cell empty to use the automatic (rate card) value.',
    '• The Reconciliation sheet compares each workbook formula with the value shown in the calculator at export.',
    '  "Reconciled" means the workbook and the calculator agree; "Changed" appears after you edit inputs.',
    '',
    'ASSUMPTIONS, ESTIMATES AND VALIDATED ACTUALS',
    '• Assumptions: every input on the Inputs and Rates sheets (illustrative unless replaced).',
    '• Estimates: every calculated figure (Costs, Pricing, Projection, Commercial, ROI).',
    '• Validated actuals: only benefit lines whose status is "validated" on the Inputs sheet, and SDLC baselines marked "measured".',
    '',
    'IMPORTANT',
    '• All default rates are illustrative placeholders, not vendor quotes. Replace them with contracted rates before client use.',
    '• Productivity (capacity) value is not cash. Only the cash-realisation share, cost avoidance and attributable revenue margin count as financial benefits.',
    '• The ACU is a commercial abstraction defined by this calculator; one token is not one ACU.',
  ].forEach((t) => {
    const c = rd.ws.getCell(rd.row++, 1);
    c.value = t;
    if (t === t.toUpperCase() && t.length > 3) c.font = { bold: true, color: { argb: BRAND } };
  });

  /* ===================================================================== */
  /* Inputs                                                                */
  /* ===================================================================== */
  const ip = new SheetBuilder(wb, 'Inputs', [46, 18, 40]);
  ip.title('Inputs — editable assumptions', `Blue cells are editable. Money in ${cur}. Percentages as %.`);
  const s = est.sdlc;
  if (!s) ip.section('Business volume and effort');
  const drv = proc.sdlcDriver;
  const derive = !!(s && raw.sdlc?.deriveVolume && drv);
  if (s) {
    ip.section('IT SDLC drivers');
    ip.input('Developers', s.developers, { name: 'SdlcDevelopers', fmt: 'int' });
    ip.input('Engineering teams', s.teams, { name: 'SdlcTeams', fmt: 'int' });
    ip.input('Sprints per month', s.sprintsPerMonth, { name: 'SdlcSprints' });
    ip.input('User stories per sprint (per team)', s.storiesPerSprint, { name: 'SdlcStoriesPerSprint' });
    ip.input('Average story points (context only — not billable)', s.avgStoryPoints, { name: 'SdlcStoryPoints' });
    ip.input('Pull requests / month', s.prsPerMonth, { name: 'SdlcPRs', fmt: 'int' });
    ip.input('Code reviews / month', s.codeReviewsPerMonth, { name: 'SdlcReviews', fmt: 'int' });
    ip.input('Test cases / month', s.testCasesPerMonth, { name: 'SdlcTestCases', fmt: 'int' });
    ip.input('Defects / month', s.defectsPerMonth, { name: 'SdlcDefects', fmt: 'int' });
    ip.input('Builds / month', s.buildsPerMonth, { name: 'SdlcBuilds', fmt: 'int' });
    ip.input('Deployments / month', s.deploymentsPerMonth, { name: 'SdlcDeployments', fmt: 'int' });
    ip.input('Support tickets / month', s.ticketsPerMonth, { name: 'SdlcTickets', fmt: 'int' });
    ip.section('Business volume and effort');
  }
  if (derive && s && drv) {
    const fieldName: Record<string, string> = {
      stories: 'SdlcTeams*SdlcSprints*SdlcStoriesPerSprint',
      prsPerMonth: 'SdlcPRs',
      codeReviewsPerMonth: 'SdlcReviews',
      testCasesPerMonth: 'SdlcTestCases',
      defectsPerMonth: 'SdlcDefects',
      buildsPerMonth: 'SdlcBuilds',
      deploymentsPerMonth: 'SdlcDeployments',
      ticketsPerMonth: 'SdlcTickets',
    };
    ip.calc(`Monthly volume — derived: ${drv.label}`, `ROUND(MAX(0,${fieldName[drv.field]})*${drv.factor}*100,0)/100`, {
      name: 'Volume',
      fmt: 'num',
      result: sdlcDerivedVolume(s, proc),
      cache,
    });
  } else {
    ip.input('Monthly transaction volume (submitted)', est.monthlyVolume, { name: 'Volume', fmt: 'num' });
  }
  ip.input('Number of AI agents', est.agents, { name: 'Agents', fmt: 'num' });
  ip.input('Expected AI completion / acceptance rate', est.successRate / 100, { name: 'SuccessRate', fmt: 'pct' });
  ip.input('Retry rate (extra executions)', est.retryRatePct / 100, { name: 'RetryRate', fmt: 'pct' });
  ip.input('Duplicate submission rate', est.duplicateRatePct / 100, { name: 'DupRate', fmt: 'pct' });
  ip.input('Current manual time per transaction', est.manualMinutes, { name: 'ManualMin', unit: 'minutes' });
  ip.input('AI-assisted manual time per transaction', est.aiAssistedMinutes, { name: 'AiMin', unit: 'minutes' });
  ip.input('Employee cost per hour', est.employeeCostPerHour, { name: 'LaborHr', fmt: 'money', unit: cur });
  ip.input('Annual volume growth', est.volumeGrowthPct / 100, { name: 'VolGrowth', fmt: 'pct' });

  ip.section('Complexity (ABU weights and effort multipliers are on Rates)');
  const mixSum = est.complexityMix.low + est.complexityMix.medium + est.complexityMix.high;
  const mix = est.useComplexityMix && mixSum > 0 ? est.complexityMix : { low: est.complexity === 'low' ? 100 : 0, medium: est.complexity === 'medium' ? 100 : 0, high: est.complexity === 'high' ? 100 : 0 };
  ip.input('Share of Low complexity', mix.low / 100, { name: 'MixLow', fmt: 'pct' });
  ip.input('Share of Medium complexity', mix.medium / 100, { name: 'MixMedium', fmt: 'pct' });
  ip.input('Share of High complexity', mix.high / 100, { name: 'MixHigh', fmt: 'pct' });

  ip.section('AI workload per transaction');
  ip.input('Model calls per transaction', est.callsPerTxn, { name: 'Calls' });
  ip.input('Input tokens per call', est.inputTokensPerCall, { name: 'InTok', fmt: 'int' });
  ip.input('Output tokens per call', est.outputTokensPerCall, { name: 'OutTok', fmt: 'int' });
  ip.input('Cached input tokens share', est.cachedInputPct / 100, { name: 'CachedPct', fmt: 'pct' });
  ip.input('OCR pages per transaction', est.ocrPagesPerTxn, { name: 'OcrPages' });
  ip.input('Vector searches per transaction', est.ragQueriesPerTxn, { name: 'RagQueries' });
  ip.input('Embedding tokens per transaction', est.embeddingTokensPerTxn, { name: 'EmbedTok', fmt: 'int' });
  ip.input('Tool / API calls per transaction', est.toolCallsPerTxn, { name: 'ToolCalls' });

  ip.section('Human review, platform and other monthly costs');
  ip.input('Human review rate', est.humanReviewRatePct / 100, { name: 'ReviewRate', fmt: 'pct' });
  ip.input('Review time per reviewed item', est.humanReviewMinutes, { name: 'ReviewMin', unit: 'minutes' });
  ip.input('Human review cost per hour', est.humanReviewCostPerHour, { name: 'ReviewCostHr', fmt: 'money', unit: cur });
  ip.input('Orchestration cost per run (override)', blank(est.orchestrationCostPerRunOverride), { name: 'OrchOverride', fmt: 'price', unit: 'empty = rate card' });
  ip.input('Infrastructure cost / month (override)', blank(est.infraOverride), { name: 'InfraOverride', fmt: 'money', unit: 'empty = rate card' });
  ip.input('Monitoring tooling / month (override)', blank(est.observabilityOverride), { name: 'ObsOverride', fmt: 'money', unit: 'empty = rate card' });
  ip.input('AgentOps cost / month (override)', blank(est.agentOpsOverride), { name: 'AgentOpsOverride', fmt: 'money', unit: 'empty = rate card' });
  ip.input('AI quality / evaluation cost / month', est.evalCostMonthly, { name: 'EvalCost', fmt: 'money' });
  ip.input('CI/CD and dev environment cost / month', s ? s.cicdMonthlyCost : 0, { name: 'CicdCost', fmt: 'money' });
  ip.input('Other attributable cost / month', est.otherMonthly, { name: 'OtherCost', fmt: 'money' });

  ip.section('Implementation');
  ip.input('Implementation mode', est.implMode, { name: 'ImplMode', fmt: 'text', list: ['simple', 'detailed'] });
  ip.input('Implementation delivery cost (simple mode)', est.implSimpleCost, { name: 'ImplSimpleCost', fmt: 'money' });
  ip.input('Target implementation margin', est.implMarginPct / 100, { name: 'ImplMargin', fmt: 'pct' });

  ip.section('Pricing and commercial terms');
  ip.input('Target provider gross margin', est.targetMargin / 100, { name: 'Margin', fmt: 'pct' });
  ip.input('AgentOps billing', res.agentOpsBilling, { name: 'AgentOpsBilling', fmt: 'text', list: ['bundled', 'separate'] });
  ip.input('Selected commercial model', res.selectedModel, { name: 'SelectedModel', fmt: 'text', list: [...MODEL_KEYS] });
  ip.input('Contract duration', est.commercial.contractYears, { name: 'ContractYears', fmt: 'int', unit: 'years' });
  ip.input('Annual price escalation', est.commercial.escalationPct / 100, { name: 'Escalation', fmt: 'pct' });
  ip.input('Minimum monthly commitment', est.commercial.minMonthlyCommitment, { name: 'MinCommit', fmt: 'money' });
  ip.input('Subscription units', est.commercial.subscriptionUnits, { name: 'SubUnits', unit: est.commercial.subscriptionUnit });
  ip.input('Subscription price per unit (override)', blank(est.commercial.subscriptionPriceOverride), { name: 'SubOverride', fmt: 'money', unit: 'empty = recommended' });
  ip.input('Included ABUs per month (override)', blank(est.commercial.includedAbusOverride), { name: 'IncludedOverride', fmt: 'num', unit: 'empty = baseline ABUs' });
  ip.input('Overage premium over ABU price', est.commercial.overagePremiumPct / 100, { name: 'OveragePremium', fmt: 'pct' });
  ip.input('ABU price (customer-specific override)', blank(est.commercial.abuPriceOverride), { name: 'AbuOverride', fmt: 'price', unit: 'empty = recommended' });
  ip.input('ACU price (customer-specific override)', blank(est.commercial.acuPriceOverride), { name: 'AcuOverride', fmt: 'price', unit: 'empty = recommended' });
  ip.input('AgentOps fee / month (override)', blank(est.commercial.agentOpsFeeOverride), { name: 'AOFeeOverride', fmt: 'money', unit: 'empty = recommended' });
  ip.input('Gainshare percentage', est.commercial.gainsharePct / 100, { name: 'GainsharePct', fmt: 'pct' });
  const h = est.commercial.hybrid ?? res.recommendation.hybrid ?? { subscription: true, usage: 'abu', agentOps: false, gainshare: false };
  ip.input('Hybrid: platform subscription (1 = yes)', h.subscription ? 1 : 0, { name: 'HybSub', fmt: 'int', list: ['0', '1'] });
  ip.input('Hybrid: usage component', h.usage, { name: 'HybUsage', fmt: 'text', list: ['abu', 'acu', 'none'] });
  ip.input('Hybrid: separate AgentOps fee (1 = yes)', h.agentOps ? 1 : 0, { name: 'HybAO', fmt: 'int', list: ['0', '1'] });
  ip.input('Hybrid: gainshare upside (1 = yes)', h.gainshare ? 1 : 0, { name: 'HybGS', fmt: 'int', list: ['0', '1'] });

  ip.section('Client financial benefits (status: assumed or validated)');
  ip.input('Cash realisation of capacity value', est.value.cashRealisationPct / 100, { name: 'CashPct', fmt: 'pct' });
  ip.input('  status', est.value.cashRealisationStatus, { name: 'CashStatus', fmt: 'text', list: ['assumed', 'validated'] });
  ip.input('Cost avoidance (annual)', est.value.costAvoidanceAnnual, { name: 'AvoidAnnual', fmt: 'money' });
  ip.input('  status', est.value.costAvoidanceStatus, { name: 'AvoidStatus', fmt: 'text', list: ['assumed', 'validated'] });
  ip.input('Revenue uplift — attributable margin (annual)', est.value.revenueUpliftAnnual, { name: 'UpliftAnnual', fmt: 'money' });
  ip.input('  status', est.value.revenueUpliftStatus, { name: 'UpliftStatus', fmt: 'text', list: ['assumed', 'validated'] });

  /* ===================================================================== */
  /* Rates                                                                 */
  /* ===================================================================== */
  const rt = new SheetBuilder(wb, 'Rates', [46, 18, 44]);
  rt.title(`Rates — ${rc.version}`, `${rc.source}. Vendor rates in USD; converted at the FX rate below.`);
  rt.section('Currency and delivery cost');
  rt.input(`FX rate (${cur} per 1 USD)`, rc.fx[cur] ?? 1, { name: 'FxRate', fmt: 'num', unit: `${rc.fxSource} (${rc.fxEffectiveDate})` });
  rt.input(`Delivery cost index (${cur})`, rc.deliveryCostIndex?.[cur] ?? 1, { name: 'DeliveryIdx', fmt: 'num', unit: 'Scales implementation roles and AgentOps' });
  rt.section(`LLM model — ${model.provider} · ${model.name}`);
  rt.input('Input tokens (USD per 1M)', model.inputPer1M, { name: 'ModelIn', fmt: 'money', unit: `${model.source} (${model.effectiveDate})` });
  rt.input('Cached input tokens (USD per 1M)', model.cachedInputPer1M, { name: 'ModelCached', fmt: 'money' });
  rt.input('Output tokens (USD per 1M)', model.outputPer1M, { name: 'ModelOut', fmt: 'money' });
  rt.section('Unit rates (USD)');
  rt.input('OCR per page', rc.ocrPerPage, { name: 'OcrRate', fmt: 'price' });
  rt.input('Embeddings per 1M tokens', rc.embeddingPer1M, { name: 'EmbedRate', fmt: 'price' });
  rt.input('Vector search per 1K queries', rc.vectorQueryPer1K, { name: 'VectorRate', fmt: 'price' });
  rt.input('Orchestration per agent run', rc.orchestrationPerRun, { name: 'OrchRate', fmt: 'price' });
  rt.input('Tool / API call', rc.toolCallCost, { name: 'ToolRate', fmt: 'price' });
  rt.input('Infrastructure base per month', rc.infraBasePerMonth, { name: 'InfraBase', fmt: 'money' });
  rt.input('Infrastructure per agent per month', rc.infraPerAgentPerMonth, { name: 'InfraPerAgent', fmt: 'money' });
  rt.input('Monitoring tooling per agent per month', rc.observabilityPerAgentPerMonth, { name: 'ObsPerAgent', fmt: 'money' });
  rt.input(`Hosting multiplier (${est.hosting})`, rc.hostingMultipliers[est.hosting] ?? 1, { name: 'HostingMult' });
  rt.input(`SLA multiplier (${est.sla})`, rc.slaMultipliers[est.sla] ?? 1, { name: 'SlaMult' });

  rt.section('AgentOps components (USD per month, before SLA and delivery index)');
  header(rt.ws, rt.row, ['Component', 'Base / month', 'Per agent / month']);
  rt.row++;
  const aoStart = rt.row;
  for (const c of rc.agentOps) {
    rt.ws.getCell(rt.row, 1).value = c.label;
    for (const [col, v] of [
      [2, c.basePerMonth],
      [3, c.perAgentPerMonth],
    ] as const) {
      const cell = rt.ws.getCell(rt.row, col);
      cell.value = v;
      cell.font = { color: { argb: INPUT_BLUE }, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } };
      cell.numFmt = FMT.money;
    }
    rt.row++;
  }
  const aoEnd = rt.row - 1;
  wb.definedNames.add(`Rates!$B$${aoStart}:$B$${aoEnd}`, 'AOBase');
  wb.definedNames.add(`Rates!$C$${aoStart}:$C$${aoEnd}`, 'AOPerAgent');

  rt.section('Complexity: ABU weights and resource effort multipliers');
  rt.input('ABU weight — Low', rc.abuWeights.low, { name: 'WeightLow' });
  rt.input('ABU weight — Medium', rc.abuWeights.medium, { name: 'WeightMedium' });
  rt.input('ABU weight — High', rc.abuWeights.high, { name: 'WeightHigh' });
  rt.input('Effort multiplier — Low', rc.effortMultipliers.low, { name: 'EffortLow' });
  rt.input('Effort multiplier — Medium', rc.effortMultipliers.medium, { name: 'EffortMedium' });
  rt.input('Effort multiplier — High', rc.effortMultipliers.high, { name: 'EffortHigh' });

  rt.section(`ACU methodology (${rc.acu.version}, effective ${rc.acu.effectiveDate})`);
  rt.input('ACU method', rc.acu.method, { name: 'AcuMethod', fmt: 'text', list: ['cost', 'weighted'] });
  rt.calc(`Reference cost per ACU in ${cur} (${rc.acu.referenceCost} ${rc.acu.referenceCurrency})`, `${rc.acu.referenceCost}/${rc.fx[rc.acu.referenceCurrency] ?? 1}*FxRate`, {
    name: 'AcuRefCost',
    fmt: 'price',
    result: res.acu.referenceCostInCurrency,
    cache,
  });
  const w = rc.acu.weights;
  rt.input('Weight: uncached input tokens per 1K', w.inputTokensPer1K, { name: 'AcuWIn' });
  rt.input('Weight: cached input tokens per 1K', w.cachedTokensPer1K, { name: 'AcuWCached' });
  rt.input('Weight: output tokens per 1K', w.outputTokensPer1K, { name: 'AcuWOut' });
  rt.input('Weight: OCR page', w.ocrPage, { name: 'AcuWOcr' });
  rt.input('Weight: tool call', w.toolCall, { name: 'AcuWTool' });
  rt.input('Weight: agent run', w.orchestrationRun, { name: 'AcuWRun' });
  rt.input('Weight: vector query', w.vectorQuery, { name: 'AcuWVector' });
  rt.input('Weight: embedding tokens per 1K', w.embeddingTokensPer1K, { name: 'AcuWEmbed' });

  rt.section('Volume discount tiers (graduated; lower bound = previous upper bound)');
  header(rt.ws, rt.row, ['Tier', 'Lower (units)', 'Upper (units)', 'Discount']);
  rt.row++;
  const tiers = [...est.commercial.volumeTiers.filter((t) => t.upTo === null || t.upTo > 0)].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
  const norm: { upTo: number; disc: number }[] = tiers.length ? tiers.map((t) => ({ upTo: t.upTo ?? 1e15, disc: Math.min(100, Math.max(0, t.discountPct)) / 100 })) : [{ upTo: 1e15, disc: 0 }];
  if (norm[norm.length - 1].upTo !== 1e15) norm.push({ upTo: 1e15, disc: norm[norm.length - 1].disc });
  const tStart = rt.row;
  norm.forEach((t, i) => {
    rt.ws.getCell(rt.row, 1).value = `Tier ${i + 1}`;
    rt.ws.getCell(rt.row, 2).value = i === 0 ? 0 : { formula: `C${rt.row - 1}` };
    const up = rt.ws.getCell(rt.row, 3);
    up.value = t.upTo;
    const dc = rt.ws.getCell(rt.row, 4);
    dc.value = t.disc;
    for (const c of [up, dc]) {
      c.font = { color: { argb: INPUT_BLUE }, bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } };
    }
    up.numFmt = '#,##0';
    dc.numFmt = FMT.pct;
    rt.row++;
  });
  const tEnd = rt.row - 1;
  wb.definedNames.add(`Rates!$B$${tStart}:$B$${tEnd}`, 'TierLower');
  wb.definedNames.add(`Rates!$C$${tStart}:$C$${tEnd}`, 'TierUpper');
  wb.definedNames.add(`Rates!$D$${tStart}:$D$${tEnd}`, 'TierDisc');
  rt.note('Upper bound 1E+15 = no upper limit.');

  /* ===================================================================== */
  /* Costs                                                                 */
  /* ===================================================================== */
  const op = res.operating;
  const L = (k: string) => op.lines.find((l) => l.key === k)?.monthly ?? 0;
  const cs = new SheetBuilder(wb, 'Costs', [46, 20, 40]);
  cs.title('Costs — volume funnel, monthly operating cost and implementation', `Money in ${cur}. All figures are formulas driven by Inputs and Rates.`);
  cs.section('Volume funnel');
  cs.calc('Submitted transactions / month', 'MAX(0,Volume)', { name: 'VolumeC', fmt: 'num', result: res.volume.submitted, cache });
  cs.calc('Unique transactions (duplicates removed)', 'VolumeC*(1-MAX(0,MIN(1,DupRate)))', { name: 'UniqueTx', fmt: 'num', result: res.volume.unique, cache });
  cs.calc('Executions (incl. retries and failed attempts)', 'VolumeC*(1+MAX(0,RetryRate))', { name: 'Executions', fmt: 'num', result: res.volume.executions, cache });
  cs.calc('Accepted transactions (counted once)', 'UniqueTx*MAX(0,MIN(1,SuccessRate))', { name: 'Accepted', fmt: 'num', result: res.volume.accepted, cache });
  cs.calc('Not accepted (fall back to manual)', 'UniqueTx-Accepted', { name: 'FailedTx', fmt: 'num', result: res.volume.failed, cache });
  cs.calc('Blended ABU weight', 'IF(MixLow+MixMedium+MixHigh=0,WeightMedium,(MixLow*WeightLow+MixMedium*WeightMedium+MixHigh*WeightHigh)/(MixLow+MixMedium+MixHigh))', {
    name: 'AbuWeight',
    fmt: 'num',
    result: res.volume.abuWeight,
    cache,
  });
  cs.calc('Blended effort multiplier', 'IF(MixLow+MixMedium+MixHigh=0,EffortMedium,(MixLow*EffortLow+MixMedium*EffortMedium+MixHigh*EffortHigh)/(MixLow+MixMedium+MixHigh))', {
    name: 'Effort',
    fmt: 'num',
    result: res.volume.effortFactor,
    cache,
  });
  cs.calc('Accepted weighted ABUs / month', 'Accepted*AbuWeight', { name: 'WeightedAbus', fmt: 'num', result: res.volume.weightedAbus, cache, bold: true });

  cs.section('Measured consumption / month');
  cs.calc('Input tokens', 'Executions*Calls*InTok*Effort', { name: 'InputTokens', fmt: 'int', cache });
  cs.calc('of which cached (billed once at cached rate)', 'InputTokens*MAX(0,MIN(1,CachedPct))', { name: 'CachedTokens', fmt: 'int', result: res.tokens.inputCached, cache });
  cs.calc('of which uncached', 'InputTokens-CachedTokens', { name: 'UncachedTokens', fmt: 'int', result: res.tokens.inputUncached, cache });
  cs.calc('Output tokens', 'Executions*Calls*OutTok*Effort', { name: 'OutputTokens', fmt: 'int', result: res.tokens.output, cache });
  cs.calc('Embedding tokens', 'Executions*EmbedTok*Effort', { name: 'EmbedTokens', fmt: 'int', cache });
  cs.calc('Vector queries', 'Executions*RagQueries*Effort', { name: 'VectorQueries', fmt: 'num', cache });
  cs.calc('OCR pages (once per submitted document)', 'VolumeC*OcrPages*Effort', { name: 'OcrPagesM', fmt: 'num', cache });
  cs.calc('Tool / API calls', 'Executions*ToolCalls*Effort', { name: 'ToolCallsM', fmt: 'num', cache });
  cs.calc('Agent runs', 'Executions', { name: 'AgentRuns', fmt: 'num', cache });
  cs.calc('Human review hours', 'UniqueTx*MAX(0,MIN(1,ReviewRate))*ReviewMin/60', { name: 'ReviewHours', fmt: 'num', cache });

  cs.section(`Monthly operating cost (${cur})`);
  cs.calc('LLM input tokens', 'UncachedTokens/1000000*ModelIn*FxRate', { name: 'CostLlmIn', fmt: 'money', result: L('llm-input'), cache });
  cs.calc('LLM cached input tokens', 'CachedTokens/1000000*ModelCached*FxRate', { name: 'CostLlmCached', fmt: 'money', result: L('llm-cached'), cache });
  cs.calc('LLM output tokens', 'OutputTokens/1000000*ModelOut*FxRate', { name: 'CostLlmOut', fmt: 'money', result: L('llm-output'), cache });
  cs.calc('OCR and document extraction', 'OcrPagesM*OcrRate*FxRate', { name: 'CostOcr', fmt: 'money', result: L('ocr'), cache });
  cs.calc('Embeddings', 'EmbedTokens/1000000*EmbedRate*FxRate', { name: 'CostEmbed', fmt: 'money', result: L('embeddings'), cache });
  cs.calc('Vector search', 'VectorQueries/1000*VectorRate*FxRate', { name: 'CostVector', fmt: 'money', result: L('vector'), cache });
  cs.calc('Agent orchestration', 'AgentRuns*IF(OrchOverride="",OrchRate*FxRate,OrchOverride)', { name: 'CostOrch', fmt: 'money', result: L('orchestration'), cache });
  cs.calc('Tool / API execution', 'ToolCallsM*ToolRate*FxRate', { name: 'CostTools', fmt: 'money', result: L('tools'), cache });
  cs.calc('AI consumption subtotal', 'CostLlmIn+CostLlmCached+CostLlmOut+CostOcr+CostEmbed+CostVector+CostOrch+CostTools', {
    name: 'PoolConsumption',
    fmt: 'money',
    result: op.pools.consumption,
    cache,
    bold: true,
  });
  cs.calc('Cloud infrastructure', 'IF(InfraOverride="",(InfraBase+InfraPerAgent*MAX(0,Agents))*FxRate*HostingMult,InfraOverride)', { name: 'CostInfra', fmt: 'money', result: L('infra'), cache });
  cs.calc('Monitoring & observability tooling', 'IF(ObsOverride="",ObsPerAgent*MAX(0,Agents)*FxRate,ObsOverride)', { name: 'CostObs', fmt: 'money', result: L('observability'), cache });
  cs.calc('AI quality / evaluation runs', 'MAX(0,EvalCost)', { name: 'CostEval', fmt: 'money', result: L('evaluation'), cache });
  cs.calc('CI/CD and development environments', 'MAX(0,CicdCost)', { name: 'CostCicd', fmt: 'money', result: L('cicd'), cache });
  cs.calc('Infrastructure & platform subtotal', 'CostInfra+CostObs+CostEval+CostCicd', { name: 'PoolPlatform', fmt: 'money', result: op.pools.platform, cache, bold: true });
  cs.calc('AgentOps (rate card)', '(SUM(AOBase)+SUM(AOPerAgent)*MAX(0,Agents))*SlaMult*FxRate*DeliveryIdx', { name: 'AgentOpsAuto', fmt: 'money', cache });
  cs.calc('AgentOps services', 'IF(AgentOpsOverride="",AgentOpsAuto,MAX(0,AgentOpsOverride))', { name: 'PoolAgentOps', fmt: 'money', result: op.pools.agentops, cache, bold: true });
  cs.calc('Human-in-the-loop review', 'ReviewHours*ReviewCostHr', { name: 'CostReview', fmt: 'money', result: L('human-review'), cache });
  cs.calc('Other attributable costs', 'MAX(0,OtherCost)', { name: 'CostOther', fmt: 'money', result: L('other'), cache });
  cs.calc('Human review & other subtotal', 'CostReview+CostOther', { name: 'PoolService', fmt: 'money', result: op.pools.service, cache, bold: true });
  cs.calc('TOTAL MONTHLY DELIVERY COST', 'PoolConsumption+PoolPlatform+PoolAgentOps+PoolService', { name: 'TotalCost', fmt: 'money', result: op.total, cache, bold: true });
  cs.calc('Annual delivery cost', 'TotalCost*12', { fmt: 'money', result: op.annual, cache });

  cs.section('One-time implementation');
  header(cs.ws, cs.row, ['Activity', 'Hours', 'Rate / hour', 'Cost']);
  cs.row++;
  const iStart = cs.row;
  for (const a of est.implActivities) {
    const role = rc.implRoles.find((r) => r.id === a.roleId);
    cs.ws.getCell(cs.row, 1).value = `${a.label} (${role?.label ?? a.roleId})`;
    const hc = cs.ws.getCell(cs.row, 2);
    hc.value = a.hours;
    hc.font = { color: { argb: INPUT_BLUE }, bold: true };
    hc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_FILL } };
    const rc_ = cs.ws.getCell(cs.row, 3);
    rc_.value = { formula: `${role?.ratePerHour ?? 0}*FxRate*DeliveryIdx` };
    rc_.numFmt = FMT.money;
    const cc = cs.ws.getCell(cs.row, 4);
    cc.value = { formula: `MAX(0,B${cs.row})*C${cs.row}` };
    cc.numFmt = FMT.money;
    cs.row++;
  }
  const iEnd = Math.max(iStart, cs.row - 1);
  cs.note('Role rate = rate card USD rate × FX × delivery cost index.');
  cs.calc('Implementation delivery cost', `IF(ImplMode="simple",MAX(0,ImplSimpleCost),SUM(D${iStart}:D${iEnd}))`, { name: 'ImplCost', fmt: 'money', result: res.implementation.deliveryCost, cache, bold: true });
  cs.calc('Implementation selling price', 'ImplCost/(1-MAX(0,MIN(0.95,ImplMargin)))', { name: 'ImplPrice', fmt: 'money', result: res.implementation.price, cache, bold: true });

  /* ===================================================================== */
  /* Pricing (ACU / ABU / price book)                                      */
  /* ===================================================================== */
  const pr = new SheetBuilder(wb, 'Pricing', [52, 20, 44]);
  pr.title('Pricing — ACU and ABU engines and the price book', 'Every price is set once at baseline volume: price = recovered cost ÷ (1 − target margin).');
  pr.section('ACU — AI Consumption Unit');
  pr.calc('Eligible AI consumption cost', 'PoolConsumption', { name: 'AcuEligible', fmt: 'money', result: res.acu.eligibleCost, cache });
  pr.calc(
    'Total ACUs / month',
    'IF(AcuMethod="cost",IF(AcuRefCost>0,AcuEligible/AcuRefCost,0),UncachedTokens/1000*AcuWIn+CachedTokens/1000*AcuWCached+OutputTokens/1000*AcuWOut+OcrPagesM*AcuWOcr+ToolCallsM*AcuWTool+AgentRuns*AcuWRun+VectorQueries*AcuWVector+EmbedTokens/1000*AcuWEmbed)',
    { name: 'Acus', fmt: 'num', result: res.acu.total, cache, bold: true },
  );
  pr.calc('ACUs per transaction', 'IFERROR(Acus/VolumeC,0)', { fmt: 'num', cache });
  pr.calc('ACUs per agent', 'IFERROR(Acus/Agents,0)', { fmt: 'num', cache });
  pr.section('ABU — AI Business Unit');
  pr.calc('Accepted weighted ABUs', 'WeightedAbus', { fmt: 'num', result: res.abu.weighted, cache });
  pr.calc('Cost per successful ABU (fully loaded)', 'IFERROR(TotalCost/WeightedAbus,0)', { fmt: 'price', result: res.abu.costPerAbuFullyLoaded, cache, bold: true });

  pr.section('Price book');
  pr.calc('Margin used (capped at 95%)', 'MAX(0,MIN(0.95,Margin))', { name: 'MarginC', fmt: 'pct', cache });
  pr.calc('Cost recovered by standalone unit prices', 'TotalCost-IF(AgentOpsBilling="separate",PoolAgentOps,0)', { name: 'UnitPool', fmt: 'money', result: res.abu.recoverablePool, cache });
  pr.calc('ABU price', 'IF(AbuOverride="",IFERROR(UnitPool/WeightedAbus/(1-MarginC),0),AbuOverride)', { name: 'AbuPrice', fmt: 'price', result: res.abu.price, cache, bold: true });
  pr.calc('ACU price', 'IF(AcuOverride="",IFERROR(UnitPool/Acus/(1-MarginC),0),AcuOverride)', { name: 'AcuPrice', fmt: 'price', result: res.acu.price, cache, bold: true });
  pr.calc('Managed AgentOps fee / month', 'IF(AOFeeOverride="",PoolAgentOps/(1-MarginC),AOFeeOverride)', { name: 'AOFee', fmt: 'money', result: res.agentOpsFee, cache, bold: true });
  pr.calc('Fixed monthly run fee', 'TotalCost/(1-MarginC)', { name: 'FixedFee', fmt: 'money', result: res.prices.fixedFee, cache });
  pr.calc('Subscription price per unit', 'IF(SubOverride="",IF(SubUnits>0,UnitPool/(1-MarginC)/SubUnits,0),SubOverride)', { name: 'SubPrice', fmt: 'money', result: res.prices.subscriptionUnitPrice, cache });
  pr.calc('Included ABUs per month', 'IF(IncludedOverride="",WeightedAbus,MAX(0,IncludedOverride))', { name: 'Included', fmt: 'num', result: res.prices.includedAbus, cache });
  pr.calc('Overage price per ABU', 'AbuPrice*(1+OveragePremium)', { name: 'OveragePrice', fmt: 'price', result: res.prices.overagePrice, cache });
  pr.section('Hybrid price book — each cost pool is recovered by exactly one component');
  pr.calc('Subscription component active', 'IF(AND(HybSub=0,HybUsage="none"),1,HybSub)', { name: 'HybSubEff', fmt: 'int', cache });
  pr.calc(
    'Cost recovered by platform subscription',
    'IF(HybSubEff=1,PoolPlatform,0)+IF(HybUsage="none",PoolConsumption+PoolService,0)+IF(AND(HybAO=0,HybSubEff=1),PoolAgentOps,0)',
    { name: 'HybSubPool', fmt: 'money', cache },
  );
  pr.calc(
    'Cost recovered by usage component',
    'IF(HybUsage<>"none",PoolConsumption+PoolService+IF(HybSubEff=0,PoolPlatform,0)+IF(AND(HybAO=0,HybSubEff=0),PoolAgentOps,0),0)',
    { name: 'HybUsePool', fmt: 'money', cache },
  );
  pr.calc('Cost recovered by AgentOps fee', 'IF(HybAO=1,PoolAgentOps,0)', { name: 'HybAOPool', fmt: 'money', cache });
  pr.calc('Check: pools recovered once (should equal total cost)', 'HybSubPool+HybUsePool+HybAOPool', { fmt: 'money', result: op.total, cache });
  pr.calc('Hybrid subscription price per unit', 'IF(SubOverride="",IF(SubUnits>0,HybSubPool/(1-MarginC)/SubUnits,0),SubOverride)', { name: 'HybSubPrice', fmt: 'money', result: res.prices.hybridSubUnitPrice, cache });
  pr.calc('Hybrid usage units', 'IF(HybUsage="acu",Acus,WeightedAbus)', { name: 'HybUnits', fmt: 'num', cache });
  pr.calc(
    'Hybrid usage price per unit',
    'IF(AND(HybUsage="abu",AbuOverride<>""),AbuOverride,IF(AND(HybUsage="acu",AcuOverride<>""),AcuOverride,IFERROR(HybUsePool/HybUnits/(1-MarginC),0)))',
    { name: 'HybUsagePrice', fmt: 'price', result: res.prices.hybridUsagePrice, cache },
  );

  /* ===================================================================== */
  /* Projection                                                            */
  /* ===================================================================== */
  const years = Math.max(3, Math.min(10, Math.round(est.commercial.contractYears || 3)));
  const pj = wb.addWorksheet('Projection', { views: [{ showGridLines: false, state: 'frozen', ySplit: 4 }] });
  [10, 12, 14, 14, 14, 16, 16, 16, 16].forEach((wd, i) => (pj.getColumn(i + 1).width = wd));
  pj.getCell('A1').value = 'Projection — volume growth and price escalation by year';
  pj.getCell('A1').font = { bold: true, size: 14 };
  pj.getCell('A2').value = 'Variable costs, ABUs, ACUs and hard savings scale with volume; platform, AgentOps and other fixed costs do not.';
  pj.getCell('A2').font = { size: 9, italic: true, color: { argb: MUTED } };
  const yHead = ['Year', 'Growth factor', 'Escalation factor', 'Monthly volume', 'Weighted ABUs', 'ACUs', 'Hybrid usage units', 'Monthly delivery cost', 'Financial benefit / mo', 'Validated benefit / mo'];
  header(pj, 4, yHead);
  const yRow = (y: number) => 4 + y;
  for (let y = 1; y <= years; y++) {
    const r = yRow(y);
    const set = (col: number, formula: string, fmt: Fmt) => {
      const c = pj.getCell(r, col);
      c.value = { formula };
      c.numFmt = FMT[fmt];
    };
    pj.getCell(r, 1).value = y;
    set(2, `(1+VolGrowth)^(A${r}-1)`, 'num');
    set(3, `(1+Escalation)^(A${r}-1)`, 'num');
    set(4, `VolumeC*B${r}`, 'num');
    set(5, `WeightedAbus*B${r}`, 'num');
    set(6, `Acus*B${r}`, 'num');
    set(7, `HybUnits*B${r}`, 'num');
    set(8, `PoolConsumption*B${r}+CostReview*B${r}+CostOther+PoolPlatform+PoolAgentOps`, 'money');
    set(9, `HardSavings*B${r}+AvoidMonthly+UpliftMonthly`, 'money');
    set(10, `IF(CashStatus="validated",HardSavings*B${r},0)+IF(AvoidStatus="validated",AvoidMonthly,0)+IF(UpliftStatus="validated",UpliftMonthly,0)`, 'money');
  }
  [12, 12, 12, 12, 12, 12, 12, 14, 16, 16].forEach((wd, i) => (pj.getColumn(i + 1).width = Math.max(pj.getColumn(i + 1).width ?? 0, wd)));
  const yLast = yRow(years);
  wb.definedNames.add(`Projection!$A$5:$A$${yLast}`, 'YrYear');

  // Graduated tiers: band = MAX(0, MIN(units, upper) − lower), written with
  // boolean masks so it works element-wise inside SUMPRODUCT without
  // precision loss (no ±1E+15 arithmetic on the units).
  const tier = (units: string, price: string) => {
    const m = `((${units})-((${units})-TierUpper)*((${units})>TierUpper))`;
    return `${price}*SUMPRODUCT(((${m}-TierLower)*((${m}-TierLower)>0))*(1-TierDisc))`;
  };

  const mStart = yLast + 3;
  pj.getCell(mStart - 1, 1).value = 'Revenue and cost by commercial model and year';
  pj.getCell(mStart - 1, 1).font = { bold: true, size: 11, color: { argb: BRAND } };
  const mHead = ['Model', 'Year', 'Monthly revenue', 'Monthly provider cost', 'Client pass-through / mo', 'Recurring revenue (yr)', 'Implementation revenue', 'Total revenue (yr)', 'Total cost (yr)', 'Gross profit (yr)', 'Gross margin'];
  header(pj, mStart, mHead);
  [14, 8, 16, 16, 16, 18, 18, 18, 18, 18, 12].forEach((wd, i) => (pj.getColumn(i + 1).width = Math.max(pj.getColumn(i + 1).width ?? 0, wd)));
  let r = mStart + 1;
  const sepAO = 'IF(AgentOpsBilling="separate",AOFee*$C,0)';
  for (const k of MODEL_KEYS) {
    for (let y = 1; y <= years; y++) {
      const yr = yRow(y);
      const G = `Projection!$B$${yr}`;
      const E = `Projection!$C$${yr}`;
      const ABU = `Projection!$E$${yr}`;
      const ACU = `Projection!$F$${yr}`;
      const HU = `Projection!$G$${yr}`;
      const TC = `Projection!$H$${yr}`;
      const BEN = `Projection!$I$${yr}`;
      const ao = sepAO.replace('$C', E);
      let rev = '';
      switch (k) {
        case 'fixed':
          rev = `FixedFee*${E}`;
          break;
        case 'acu':
          rev = `MAX(${tier(ACU, `AcuPrice*${E}`)},MinCommit*${E})+${ao}`;
          break;
        case 'abu':
          rev = `MAX(${tier(ABU, `AbuPrice*${E}`)},MinCommit*${E})+${ao}`;
          break;
        case 'subscription':
          rev = `SubPrice*SubUnits*${E}+MAX(0,${ABU}-Included)*OveragePrice*${E}+${ao}`;
          break;
        case 'agentops':
          rev = `AOFee*${E}`;
          break;
        case 'gainshare':
          rev = `GainsharePct*${BEN}`;
          break;
        case 'hybrid':
          rev = `IF(HybSubEff=1,HybSubPrice*SubUnits*${E},0)+IF(HybUsage<>"none",MAX(${tier(HU, `HybUsagePrice*${E}`)},MinCommit*${E}),0)+IF(HybAO=1,AOFee*${E},0)+IF(HybGS=1,GainsharePct*${BEN},0)`;
          break;
      }
      const cost = k === 'agentops' ? 'PoolAgentOps' : TC;
      const pass = k === 'agentops' ? `${TC}-PoolAgentOps` : '0';
      const vals: [number, string | number, Fmt][] = [
        [1, k, 'text'],
        [2, y, 'int'],
      ];
      vals.forEach(([col, v]) => (pj.getCell(r, col).value = v));
      const fset = (col: number, formula: string, fmt: Fmt) => {
        const c = pj.getCell(r, col);
        c.value = { formula };
        c.numFmt = FMT[fmt];
      };
      fset(3, rev, 'money');
      fset(4, cost, 'money');
      fset(5, pass, 'money');
      fset(6, `C${r}*12`, 'money');
      fset(7, y === 1 ? 'ImplPrice' : '0', 'money');
      fset(8, `F${r}+G${r}`, 'money');
      fset(9, `D${r}*12+${y === 1 ? 'ImplCost' : '0'}`, 'money');
      fset(10, `H${r}-I${r}`, 'money');
      fset(11, `IFERROR(J${r}/H${r},0)`, 'pct');
      r++;
    }
  }
  const mEnd = r - 1;
  wb.definedNames.add(`Projection!$A$${mStart + 1}:$A$${mEnd}`, 'PjModel');
  wb.definedNames.add(`Projection!$B$${mStart + 1}:$B$${mEnd}`, 'PjYear');
  wb.definedNames.add(`Projection!$C$${mStart + 1}:$C$${mEnd}`, 'PjMonthlyRev');
  wb.definedNames.add(`Projection!$D$${mStart + 1}:$D$${mEnd}`, 'PjMonthlyCost');
  wb.definedNames.add(`Projection!$E$${mStart + 1}:$E$${mEnd}`, 'PjPass');
  wb.definedNames.add(`Projection!$H$${mStart + 1}:$H$${mEnd}`, 'PjRevenue');
  wb.definedNames.add(`Projection!$I$${mStart + 1}:$I$${mEnd}`, 'PjCost');

  /* ===================================================================== */
  /* Commercial comparison                                                 */
  /* ===================================================================== */
  const cm = wb.addWorksheet('Commercial', { views: [{ showGridLines: false }] });
  cm.getColumn(1).width = 38;
  MODEL_KEYS.forEach((_, i) => (cm.getColumn(i + 2).width = 16));
  cm.getCell('A1').value = 'Commercial model comparison (year 1 unless stated)';
  cm.getCell('A1').font = { bold: true, size: 14 };
  header(cm, 3, ['Metric', ...MODEL_KEYS.map((k) => res.models[k].label)]);
  const keyRow = cm.getRow(4);
  keyRow.getCell(1).value = 'Model key';
  MODEL_KEYS.forEach((k, i) => (keyRow.getCell(i + 2).value = k));
  const metrics: [string, (col: string) => string, Fmt][] = [
    ['Implementation revenue', () => 'ImplPrice', 'money'],
    ['Monthly recurring revenue', (c) => `SUMIFS(PjMonthlyRev,PjModel,${c}$4,PjYear,1)`, 'money'],
    ['Monthly delivery cost (provider)', (c) => `SUMIFS(PjMonthlyCost,PjModel,${c}$4,PjYear,1)`, 'money'],
    ['Monthly gross profit', (c) => `${c}6-${c}7`, 'money'],
    ['Recurring gross margin', (c) => `IFERROR(${c}8/${c}6,0)`, 'pct'],
    ['Annual revenue (incl. implementation)', (c) => `${c}5+12*${c}6`, 'money'],
    ['Annual delivery cost (incl. implementation)', (c) => `ImplCost+12*${c}7`, 'money'],
    ['Annual gross profit', (c) => `${c}10-${c}11`, 'money'],
    ['Annual gross margin', (c) => `IFERROR(${c}12/${c}10,0)`, 'pct'],
    ['Cost per agent / month', (c) => `IFERROR(${c}7/Agents,0)`, 'money'],
    ['Cost per ABU', (c) => `IFERROR(${c}7/WeightedAbus,0)`, 'price'],
    ['Cost per ACU', (c) => `IFERROR(${c}7/Acus,0)`, 'price'],
    ['Client pass-through / month', (c) => `SUMIFS(PjPass,PjModel,${c}$4,PjYear,1)`, 'money'],
    ['3-year revenue', (c) => `SUMIFS(PjRevenue,PjModel,${c}$4,PjYear,"<=3")`, 'money'],
    ['3-year cost', (c) => `SUMIFS(PjCost,PjModel,${c}$4,PjYear,"<=3")`, 'money'],
    ['3-year gross profit', (c) => `${c}18-${c}19`, 'money'],
    ['Total contract value', (c) => `SUMIFS(PjRevenue,PjModel,${c}$4,PjYear,"<="&ContractYears)`, 'money'],
  ];
  metrics.forEach(([label, fn, fmt], i) => {
    const row = 5 + i;
    cm.getCell(row, 1).value = label;
    MODEL_KEYS.forEach((_, j) => {
      const col = String.fromCharCode(66 + j);
      const c = cm.getCell(row, j + 2);
      c.value = { formula: fn(col) };
      c.numFmt = FMT[fmt];
    });
  });
  cm.getCell(5 + metrics.length + 1, 1).value = `Recommended: ${res.recommendation.label} — ${res.recommendation.explanation}`;
  cm.getCell(5 + metrics.length + 1, 1).font = { italic: true, size: 9, color: { argb: MUTED } };

  /* ===================================================================== */
  /* ROI                                                                   */
  /* ===================================================================== */
  const v = res.value;
  const ro = new SheetBuilder(wb, 'ROI', [52, 20, 46]);
  ro.title('Client ROI and value realisation', 'Productivity (capacity) value is not cash. Financial benefits = hard savings + cost avoidance + attributable revenue margin.');
  ro.section('Productivity');
  ro.calc('Current manual effort (hours / month)', 'UniqueTx*MAX(0,ManualMin)/60', { name: 'ManualHours', fmt: 'num', result: v.manualHours, cache });
  ro.calc('AI-assisted manual effort (hours / month)', '(Accepted*MAX(0,AiMin)+FailedTx*MAX(0,ManualMin))/60', { name: 'AiHours', fmt: 'num', result: v.aiAssistedHours, cache });
  ro.calc('Hours saved / month', 'ManualHours-AiHours', { name: 'HoursSaved', fmt: 'num', result: v.hoursSaved, cache, bold: true });
  ro.calc('Productivity improvement', 'IFERROR(HoursSaved/ManualHours,0)', { fmt: 'pct', cache });
  ro.calc(`Redeployable capacity (FTE at ${rc.fteHoursPerMonth} h/month)`, `HoursSaved/${rc.fteHoursPerMonth || 160}`, { fmt: 'num', result: v.redeployableFte, cache });
  ro.calc('Capacity value / month (NOT cash)', 'HoursSaved*LaborHr', { name: 'CapacityValue', fmt: 'money', result: v.capacityValueMonthly, cache });
  ro.section('Financial benefits / month');
  ro.calc('Verified hard savings', 'MAX(0,CapacityValue)*MAX(0,MIN(1,CashPct))', { name: 'HardSavings', fmt: 'money', result: v.hardSavingsMonthly, cache });
  ro.calc('Cost avoidance', 'MAX(0,AvoidAnnual)/12', { name: 'AvoidMonthly', fmt: 'money', result: v.costAvoidanceMonthly, cache });
  ro.calc('Revenue uplift (attributable margin)', 'MAX(0,UpliftAnnual)/12', { name: 'UpliftMonthly', fmt: 'money', result: v.revenueUpliftMonthly, cache });
  ro.calc('Financial benefit / month', 'HardSavings+AvoidMonthly+UpliftMonthly', { name: 'BenefitMonthly', fmt: 'money', result: v.financialBenefitMonthly, cache, bold: true });
  ro.calc('of which validated actuals', 'Projection!$J$5', { fmt: 'money', result: v.validatedBenefitMonthly, cache });
  ro.section(`Investment and ROI — selected model: ${res.selected.label}`);
  ro.calc('Monthly client charge, year 1 (incl. pass-through)', 'SUMIFS(PjMonthlyRev,PjModel,SelectedModel,PjYear,1)+SUMIFS(PjPass,PjModel,SelectedModel,PjYear,1)', { name: 'ChargeYearOne', fmt: 'money', cache });
  ro.calc('Year-1 investment (implementation + 12 × charge)', 'ImplPrice+12*ChargeYearOne', { name: 'InvestYearOne', fmt: 'money', result: v.year1Investment, cache });
  ro.calc('Annual financial benefit (year 1)', '12*BenefitMonthly', { fmt: 'money', result: v.annualFinancialBenefit, cache });
  ro.calc('Annual net financial benefit (benefit − recurring charges)', '12*(BenefitMonthly-ChargeYearOne)', { fmt: 'money', result: v.annualNetFinancialBenefit, cache });
  ro.calc('ROI — year 1', 'IFERROR((12*BenefitMonthly-InvestYearOne)/InvestYearOne,0)', { name: 'RoiYearOne', fmt: 'pct', result: v.roiYear1 != null ? v.roiYear1 / 100 : null, cache, bold: true });
  ro.calc('3-year financial benefit', '12*SUMIFS(Projection!$I$5:$I$7,Projection!$A$5:$A$7,"<=3")', { name: 'BenefitThreeYear', fmt: 'money', result: v.threeYearBenefit, cache });
  ro.calc('3-year validated benefit', '12*SUMIFS(Projection!$J$5:$J$7,Projection!$A$5:$A$7,"<=3")', { name: 'ValidatedThreeYear', fmt: 'money', result: v.threeYearValidatedBenefit, cache });
  ro.calc(
    '3-year investment',
    'ImplPrice+12*(SUMIFS(PjMonthlyRev,PjModel,SelectedModel,PjYear,"<=3")+SUMIFS(PjPass,PjModel,SelectedModel,PjYear,"<=3"))',
    { name: 'InvestThreeYear', fmt: 'money', result: v.threeYearInvestment, cache },
  );
  ro.calc('ROI — 3 years (business case)', 'IFERROR((BenefitThreeYear-InvestThreeYear)/InvestThreeYear,0)', { name: 'RoiThreeYear', fmt: 'pct', result: v.roi3 != null ? v.roi3 / 100 : null, cache, bold: true });
  ro.calc('ROI — 3 years (validated benefits only)', 'IFERROR((ValidatedThreeYear-InvestThreeYear)/InvestThreeYear,0)', { name: 'RoiThreeYearValidated', fmt: 'pct', result: v.roi3Validated != null ? v.roi3Validated / 100 : null, cache });
  ro.calc('Payback (months)', 'IF(BenefitMonthly-ChargeYearOne>0,ImplPrice/(BenefitMonthly-ChargeYearOne),"No payback")', { name: 'Payback', fmt: 'num', result: v.paybackMonths ?? 'No payback', cache, bold: true });

  /* ===================================================================== */
  /* Reconciliation                                                        */
  /* ===================================================================== */
  const rcS = wb.addWorksheet('Reconciliation', { views: [{ showGridLines: false }] });
  [48, 20, 20, 16, 16].forEach((wd, i) => (rcS.getColumn(i + 1).width = wd));
  rcS.getCell('A1').value = 'Reconciliation — workbook formulas versus calculator values at export';
  rcS.getCell('A1').font = { bold: true, size: 14 };
  rcS.getCell('A2').value = 'Status "Reconciled" = the live formula equals the value shown in the calculator dashboard. "Changed" appears after inputs are edited.';
  rcS.getCell('A2').font = { size: 9, italic: true, color: { argb: MUTED } };
  header(rcS, 4, ['Metric', 'Workbook (live formula)', 'Calculator at export', 'Difference', 'Status']);
  const col = (k: ModelKey) => String.fromCharCode(66 + MODEL_KEYS.indexOf(k));
  const checks: [string, string, number | null, Fmt][] = [
    ['Monthly delivery cost', 'TotalCost', op.total, 'money'],
    ['AI consumption', 'PoolConsumption', op.pools.consumption, 'money'],
    ['Infrastructure & platform', 'PoolPlatform', op.pools.platform, 'money'],
    ['AgentOps', 'PoolAgentOps', op.pools.agentops, 'money'],
    ['Human review & other', 'PoolService', op.pools.service, 'money'],
    ['Accepted weighted ABUs', 'WeightedAbus', res.volume.weightedAbus, 'num'],
    ['Total ACUs', 'Acus', res.acu.total, 'num'],
    ['Cost per successful ABU', 'IFERROR(TotalCost/WeightedAbus,0)', res.abu.costPerAbuFullyLoaded ?? 0, 'price'],
    ['ABU price', 'AbuPrice', res.abu.price ?? 0, 'price'],
    ['ACU price', 'AcuPrice', res.acu.price ?? 0, 'price'],
    ['AgentOps fee', 'AOFee', res.agentOpsFee, 'money'],
    ['Implementation delivery cost', 'ImplCost', res.implementation.deliveryCost, 'money'],
    ['Implementation price', 'ImplPrice', res.implementation.price, 'money'],
    ...MODEL_KEYS.flatMap((k) => {
      const m = res.models[k];
      return [
        [`${m.label}: monthly recurring revenue`, `Commercial!${col(k)}6`, m.mrr, 'money'],
        [`${m.label}: monthly delivery cost`, `Commercial!${col(k)}7`, m.monthlyDeliveryCost, 'money'],
        [`${m.label}: annual revenue`, `Commercial!${col(k)}10`, m.annualRevenue, 'money'],
        [`${m.label}: 3-year revenue`, `Commercial!${col(k)}18`, m.threeYear.revenue, 'money'],
        [`${m.label}: total contract value`, `Commercial!${col(k)}21`, m.tcv, 'money'],
      ] as [string, string, number, Fmt][];
    }),
    ['Hours saved / month', 'HoursSaved', v.hoursSaved, 'num'],
    ['Financial benefit / month', 'BenefitMonthly', v.financialBenefitMonthly, 'money'],
    ['Year-1 investment', 'InvestYearOne', v.year1Investment, 'money'],
    ['ROI — year 1', 'RoiYearOne', v.roiYear1 != null ? v.roiYear1 / 100 : 0, 'pct'],
    ['ROI — 3 years', 'RoiThreeYear', v.roi3 != null ? v.roi3 / 100 : 0, 'pct'],
    ['ROI — 3 years (validated only)', 'RoiThreeYearValidated', v.roi3Validated != null ? v.roi3Validated / 100 : 0, 'pct'],
    ['Payback (months)', 'IF(ISNUMBER(Payback),Payback,0)', v.paybackMonths ?? 0, 'num'],
  ];
  checks.forEach(([label, formula, value, fmt], i) => {
    const row = 5 + i;
    rcS.getCell(row, 1).value = label;
    const a = rcS.getCell(row, 2);
    a.value = cache && value != null ? { formula, result: value } : { formula };
    a.numFmt = FMT[fmt];
    const b = rcS.getCell(row, 3);
    b.value = f(value ?? 0);
    b.numFmt = FMT[fmt];
    const d = rcS.getCell(row, 4);
    d.value = cache ? { formula: `B${row}-C${row}`, result: 0 } : { formula: `B${row}-C${row}` };
    d.numFmt = fmt === 'pct' ? '0.0000%' : '#,##0.000000';
    const st = rcS.getCell(row, 5);
    st.value = cache
      ? { formula: `IF(ABS(D${row})<=0.000001*MAX(1,ABS(C${row})),"Reconciled","Changed")`, result: 'Reconciled' }
      : { formula: `IF(ABS(D${row})<=0.000001*MAX(1,ABS(C${row})),"Reconciled","Changed")` };
  });
  const last = 5 + checks.length;
  rcS.getCell(last + 1, 1).value = 'All metrics reconciled';
  rcS.getCell(last + 1, 1).font = { bold: true };
  rcS.getCell(last + 1, 2).value = cache
    ? { formula: `IF(COUNTIF(E5:E${last - 1},"Reconciled")=${checks.length},"YES","NO")`, result: 'YES' }
    : { formula: `IF(COUNTIF(E5:E${last - 1},"Reconciled")=${checks.length},"YES","NO")` };
  rcS.getCell(last + 1, 2).font = { bold: true, color: { argb: BRAND } };

  // Put the Reconciliation sheet second so it is easy to find.
  return wb;
}

export const RECON_SHEET = 'Reconciliation';

export async function workbookBuffer(est: EstimateInputs, res: EstimateResults, rc: RateCard, opts: Opts = {}): Promise<ArrayBuffer> {
  const wb = buildWorkbook(est, res, rc, opts);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
