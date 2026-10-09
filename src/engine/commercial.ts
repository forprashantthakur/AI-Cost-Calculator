import { D, d, div, n, n0, pct, sum, ZERO, ONE, priceFromMargin, grossMargin, clamp, type Dec } from './decimal';
import { convert, type OperatingCalc } from './operating';
import type {
  AgentOpsBilling,
  CostPool,
  EstimateInputs,
  HybridConfig,
  ModelKey,
  ModelResult,
  RateCard,
  Recommendation,
  VolumeTier,
  YearRow,
} from './types';
import { COST_POOLS, MODEL_KEYS } from './types';

/* ------------------------------------------------------------------------- */
/*  ACU metering                                                             */
/* ------------------------------------------------------------------------- */

export interface AcuCalc {
  total: Dec;
  eligible: Dec;
  refCost: Dec;
  components: { key: string; label: string; quantity: Dec; weight: Dec; acus: Dec }[];
}

/**
 * Method A (cost-normalised): ACUs = eligible AI consumption cost ÷ reference cost per ACU.
 * Method B (weighted resource): ACUs = Σ measured quantity × configured conversion weight.
 * One token is never assumed to equal one ACU.
 */
export function computeAcus(op: OperatingCalc, inp: EstimateInputs, rc: RateCard): AcuCalc {
  const eligible = op.pools.consumption;
  const refCost = convert(rc, rc.acu.referenceCost, rc.acu.referenceCurrency, inp.currency);
  if (rc.acu.method === 'cost') {
    const weight = refCost.gt(0) ? ONE.div(refCost) : ZERO;
    const total = eligible.times(weight);
    return { total, eligible, refCost, components: [{ key: 'eligible', label: 'Eligible AI consumption cost', quantity: eligible, weight, acus: total }] };
  }
  const q = op.quantities;
  const w = rc.acu.weights;
  const comps = [
    { key: 'input', label: 'Uncached input tokens (per 1K)', quantity: q.inputUncached.div(1000), weight: d(w.inputTokensPer1K) },
    { key: 'cached', label: 'Cached input tokens (per 1K)', quantity: q.inputCached.div(1000), weight: d(w.cachedTokensPer1K) },
    { key: 'output', label: 'Output tokens (per 1K)', quantity: q.outputTokens.div(1000), weight: d(w.outputTokensPer1K) },
    { key: 'ocr', label: 'OCR pages', quantity: q.ocrPages, weight: d(w.ocrPage) },
    { key: 'tools', label: 'Tool / API calls', quantity: q.toolCalls, weight: d(w.toolCall) },
    { key: 'orchestration', label: 'Agent runs', quantity: q.orchestrationRuns, weight: d(w.orchestrationRun) },
    { key: 'vector', label: 'Vector queries', quantity: q.vectorQueries, weight: d(w.vectorQuery) },
    { key: 'embedding', label: 'Embedding tokens (per 1K)', quantity: q.embeddingTokens.div(1000), weight: d(w.embeddingTokensPer1K) },
  ].map((c) => ({ ...c, acus: c.quantity.times(c.weight) }));
  return { total: sum(...comps.map((c) => c.acus)), eligible, refCost, components: comps };
}

/* ------------------------------------------------------------------------- */
/*  Volume tiers                                                             */
/* ------------------------------------------------------------------------- */

/**
 * Graduated volume discount: units in each band are billed at that band's
 * discount. Units above the last bounded band take the last band's discount.
 */
export function tieredCharge(units: Dec, price: Dec, tiers: VolumeTier[]): Dec {
  if (units.lte(0)) return ZERO;
  const valid = tiers.filter((t) => t.upTo === null || t.upTo > 0);
  if (!valid.length) return units.times(price);
  const sorted = [...valid].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
  let remaining = units;
  let lower = ZERO;
  let charge = ZERO;
  let lastDisc = ZERO;
  for (const t of sorted) {
    if (remaining.lte(0)) break;
    const disc = clamp(pct(t.discountPct), 0, 1);
    lastDisc = disc;
    const band = t.upTo === null ? remaining : D.min(remaining, D.max(0, d(t.upTo).minus(lower)));
    charge = charge.plus(band.times(price).times(ONE.minus(disc)));
    remaining = remaining.minus(band);
    if (t.upTo !== null) lower = d(t.upTo);
  }
  if (remaining.gt(0)) charge = charge.plus(remaining.times(price).times(ONE.minus(lastDisc)));
  return charge;
}

