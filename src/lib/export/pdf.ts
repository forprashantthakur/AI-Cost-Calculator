import { jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import type { CurrencyCode, EstimateInputs, EstimateResults, ModelKey, RateCard } from '@/engine/types';
import { MODEL_KEYS, COST_POOLS } from '@/engine/types';
import { getProcess, industryName, functionName } from '@/data/catalog';
import { currencyMeta } from '@/lib/format';

import { REPORTS, type ReportKind } from './reports';
export { REPORTS, type ReportKind };

const BRAND: [number, number, number] = [27, 107, 69];
const INK: [number, number, number] = [31, 35, 40];
const MUTED: [number, number, number] = [95, 104, 115];
const LINE: [number, number, number] = [227, 230, 234];
const LIGHT: [number, number, number] = [237, 246, 241];

/** Standard PDF fonts are WinAnsi: replace symbols they cannot render. */
const clean = (s: string) =>
  s
    .replace(/₹/g, 'INR ')
    .replace(/−/g, '-')
    .replace(/→/g, '->')
    .replace(/≈/g, '~')
    .replace(/×/g, 'x')
    .replace(/…/g, '...')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x00-\xFF—–•·]/g, '');

const symbolFor = (c: CurrencyCode) => (['USD', 'AUD', 'SGD', 'CAD'].includes(c) ? currencyMeta(c).symbol : `${c} `);