/* ------------------------------------------------------------------------- */
/*  Price book — every price is set once, at baseline (year 1) volume        */
/* ------------------------------------------------------------------------- */

type Assignment = Record<CostPool, string>;

export interface PriceBook {
  margin: Dec;
  agentOpsBilling: AgentOpsBilling;
  abuPrice: Dec | null;
  acuPrice: Dec | null;
  abuPool: Dec;
  agentOpsFee: Dec;
  fixedFee: Dec;
  subscriptionUnitPrice: Dec;
  subscriptionUnits: Dec;
  includedAbus: Dec;
  overagePrice: Dec | null;
  hybrid: HybridConfig;
  hybridAssignment: Assignment;
  hybridSubUnitPrice: Dec;
  hybridUsagePrice: Dec | null;
  gainsharePct: Dec;
  minCommit: Dec;
  tiers: VolumeTier[];
}

export interface YearState {
  year: number;
  op: OperatingCalc;
  acus: Dec;
  benefitMonthly: Dec;
  esc: Dec;
}

const poolSum = (op: OperatingCalc, pools: CostPool[]) => sum(...pools.map((p) => op.pools[p]));

export function effectiveHybrid(inp: EstimateInputs, rec: Recommendation): HybridConfig {
  const h = inp.commercial.hybrid ?? rec.hybrid ?? { subscription: true, usage: 'abu', agentOps: false, gainshare: false };
  // A hybrid must contain at least one component that recovers platform and consumption cost.
  if (!h.subscription && h.usage === 'none') return { ...h, subscription: true };
  return h;
}

export function hybridAssignment(h: HybridConfig): Assignment {
  const core = h.subscription ? 'subscription' : 'usage';
  return {
    agentops: h.agentOps ? 'agentops-fee' : core,
    platform: h.subscription ? 'subscription' : 'usage',
    consumption: h.usage !== 'none' ? 'usage' : 'subscription',
    service: h.usage !== 'none' ? 'usage' : 'subscription',
  };
}

export function lockedFromPriceBook(pb: PriceBook): import('./types').LockedPrices {
  const o = (v: Dec | null) => (v == null ? null : v.toNumber());
  return {
    abuPrice: o(pb.abuPrice),
    acuPrice: o(pb.acuPrice),
    agentOpsFee: pb.agentOpsFee.toNumber(),
    fixedFee: pb.fixedFee.toNumber(),
    subscriptionUnitPrice: pb.subscriptionUnitPrice.toNumber(),
    includedAbus: pb.includedAbus.toNumber(),
    overagePrice: o(pb.overagePrice),
    hybridSubUnitPrice: pb.hybridSubUnitPrice.toNumber(),
    hybridUsagePrice: o(pb.hybridUsagePrice),
  };
}

export function buildPriceBook(inp: EstimateInputs, base: YearState, rec: Recommendation, abus: Dec): PriceBook {
  const c = inp.commercial;
  const m = clamp(d(inp.targetMargin), 0, 95);
  const op = base.op;
  const agentOpsBilling: AgentOpsBilling = c.agentOpsBilling === 'auto' ? rec.agentOpsBilling : c.agentOpsBilling;
  const separate = agentOpsBilling === 'separate';

  // Pool recovered by a standalone unit price: everything except AgentOps
  // when AgentOps is billed as its own fee (no double recovery).
  const unitPool = separate ? op.total.minus(op.pools.agentops) : op.total;
  const unitPrice = (units: Dec) => {
    const per = div(unitPool, units);
    return per ? priceFromMargin(per, m) : null;
  };
  const abuPrice = c.abuPriceOverride != null ? d(c.abuPriceOverride) : unitPrice(abus);
  const acuPrice = c.acuPriceOverride != null ? d(c.acuPriceOverride) : unitPrice(base.acus);
  const agentOpsFee = c.agentOpsFeeOverride != null ? d(c.agentOpsFeeOverride) : priceFromMargin(op.pools.agentops, m);
  const fixedFee = priceFromMargin(op.total, m);

  const units = D.max(0, d(c.subscriptionUnits));
  const subPerUnit = units.gt(0) ? priceFromMargin(unitPool, m).div(units) : ZERO;
  const subscriptionUnitPrice = c.subscriptionPriceOverride != null ? d(c.subscriptionPriceOverride) : subPerUnit;
  const includedAbus = c.includedAbusOverride != null ? D.max(0, d(c.includedAbusOverride)) : abus;
  const overagePrice = abuPrice ? abuPrice.times(ONE.plus(pct(c.overagePremiumPct))) : null;

  const hybrid = effectiveHybrid(inp, rec);
  const asg = hybridAssignment(hybrid);
  const subPools = COST_POOLS.filter((p) => asg[p] === 'subscription');
  const usePools = COST_POOLS.filter((p) => asg[p] === 'usage');
  const hybridSubCalc = units.gt(0) ? priceFromMargin(poolSum(op, subPools), m).div(units) : ZERO;
  const hybridSubUnitPrice = c.subscriptionPriceOverride != null ? d(c.subscriptionPriceOverride) : hybridSubCalc;
  const usageUnits = hybrid.usage === 'acu' ? base.acus : abus;
  const usagePer = div(poolSum(op, usePools), usageUnits);
  let hybridUsagePrice = usagePer ? priceFromMargin(usagePer, m) : null;
  if (hybrid.usage === 'abu' && c.abuPriceOverride != null) hybridUsagePrice = d(c.abuPriceOverride);
  if (hybrid.usage === 'acu' && c.acuPriceOverride != null) hybridUsagePrice = d(c.acuPriceOverride);

  const L = c.lockedPrices;
  if (L) {
    const opt = (v: number | null) => (v == null ? null : d(v));
    return {
      margin: m,
      agentOpsBilling,
      abuPrice: opt(L.abuPrice),
      acuPrice: opt(L.acuPrice),
      abuPool: unitPool,
      agentOpsFee: d(L.agentOpsFee),
      fixedFee: d(L.fixedFee),
      subscriptionUnitPrice: d(L.subscriptionUnitPrice),
      subscriptionUnits: units,
      includedAbus: d(L.includedAbus),
      overagePrice: opt(L.overagePrice),
      hybrid,
      hybridAssignment: asg,
      hybridSubUnitPrice: d(L.hybridSubUnitPrice),
      hybridUsagePrice: opt(L.hybridUsagePrice),
      gainsharePct: clamp(pct(c.gainsharePct), 0, 1),
      minCommit: D.max(0, d(c.minMonthlyCommitment)),
      tiers: c.volumeTiers,
    };
  }

  return {
    margin: m,
    agentOpsBilling,
    abuPrice,
    acuPrice,
    abuPool: unitPool,
    agentOpsFee,
    fixedFee,
    subscriptionUnitPrice,
    subscriptionUnits: units,
    includedAbus,
    overagePrice,
    hybrid,
    hybridAssignment: asg,
    hybridSubUnitPrice,
    hybridUsagePrice,
    gainsharePct: clamp(pct(c.gainsharePct), 0, 1),
    minCommit: D.max(0, d(c.minMonthlyCommitment)),
    tiers: c.volumeTiers,
  };
}

/* ------------------------------------------------------------------------- */
/*  Model evaluation                                                         */
/* ------------------------------------------------------------------------- */

interface Comp {
  key: string;
  label: string;
  monthly: Dec;
  recovers: CostPool[];
  basis: string;
}

interface Evaluated {
  components: Comp[];
  providerCost: Dec;
  passThrough: Dec;
  recovery: Record<CostPool, string[]>;
}

const UNIT_LABEL: Record<string, string> = { agent: 'agent', user: 'user', developer: 'developer', team: 'team' };

function usageCharge(units: Dec, price: Dec | null, pb: PriceBook, esc: Dec): Dec {
  if (!price) return pb.minCommit.times(esc);
  const charge = tieredCharge(units, price.times(esc), pb.tiers);
  return D.max(charge, pb.minCommit.times(esc));
}