function m(v: number | null | undefined, c: CurrencyCode, dp?: number) {
  if (v == null || !Number.isFinite(v)) return '-';
  const abs = Math.abs(v);
  const digits = dp ?? (abs >= 1000 ? 0 : abs >= 1 ? 2 : abs === 0 ? 0 : 4);
  return `${v < 0 ? '-' : ''}${symbolFor(c)}${abs.toLocaleString(currencyMeta(c).locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
const up = (v: number | null | undefined, c: CurrencyCode) => (v == null ? '-' : m(v, c, Math.abs(v) >= 1 ? 2 : Math.abs(v) >= 0.01 ? 4 : 6));
const nf = (v: number | null | undefined, dp = 0) => (v == null || !Number.isFinite(v) ? '-' : v.toLocaleString('en-US', { maximumFractionDigits: dp }));
const pf = (v: number | null | undefined, dp = 1) => (v == null || !Number.isFinite(v) ? '-' : `${v.toLocaleString('en-US', { maximumFractionDigits: dp })}%`);

class Report {
  doc: jsPDF;
  y = 0;
  readonly W: number;
  readonly H: number;
  readonly M = 40;
  constructor(
    public title: string,
    public est: EstimateInputs,
    public res: EstimateResults,
    public rc: RateCard,
  ) {
    this.doc = new jsPDF({ unit: 'pt', format: 'a4' });
    this.W = this.doc.internal.pageSize.getWidth();
    this.H = this.doc.internal.pageSize.getHeight();
    this.cover();
  }
  get cur() {
    return this.res.currency;
  }
  text(s: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: [number, number, number]; align?: 'left' | 'right' | 'center'; maxWidth?: number } = {}) {
    this.doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
    this.doc.setFontSize(o.size ?? 10);
    this.doc.setTextColor(...(o.color ?? INK));
    this.doc.text(clean(s), x, y, { align: o.align ?? 'left', maxWidth: o.maxWidth });
  }
  para(s: string, o: { size?: number; color?: [number, number, number]; bold?: boolean } = {}) {
    const size = o.size ?? 9.5;
    this.doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    const lines = this.doc.splitTextToSize(clean(s), this.W - 2 * this.M) as string[];
    this.ensure(lines.length * size * 1.35 + 4);
    this.doc.setTextColor(...(o.color ?? INK));
    this.doc.text(lines, this.M, this.y);
    this.y += lines.length * size * 1.35 + 4;
  }
  ensure(h: number) {
    if (this.y + h > this.H - 50) {
      this.doc.addPage();
      this.y = 50;
    }
  }
  cover() {
    const d = this.doc;
    const proc = getProcess(this.est.processId);
    d.setFillColor(...BRAND);
    d.rect(0, 0, this.W, 6, 'F');
    this.text('Enterprise AI Agent Pricing & Value Calculator', this.M, 34, { size: 9, color: BRAND, bold: true });
    this.text(this.title, this.M, 60, { size: 20, bold: true });
    this.text(`${this.est.name}${this.est.client ? ` — ${this.est.client}` : ''}`, this.M, 80, { size: 11 });
    this.text(`${this.est.customProcessName || proc.name} · ${functionName(this.est.functionId)} · ${industryName(this.est.industryId)}`, this.M, 96, { size: 9, color: MUTED });
    this.text(
      `Currency ${this.cur} · Rate card ${this.rc.version} (effective ${this.rc.effectiveDate}) · Prepared ${new Date().toISOString().slice(0, 10)} · Status: ${this.est.status === 'final' ? 'Final' : 'Draft'}`,
      this.M,
      110,
      { size: 8, color: MUTED },
    );
    d.setFillColor(253, 246, 231);
    d.roundedRect(this.W - this.M - 150, 26, 150, 22, 4, 4, 'F');
    this.text('ILLUSTRATIVE ESTIMATE', this.W - this.M - 75, 40, { size: 8, bold: true, color: [161, 92, 7], align: 'center' });
    d.setDrawColor(...LINE);
    d.line(this.M, 122, this.W - this.M, 122);
    this.y = 142;
  }
  h(s: string, tag?: 'ASSUMPTIONS' | 'ESTIMATES' | 'VALIDATED ACTUALS') {
    this.ensure(40);
    this.y += 6;
    this.text(s, this.M, this.y, { size: 12.5, bold: true });
    if (tag) {
      const w = this.doc.getTextWidth(clean(s));
      const colors: Record<string, [number, number, number]> = { ASSUMPTIONS: [47, 94, 142], ESTIMATES: BRAND, 'VALIDATED ACTUALS': [18, 77, 49] };
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'bold');
      const tw = this.doc.getTextWidth(tag) + 10;
      this.doc.setFillColor(...(colors[tag] ?? BRAND));
      this.doc.roundedRect(this.M + w + 14, this.y - 9, tw, 12, 3, 3, 'F');
      this.doc.setTextColor(255, 255, 255);
      this.doc.text(tag, this.M + w + 19, this.y - 0.5);
    }
    this.y += 14;
  }
  kpis(items: { label: string; value: string; sub?: string }[], cols = 3) {
    const gap = 8;
    const w = (this.W - 2 * this.M - gap * (cols - 1)) / cols;
    const hgt = 52;
    for (let i = 0; i < items.length; i++) {
      const col = i % cols;
      if (col === 0) this.ensure(hgt + gap);
      const x = this.M + col * (w + gap);
      const y = this.y;
      this.doc.setDrawColor(...LINE);
      this.doc.setFillColor(255, 255, 255);
      this.doc.roundedRect(x, y, w, hgt, 5, 5, 'FD');
      this.text(items[i].label.toUpperCase(), x + 10, y + 15, { size: 7, color: MUTED, bold: true });
      this.text(items[i].value, x + 10, y + 33, { size: 13, bold: true, color: INK });
      if (items[i].sub) this.text(items[i].sub!, x + 10, y + 45, { size: 7, color: MUTED });
      if (col === cols - 1 || i === items.length - 1) this.y += hgt + gap;
    }
    this.y += 4;
  }
  table(head: string[], body: RowInput[], opts: { right?: number[]; widths?: Record<number, number>; foot?: RowInput[]; fontSize?: number } = {}) {
    const right = new Set(opts.right ?? head.map((_, i) => i).filter((i) => i > 0));
    autoTable(this.doc, {
      startY: this.y,
      margin: { left: this.M, right: this.M },
      head: [head.map(clean)],
      body: body.map((r) => (r as unknown[]).map((c) => (typeof c === 'string' ? clean(c) : c))) as RowInput[],
      foot: opts.foot?.map((r) => (r as unknown[]).map((c) => (typeof c === 'string' ? clean(c) : c))) as RowInput[] | undefined,
      theme: 'plain',
      styles: { fontSize: opts.fontSize ?? 8.5, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.5 } },
      headStyles: { fillColor: LIGHT, textColor: INK, fontStyle: 'bold', fontSize: 7.5 },
      footStyles: { fillColor: [247, 248, 249], textColor: INK, fontStyle: 'bold' },
      columnStyles: Object.fromEntries(head.map((_, i) => [i, { halign: right.has(i) ? 'right' : 'left', ...(opts.widths?.[i] ? { cellWidth: opts.widths[i] } : {}) }])),
      didDrawPage: () => undefined,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.y = (this.doc as any).lastAutoTable.finalY + 14;
  }
  bars(rows: { label: string; value: number; color?: [number, number, number] }[], fmt: (v: number) => string) {
    const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
    const labelW = 170;
    const barW = this.W - 2 * this.M - labelW - 80;
    for (const r of rows) {
      this.ensure(16);
      this.text(r.label, this.M, this.y + 8, { size: 8, color: MUTED });
      this.doc.setFillColor(...(r.color ?? BRAND));
      this.doc.rect(this.M + labelW, this.y, Math.max(1, (Math.abs(r.value) / max) * barW), 10, 'F');
      this.text(fmt(r.value), this.M + labelW + barW + 76, this.y + 8, { size: 8, align: 'right' });
      this.y += 15;
    }
    this.y += 6;
  }
  finish() {
    const pages = this.doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      this.doc.setPage(i);
      this.doc.setDrawColor(...LINE);
      this.doc.line(this.M, this.H - 34, this.W - this.M, this.H - 34);
      this.text(
        'Illustrative estimate. Rates are placeholders unless replaced with contracted rates. Assumptions, estimates and validated actuals are labelled separately.',
        this.M,
        this.H - 22,
        { size: 6.5, color: MUTED },
      );
      this.text(`Page ${i} of ${pages}`, this.W - this.M, this.H - 22, { size: 7, color: MUTED, align: 'right' });
    }
    return this.doc;
  }
}

/* ------------------------------------------------------------------------- */
/*  Sections                                                                 */
/* ------------------------------------------------------------------------- */

function headline(r: Report) {
  const { res, cur } = r;
  const sel = res.selected;
  r.kpis([
    { label: 'Implementation price', value: m(res.implementation.price, cur), sub: `Delivery cost ${m(res.implementation.deliveryCost, cur)}` },
    { label: 'Monthly operating cost', value: m(res.operating.total, cur), sub: `${m(res.operating.annual, cur)} per year` },
    { label: 'Cost per successful ABU', value: up(res.abu.costPerAbuFullyLoaded, cur), sub: 'Fully loaded incl. failures & retries' },
    { label: 'Recommended ABU / ACU price', value: `${up(res.abu.price, cur)} / ${up(res.acu.price, cur)}`, sub: res.agentOpsBilling === 'separate' ? 'AgentOps billed separately' : 'AgentOps bundled' },
    { label: 'Estimated monthly customer charge', value: m(sel.mrr, cur), sub: `${sel.label}: ${sel.structureLabel}` },
    { label: 'Provider gross margin', value: pf(sel.recurringMargin), sub: `Year-1 incl. implementation: ${pf(sel.annualGrossMargin)}` },
  ]);
}

function recommendation(r: Report) {
  const rec = r.res.recommendation;
  r.h('Recommended commercial structure', 'ESTIMATES');
  r.para(rec.label, { bold: true, size: 11 });
  r.para(rec.explanation);
  r.para(`Factors — ${rec.factors.map((f) => `${f.label}: ${f.value}`).join(' · ')}. Alternatives: ${rec.alternatives.join(', ')}. Recommendations are starting points, not mandatory pricing rules.`, { size: 8, color: MUTED });
}

function assumptions(r: Report, full = false) {
  const e = r.est;
  const cur = r.cur;
  const model = r.rc.models.find((x) => x.id === e.modelId);
  r.h('Key assumptions', 'ASSUMPTIONS');
  const rows: RowInput[] = [
    ['Monthly volume (submitted)', nf(r.res.volume.submitted, 1), 'AI completion / acceptance rate', pf(e.successRate)],
    ['AI agents', nf(e.agents), 'Process complexity', e.useComplexityMix ? `Mix L${e.complexityMix.low}/M${e.complexityMix.medium}/H${e.complexityMix.high}` : e.complexity],
    ['Manual time per transaction', `${nf(e.manualMinutes, 1)} min`, 'AI-assisted time per transaction', `${nf(e.aiAssistedMinutes, 1)} min`],
    ['Employee cost per hour', m(e.employeeCostPerHour, cur), 'Target gross margin', pf(e.targetMargin)],
    ['ABU definition', e.abuUnit, 'Annual volume growth', pf(e.volumeGrowthPct)],
  ];
  if (full)
    rows.push(
      ['LLM model', `${model?.name ?? e.modelId}${model?.illustrative ? ' (illustrative)' : ''}`, 'Calls / input / output tokens', `${nf(e.callsPerTxn)} / ${nf(e.inputTokensPerCall)} / ${nf(e.outputTokensPerCall)}`],
      ['Cached input share', pf(e.cachedInputPct), 'OCR pages / tool calls per txn', `${nf(e.ocrPagesPerTxn, 1)} / ${nf(e.toolCallsPerTxn, 1)}`],
      ['Retry / duplicate rate', `${pf(e.retryRatePct)} / ${pf(e.duplicateRatePct)}`, 'Human review rate / minutes', `${pf(e.humanReviewRatePct)} / ${nf(e.humanReviewMinutes, 1)}`],
      ['Hosting / SLA', `${e.hosting} / ${e.sla}`, 'Contract / escalation', `${e.commercial.contractYears} yrs / ${pf(e.commercial.escalationPct)}`],
    );
  r.table(['Assumption', 'Value', 'Assumption', 'Value'], rows, { right: [1, 3] });
  r.para(`Acceptance criteria: ${e.acceptanceCriteria}`, { size: 8, color: MUTED });
}

function costs(r: Report, full: boolean) {
  const { res, cur } = r;
  const op = res.operating;
  r.h('One-time implementation', 'ESTIMATES');
  if (full && res.implementation.mode === 'detailed') {
    r.table(
      ['Activity', 'Role', 'Hours', 'Rate / hour', 'Cost'],
      res.implementation.activities.map((a) => [a.label, a.role, nf(a.hours), m(a.rate, cur), m(a.cost, cur)]),
      { right: [2, 3, 4], foot: [['Total', '', nf(res.implementation.hours), '', m(res.implementation.deliveryCost, cur)]] },
    );
  }
  r.table(
    ['Implementation', 'Amount'],
    [
      ['Delivery cost' + (res.implementation.mode === 'simple' ? ' (simple estimate)' : ' (effort x rate)'), m(res.implementation.deliveryCost, cur)],
      ['Target implementation margin', pf(res.implementation.marginPct)],
      ['Implementation selling price', m(res.implementation.price, cur)],
    ],
  );
  r.h('Monthly AI operating cost', 'ESTIMATES');
  const poolLabel: Record<string, string> = { consumption: 'AI consumption', platform: 'Infrastructure & platform', agentops: 'AgentOps', service: 'Human review & other' };
  if (full) {
    r.table(
      ['Cost line', 'Pool', 'Monthly driver', 'Unit rate', 'Monthly cost'],
      op.lines.map((l) => [
        l.label,
        poolLabel[l.pool],
        l.quantity != null ? `${nf(l.quantity)} ${l.unit}` : '-',
        l.rate != null ? `${up(l.rate, cur)}${l.per === 1e6 ? ' /1M' : l.per === 1000 ? ' /1K' : ''}` : 'fixed',
        m(l.monthly, cur),
      ]),
      { right: [2, 3, 4], foot: [['Total monthly delivery cost', '', '', '', m(op.total, cur)]], fontSize: 8 },
    );
  }
  r.bars(
    COST_POOLS.map((p, i) => ({ label: poolLabel[p], value: op.pools[p], color: [BRAND, [111, 174, 139], [61, 68, 77], [199, 162, 82]][i] as [number, number, number] })),
    (v) => m(v, cur),
  );
  r.para(
    `Total ${m(op.total, cur)} per month (${m(op.annual, cur)} per year). Failure and retry cost of ${m(op.failureAndRetryCost, cur)} is included and allocated to accepted ABUs. Cached tokens are billed once at the cached rate; OCR is charged once per document.`,
    { size: 8.5, color: MUTED },
  );
  if (full) {
    r.h('AgentOps', 'ESTIMATES');
    r.table(
      ['Component', 'Monthly cost'],
      op.agentOpsComponents.map((c) => [c.label, m(c.monthly, cur)]),
      { foot: [[op.agentOpsOverridden ? 'Total (manual override)' : 'Total', m(op.pools.agentops, cur)]] },
    );
    r.para(
      res.agentOpsBilling === 'separate'
        ? `AgentOps is billed as a separate fee of ${m(res.agentOpsFee, cur)} per month and excluded from ABU and ACU prices, so it is recovered once.`
        : 'AgentOps is bundled into ABU and ACU prices; no separate fee is charged.',
      { size: 8.5 },
    );
  }
}

function units(r: Report, full: boolean) {
  const { res, cur, rc } = r;
  r.h('ABU and ACU unit economics', 'ESTIMATES');
  r.table(
    ['Metric', 'ABU (business outcome)', 'ACU (AI consumption)'],
    [
      ['Units per month', nf(res.abu.weighted), nf(res.acu.total)],
      ['Units per transaction', nf(res.volume.abuWeight * (res.volume.accepted / (res.volume.submitted || 1)), 3), nf(res.acu.perTxn, 3)],
      ['Fully loaded cost per unit', up(res.abu.costPerAbuFullyLoaded, cur), up(res.acu.deliveryCostPerAcu, cur)],
      ['Cost recovered by unit price', up(res.abu.costPerAbuRecoverable, cur), up(res.acu.deliveryCostPerAcu, cur)],
      ['Recommended price per unit', up(res.abu.price, cur) + (res.abu.priceOverridden ? ' (override)' : ''), up(res.acu.price, cur) + (res.acu.priceOverridden ? ' (override)' : '')],
      ['Monthly revenue (standalone model)', m(res.abu.monthlyRevenue, cur), m(res.acu.monthlyRevenue, cur)],
    ],
  );
  r.para(
    `ABU = ${r.est.abuUnit}; weights Low ${rc.abuWeights.low} / Medium ${rc.abuWeights.medium} / High ${rc.abuWeights.high}. ACU method: ${res.acu.method === 'cost' ? `cost-normalised (${rc.acu.referenceCost} ${rc.acu.referenceCurrency} of eligible consumption = 1 ACU)` : 'weighted resources'}, ${rc.acu.version}. One token is not one ACU.`,
    { size: 8, color: MUTED },
  );
  if (full) {
    r.table(
      ['ACU component', 'Quantity', 'ACU factor', 'ACUs'],
      res.acu.components.map((c) => [c.label, c.key === 'eligible' ? m(c.quantity, cur) : nf(c.quantity), nf(c.weight, 6), nf(c.acus)]),
    );
    r.table(
      ['Volume funnel', 'Per month'],
      [
        ['Submitted transactions', nf(res.volume.submitted, 1)],
        ['Unique (duplicates removed)', nf(res.volume.unique, 1)],
        ['Executions incl. retries', nf(res.volume.executions, 1)],
        ['Accepted (counted once)', nf(res.volume.accepted, 1)],
        ['Accepted weighted ABUs', nf(res.volume.weightedAbus, 1)],
        ['Tokens (input + output)', nf(res.tokens.total)],
      ],
    );
  }
}

function comparison(r: Report, full: boolean) {
  const { res, cur } = r;
  r.h('Commercial model comparison (year 1)', 'ESTIMATES');
  const keys = MODEL_KEYS;
  const row = (label: string, fn: (k: ModelKey) => string): RowInput => [label, ...keys.map(fn)];
  const M = res.models;
  r.table(
    ['Metric', ...keys.map((k) => M[k].label + (k === res.selectedModel ? ' *' : ''))],
    [
      row('Implementation revenue', (k) => m(M[k].implementationRevenue, cur)),
      row('Monthly recurring revenue', (k) => m(M[k].mrr, cur)),
      row('Monthly delivery cost', (k) => m(M[k].monthlyDeliveryCost, cur)),
      row('Recurring gross margin', (k) => pf(M[k].recurringMargin)),
      row('Annual revenue', (k) => m(M[k].annualRevenue, cur)),
      row('Annual gross profit', (k) => m(M[k].annualGrossProfit, cur)),
      row('Annual gross margin', (k) => pf(M[k].annualGrossMargin)),
      row('Cost per agent / month', (k) => m(M[k].costPerAgent, cur)),
      row('Cost per ABU', (k) => up(M[k].costPerAbu, cur)),
      row('Cost per ACU', (k) => up(M[k].costPerAcu, cur)),
      row('Client pass-through / mo', (k) => m(M[k].clientPassThroughMonthly, cur)),
      row('3-year revenue', (k) => m(M[k].threeYear.revenue, cur)),
      row('3-year gross profit', (k) => m(M[k].threeYear.grossProfit, cur)),
      row('Total contract value', (k) => m(M[k].tcv, cur)),
    ],
    { fontSize: 7 },
  );
  r.para(`* Selected model. Structure: ${keys.map((k) => `${M[k].label} = ${M[k].structureLabel}`).join('; ')}.`, { size: 7.5, color: MUTED });
  if (full) {
    r.h('Cost-recovery matrix (prevents double recovery)', 'ESTIMATES');
    const poolLabel: Record<string, string> = { consumption: 'AI consumption', platform: 'Platform', agentops: 'AgentOps', service: 'Human review & other' };
    r.table(
      ['Model', ...COST_POOLS.map((p) => poolLabel[p]), 'Check'],
      keys.map((k) => [M[k].label, ...COST_POOLS.map((p) => M[k].recovery[p].join(', ') || '-'), M[k].doubleRecovery ? 'DOUBLE' : 'Once each']),
      { right: [], fontSize: 7.5 },
    );
    for (const k of keys)
      if (M[k].notes.length) r.para(`${M[k].label}: ${M[k].notes.join(' ')}`, { size: 8, color: MUTED });
  }
}

function roi(r: Report, full: boolean) {
  const { res, cur, est } = r;
  const v = res.value;
  r.h('Client productivity and value', 'ESTIMATES');
  r.table(
    ['Productivity (capacity — not cash)', 'Per month'],
    [
      ['Current manual effort', `${nf(v.manualHours)} h`],
      ['AI-assisted manual effort', `${nf(v.aiAssistedHours)} h`],
      ['Hours saved', `${nf(v.hoursSaved)} h (${pf(v.productivityPct)})`],
      ['Redeployable capacity', `${nf(v.redeployableFte, 1)} FTE`],
      ['Capacity value (not cash)', m(v.capacityValueMonthly, cur)],
    ],
  );
  const status = (s: string) => (s === 'validated' ? 'Validated actual' : 'Assumption');
  r.h('Financial benefits', v.validatedBenefitMonthly > 0 ? 'VALIDATED ACTUALS' : 'ASSUMPTIONS');
  r.table(
    ['Benefit', 'Basis', 'Status', 'Per month'],
    [
      ['Verified hard savings', `${pf(est.value.cashRealisationPct)} of capacity value`, status(est.value.cashRealisationStatus), m(v.hardSavingsMonthly, cur)],
      ['Cost avoidance', `${m(est.value.costAvoidanceAnnual, cur)} per year`, status(est.value.costAvoidanceStatus), m(v.costAvoidanceMonthly, cur)],
      ['Revenue uplift (margin)', `${m(est.value.revenueUpliftAnnual, cur)} per year`, status(est.value.revenueUpliftStatus), m(v.revenueUpliftMonthly, cur)],
    ],
    { right: [3], foot: [['Financial benefit', `Validated ${m(v.validatedBenefitMonthly, cur)} · Assumed ${m(v.assumedBenefitMonthly, cur)}`, '', m(v.financialBenefitMonthly, cur)]] },
  );
  r.h(`Return on investment — ${res.selected.label} model`, 'ESTIMATES');
  r.kpis([
    { label: 'ROI 3 years (business case)', value: pf(v.roi3, 0), sub: 'Includes assumed benefits' },
    { label: 'ROI 3 years (validated only)', value: pf(v.roi3Validated, 0), sub: 'Validated benefits only' },
    { label: 'Payback', value: v.paybackMonths == null ? 'No payback' : `${nf(v.paybackMonths, 1)} months` },
    { label: 'ROI year 1', value: pf(v.roiYear1, 0) },
    { label: 'Annual net financial benefit', value: m(v.annualNetFinancialBenefit, cur) },
    { label: 'Year-1 investment', value: m(v.year1Investment, cur), sub: 'Implementation + 12 x client charges' },
  ]);
  if (full)
    r.table(
      ['Year', 'Financial benefit', 'of which validated', 'Investment', 'Net', 'Cumulative net'],
      v.yearly.map((y) => [`Year ${y.year}`, m(y.benefit, cur), m(y.validatedBenefit, cur), m(y.investment, cur), m(y.net, cur), m(y.cumulativeNet, cur)]),
    );
  r.para('ROI = (financial benefits − total AI investment) ÷ total AI investment. Productivity value is not counted as cash unless realised as reduced spend.', { size: 8, color: MUTED });
  if (full && res.sdlc) {
    r.h('SDLC delivery metrics', 'ASSUMPTIONS');
    r.table(
      ['Metric', 'Baseline source', 'Baseline', 'Assumed improvement', 'Projected'],
      res.sdlc.metrics.map((x) => [`${x.label} (${x.unit})`, x.source === 'none' ? 'No baseline — not claimed' : x.source, nf(x.baseline, 2), pf(x.improvementPct, 0), x.claimed ? nf(x.projected, 2) : 'Not claimed']),
      { right: [2, 3, 4] },
    );
    r.para(
      `Cost per accepted development task ${up(res.sdlc.costPerAcceptedTask, cur)} (client price ${up(res.sdlc.pricePerAcceptedTask, cur)}). Cost per release ${up(res.sdlc.costPerRelease, cur)} (client price ${up(res.sdlc.pricePerRelease, cur)}). Lines of code, suggestions and story points are not billable ABUs.`,
      { size: 8.5 },
    );
  }
}

function projection(r: Report, all: boolean) {
  const { res, cur } = r;
  const keys: ModelKey[] = all ? MODEL_KEYS : [res.selectedModel];
  r.h('Three-year financial projection', 'ESTIMATES');
  r.para(`Volume growth ${pf(r.est.volumeGrowthPct)} per year, price escalation ${pf(r.est.commercial.escalationPct)} per year. Prices are set at baseline and escalated; costs follow volume.`, { size: 8.5, color: MUTED });
  for (const k of keys) {
    const mo = res.models[k];
    r.ensure(120);
    r.para(`${mo.label} — ${mo.structureLabel}${k === res.selectedModel ? ' (selected)' : ''}`, { bold: true, size: 10 });
    const rows = mo.projection.slice(0, 3);
    r.table(
      ['Year', 'Monthly volume', 'Revenue', 'Cost', 'Gross profit', 'Margin'],
      rows.map((y) => [`Year ${y.year}`, nf(y.monthlyVolume, 1), m(y.revenue, cur), m(y.cost, cur), m(y.grossProfit, cur), pf(y.grossMargin)]),
      { foot: [['3 years', '', m(mo.threeYear.revenue, cur), m(mo.threeYear.cost, cur), m(mo.threeYear.grossProfit, cur), pf(mo.threeYear.grossMargin)]] },
    );
  }
  if (!all) {
    const mo = res.models[res.selectedModel];
    r.bars(
      mo.projection.slice(0, 3).flatMap((y) => [
        { label: `Year ${y.year} revenue`, value: y.revenue },
        { label: `Year ${y.year} cost`, value: y.cost, color: [184, 192, 201] as [number, number, number] },
      ]),
      (v) => m(v, cur),
    );
  }
}

function validation(r: Report) {
  const { res } = r;
  r.h('Validation and reconciliation');
  const failed = res.checks.filter((c) => !c.pass);
  r.para(
    failed.length === 0
      ? `All ${res.checks.length} reconciliation checks pass: cost lines and pools add up to the total, every cost pool is recovered exactly once in every commercial model, and annual figures equal implementation + 12 x monthly.`
      : `${failed.length} reconciliation check(s) failed: ${failed.map((f) => f.label).join('; ')}.`,
    { size: 8.5 },
  );
  const notes = res.issues.filter((i) => i.level !== 'info');
  if (notes.length) r.para(`Warnings: ${notes.map((i) => i.message).join(' ')}`, { size: 8.5, color: [161, 92, 7] });
}

export function buildPdf(kind: ReportKind, est: EstimateInputs, res: EstimateResults, rc: RateCard): jsPDF {
  const title = REPORTS.find((x) => x.kind === kind)!.title;
  const r = new Report(title, est, res, rc);
  switch (kind) {
    case 'estimate':
      headline(r);
      recommendation(r);
      assumptions(r);
      costs(r, false);
      units(r, false);
      comparison(r, false);
      roi(r, false);
      projection(r, false);
      validation(r);
      break;
    case 'cost':
      headline(r);
      assumptions(r, true);
      costs(r, true);
      units(r, true);
      validation(r);
      break;
    case 'compare':
      recommendation(r);
      comparison(r, true);
      validation(r);
      break;
    case 'roi':
      roi(r, true);
      assumptions(r);
      break;
    case 'projection':
      projection(r, true);
      break;
  }
  return r.finish();
}

export function pdfFileName(kind: ReportKind, est: EstimateInputs) {
  const title = REPORTS.find((x) => x.kind === kind)!.title;
  return `${(est.name || 'estimate').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-')}_${title.replace(/[^\w]+/g, '-')}.pdf`;
}