function evaluate(key: ModelKey, pb: PriceBook, y: YearState, inp: EstimateInputs): Evaluated {
  const op = y.op;
  const abus = op.vol.weightedAbus;
  const esc = y.esc;
  const sep = pb.agentOpsBilling === 'separate';
  const rec: Record<CostPool, string[]> = { consumption: [], platform: [], agentops: [], service: [] };
  const comps: Comp[] = [];
  const add = (c: Comp) => {
    comps.push(c);
    c.recovers.forEach((p) => rec[p].push(c.key));
  };
  const nonAgentOps: CostPool[] = ['consumption', 'platform', 'service'];
  const agentOpsComp = () =>
    add({ key: 'agentops-fee', label: 'Managed AgentOps fee', monthly: pb.agentOpsFee.times(esc), recovers: ['agentops'], basis: 'Fixed monthly fee for monitoring, support and governance' });
  let providerCost = op.total;
  let passThrough = ZERO;
  const unitName = UNIT_LABEL[inp.commercial.subscriptionUnit] ?? 'unit';

  switch (key) {
    case 'fixed':
      add({ key: 'fixed-fee', label: 'Fixed monthly run fee', monthly: pb.fixedFee.times(esc), recovers: [...COST_POOLS], basis: 'Agreed flat fee set at baseline volume; provider carries volume risk' });
      break;
    case 'acu':
      add({
        key: 'acu-usage',
        label: 'ACU consumption charge',
        monthly: usageCharge(y.acus, pb.acuPrice, pb, esc),
        recovers: sep ? nonAgentOps : [...COST_POOLS],
        basis: 'ACUs × price per ACU (after volume tiers and minimum commitment)',
      });
      if (sep) agentOpsComp();
      break;
    case 'abu':
      add({
        key: 'abu-usage',
        label: 'ABU outcome charge',
        monthly: usageCharge(abus, pb.abuPrice, pb, esc),
        recovers: sep ? nonAgentOps : [...COST_POOLS],
        basis: 'Accepted weighted ABUs × price per ABU (after volume tiers and minimum commitment)',
      });
      if (sep) agentOpsComp();
      break;
    case 'subscription': {
      add({
        key: 'subscription',
        label: `Subscription (per ${unitName})`,
        monthly: pb.subscriptionUnitPrice.times(pb.subscriptionUnits).times(esc),
        recovers: sep ? nonAgentOps : [...COST_POOLS],
        basis: `${n0(pb.subscriptionUnits)} ${unitName}s × fee, including ${n0(pb.includedAbus, 0)} ABUs per month`,
      });
      const over = D.max(0, abus.minus(pb.includedAbus));
      add({
        key: 'overage',
        label: 'Overage above included ABUs',
        monthly: pb.overagePrice ? over.times(pb.overagePrice).times(esc) : ZERO,
        recovers: [],
        basis: 'ABUs above the allowance × overage price (covers incremental cost only)',
      });
      if (sep) agentOpsComp();
      break;
    }
    case 'agentops':
      add({ key: 'agentops-fee', label: 'Managed AgentOps fee', monthly: pb.agentOpsFee.times(esc), recovers: ['agentops'], basis: 'Recurring monitoring and operational support fee' });
      nonAgentOps.forEach((p) => rec[p].push('client'));
      providerCost = op.pools.agentops;
      passThrough = op.total.minus(op.pools.agentops);
      break;
    case 'gainshare':
      add({
        key: 'gainshare',
        label: 'Gainshare on financial benefits',
        monthly: pb.gainsharePct.times(y.benefitMonthly),
        recovers: [],
        basis: `${n0(pb.gainsharePct.times(100), 2)}% of financial benefits; provider carries all run costs`,
      });
      COST_POOLS.forEach((p) => rec[p].push('at-risk'));
      break;
    case 'hybrid': {
      const h = pb.hybrid;
      const asg = pb.hybridAssignment;
      const of = (k: string) => COST_POOLS.filter((p) => asg[p] === k);
      if (h.subscription)
        add({
          key: 'subscription',
          label: `Platform subscription (per ${unitName})`,
          monthly: pb.hybridSubUnitPrice.times(pb.subscriptionUnits).times(esc),
          recovers: of('subscription'),
          basis: `${n0(pb.subscriptionUnits)} ${unitName}s × platform fee`,
        });
      if (h.usage !== 'none') {
        const units = h.usage === 'acu' ? y.acus : abus;
        add({
          key: 'usage',
          label: h.usage === 'acu' ? 'ACU consumption charge' : 'ABU outcome charge',
          monthly: usageCharge(units, pb.hybridUsagePrice, pb, esc),
          recovers: of('usage'),
          basis: h.usage === 'acu' ? 'ACUs × hybrid ACU price' : 'Accepted weighted ABUs × hybrid ABU price',
        });
      }
      if (h.agentOps) agentOpsComp();
      if (h.gainshare)
        add({
          key: 'gainshare',
          label: 'Gainshare (upside)',
          monthly: pb.gainsharePct.times(y.benefitMonthly),
          recovers: [],
          basis: `${n0(pb.gainsharePct.times(100), 2)}% of financial benefits — upside only, recovers no cost`,
        });
      break;
    }
  }
  return { components: comps, providerCost, passThrough, recovery: rec };
}

const MODEL_META: Record<ModelKey, { label: string; description: string }> = {
  fixed: { label: 'Fixed Fee', description: 'One-time implementation plus an agreed fixed monthly fee; the provider carries volume risk.' },
  acu: { label: 'ACU', description: 'Price per normalised AI Consumption Unit — the client pays for metered AI usage.' },
  abu: { label: 'ABU', description: 'Price per accepted, complexity-weighted business outcome — failed attempts and retries are not billed.' },
  subscription: { label: 'Subscription', description: 'Monthly fee per agent, user, developer or team with an included ABU allowance and overage.' },
  agentops: { label: 'Managed AgentOps', description: 'Recurring operations fee; AI consumption and platform costs are paid by the client at cost.' },
  gainshare: { label: 'Gainshare', description: 'Share of financial benefits, payable only once independently validated; the provider carries all run costs.' },
  hybrid: { label: 'Hybrid', description: 'Combination of subscription, ACU/ABU usage, AgentOps and optional gainshare — each cost recovered once.' },
};

export function structureLabel(key: ModelKey, pb: PriceBook): string {
  const sep = pb.agentOpsBilling === 'separate';
  switch (key) {
    case 'fixed':
      return 'Fixed implementation + fixed monthly fee';
    case 'acu':
      return sep ? 'ACU + AgentOps fee' : 'ACU (AgentOps bundled)';
    case 'abu':
      return sep ? 'ABU + AgentOps fee' : 'ABU (AgentOps bundled)';
    case 'subscription':
      return sep ? 'Subscription + overage + AgentOps fee' : 'Subscription + overage';
    case 'agentops':
      return 'AgentOps fee + client-paid consumption';
    case 'gainshare':
      return 'Gainshare only';
    case 'hybrid': {
      const h = pb.hybrid;
      return [h.subscription && 'Subscription', h.usage !== 'none' && h.usage.toUpperCase(), h.agentOps && 'AgentOps', h.gainshare && 'Gainshare']
        .filter(Boolean)
        .join(' + ');
    }
  }
}

export function buildModels(
  inp: EstimateInputs,
  pb: PriceBook,
  years: YearState[],
  impl: { cost: Dec; price: Dec },
): Record<ModelKey, ModelResult> {
  const agents = d(inp.agents);
  const contract = Math.max(1, Math.min(10, Math.round(inp.commercial.contractYears || 1)));
  const out = {} as Record<ModelKey, ModelResult>;

  for (const key of MODEL_KEYS) {
    const evals = years.map((y) => evaluate(key, pb, y, inp));
    const e1 = evals[0];
    const y1 = years[0];
    const mrr = sum(...e1.components.map((c) => c.monthly));
    const annualRevenue = impl.price.plus(mrr.times(12));
    const annualCost = impl.cost.plus(e1.providerCost.times(12));
    const rows: YearRow[] = years.map((y, i) => {
      const e = evals[i];
      const recurring = sum(...e.components.map((c) => c.monthly)).times(12);
      const implRev = y.year === 1 ? impl.price : ZERO;
      const implCost = y.year === 1 ? impl.cost : ZERO;
      const runCost = e.providerCost.times(12);
      const revenue = implRev.plus(recurring);
      const cost = implCost.plus(runCost);
      return {
        year: y.year,
        monthlyVolume: n0(y.op.vol.V),
        weightedAbus: n0(y.op.vol.weightedAbus),
        implementationRevenue: n0(implRev),
        recurringRevenue: n0(recurring),
        revenue: n0(revenue),
        implementationCost: n0(implCost),
        runCost: n0(runCost),
        cost: n0(cost),
        grossProfit: n0(revenue.minus(cost)),
        grossMargin: n(grossMargin(revenue, cost)?.times(100) ?? null, 4),
        clientPassThrough: n0(e.passThrough.times(12)),
      };
    });
    const three = rows.slice(0, 3);
    const r3 = three.reduce((a, r) => a.plus(d(r.revenue)), ZERO);
    const c3 = three.reduce((a, r) => a.plus(d(r.cost)), ZERO);
    const tcv = rows.slice(0, contract).reduce((a, r) => a.plus(d(r.revenue)), ZERO);

    const counts = COST_POOLS.map((p) => ({ p, c: e1.recovery[p].length, v: y1.op.pools[p] }));
    const notes: string[] = [];
    if (key === 'gainshare') notes.push('Gainshare is payable only on independently validated benefits; the projection uses the benefits in the business case.');
    if (key === 'agentops') notes.push('Consumption, platform and human-review costs are paid by the client directly at cost (pass-through).');
    if (key === 'fixed') notes.push('Fee is fixed at baseline volume; growth increases provider cost without increasing revenue.');
    if (pb.tiers.length && (key === 'abu' || key === 'acu' || (key === 'hybrid' && pb.hybrid.usage !== 'none')))
      notes.push('Volume discounts reduce the effective margin below the target.');

    out[key] = {
      key,
      label: MODEL_META[key].label,
      structureLabel: structureLabel(key, pb),
      description: MODEL_META[key].description,
      components: e1.components.map((c) => ({ key: c.key, label: c.label, monthly: n0(c.monthly), recovers: c.recovers, basis: c.basis })),
      recovery: e1.recovery,
      doubleRecovery: counts.some((x) => x.c > 1),
      unrecovered: counts.filter((x) => x.c === 0 && x.v.gt(0)).map((x) => x.p),
      implementationRevenue: n0(impl.price),
      implementationCost: n0(impl.cost),
      mrr: n0(mrr),
      monthlyDeliveryCost: n0(e1.providerCost),
      monthlyGrossProfit: n0(mrr.minus(e1.providerCost)),
      recurringMargin: n(grossMargin(mrr, e1.providerCost)?.times(100) ?? null, 4),
      annualRevenue: n0(annualRevenue),
      annualDeliveryCost: n0(annualCost),
      annualGrossProfit: n0(annualRevenue.minus(annualCost)),
      annualGrossMargin: n(grossMargin(annualRevenue, annualCost)?.times(100) ?? null, 4),
      costPerAgent: n(div(e1.providerCost, agents)),
      costPerAbu: n(div(e1.providerCost, y1.op.vol.weightedAbus)),
      costPerAcu: n(div(e1.providerCost, y1.acus)),
      clientPassThroughMonthly: n0(e1.passThrough),
      clientMonthlyCost: n0(mrr.plus(e1.passThrough)),
      projection: rows,
      threeYear: { revenue: n0(r3), cost: n0(c3), grossProfit: n0(r3.minus(c3)), grossMargin: n(grossMargin(r3, c3)?.times(100) ?? null, 4) },
      tcv: n0(tcv),
      notes,
    };
  }
  return out;
}

/** Monthly client charge (provider charges + pass-through) for one model, per year. */
export function clientMonthlyByYear(key: ModelKey, pb: PriceBook, years: YearState[], inp: EstimateInputs): Dec[] {
  return years.map((y) => {
    const e = evaluate(key, pb, y, inp);
    return sum(...e.components.map((c) => c.monthly)).plus(e.passThrough);
  });
}
