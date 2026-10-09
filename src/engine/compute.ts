import { D, d, div, n, n0, pct, sum, ZERO, ONE, priceFromMargin, type Dec } from './decimal';
import { getProcess } from '@/data/catalog';
import {
  computeImplementation,
  computeOperating,
  computeVolume,
  implementationResult,
  operatingResult,
  tokenResult,
  volumeResult,
} from './operating';
import { buildModels, buildPriceBook, clientMonthlyByYear, computeAcus, lockedFromPriceBook, type YearState } from './commercial';
import { computeBenefits, computeSdlcMetrics, computeValue } from './value';
import { recommend } from './recommend';
import { sdlcDerivedVolume } from './sdlc';
import { validate } from './validate';
import type { EstimateInputs, EstimateResults, ModelKey, RateCard, ReconCheck } from './types';
import { COST_POOLS, MODEL_KEYS } from './types';

/** Apply derived values (e.g. SDLC-driven volume) before calculating. */
export function resolveInputs(inp: EstimateInputs): EstimateInputs {
  if (inp.sdlc?.deriveVolume) {
    const proc = getProcess(inp.processId);
    const v = sdlcDerivedVolume(inp.sdlc, proc);
    if (v != null) return { ...inp, monthlyVolume: v };
  }
  return inp;
}

/**
 * The single deterministic entry point. Every screen, chart and export reads
 * its numbers from this result, so the dashboard and the reports always agree.
 */
export function computeEstimate(raw: EstimateInputs, rc: RateCard): EstimateResults {
  const inp = resolveInputs(raw);
  const proc = getProcess(inp.processId);
  const yearsN = Math.max(3, Math.min(10, Math.round(inp.commercial.contractYears || 3)));
  const g = pct(inp.volumeGrowthPct);
  const e = pct(inp.commercial.escalationPct);

  /* ---- Per-year state (volume growth) ---------------------------------- */
  const years: YearState[] = [];
  const benefitsByYear: ReturnType<typeof computeBenefits>[] = [];
  for (let y = 1; y <= yearsN; y++) {
    const factor = ONE.plus(g).pow(y - 1);
    const yi: EstimateInputs = y === 1 ? inp : { ...inp, monthlyVolume: d(inp.monthlyVolume).times(factor).toNumber() };
    const vol = computeVolume(yi, rc);
    const op = computeOperating(yi, rc, vol);
    const acu = computeAcus(op, yi, rc);
    const b = computeBenefits(yi, vol);
    benefitsByYear.push(b);
    years.push({ year: y, op, acus: acu.total, benefitMonthly: b.financial, esc: ONE.plus(e).pow(y - 1) });
  }
  const base = years[0];
  const op = base.op;
  const vol = op.vol;
  const acu = computeAcus(op, inp, rc);
  const b1 = benefitsByYear[0];

  /* ---- Implementation, recommendation, prices --------------------------- */
  const impl = computeImplementation(inp, rc);
  const rec = recommend(inp, proc, b1.financial.gt(0));
  const pb = buildPriceBook(inp, base, rec, vol.weightedAbus);
  const models = buildModels(inp, pb, years, impl);
  const selectedModel: ModelKey = inp.commercial.selectedModel ?? rec.model;
  const selected = models[selectedModel];

  /* ---- Client value & ROI (on the selected commercial model) ------------ */
  const clientMonthly = clientMonthlyByYear(selectedModel, pb, years, inp);
  const value = computeValue(
    inp,
    rc,
    b1,
    impl.price,
    years.map((y, i) => ({ year: y.year, benefitMonthly: benefitsByYear[i].financial, validatedMonthly: benefitsByYear[i].validated, clientMonthly: clientMonthly[i] })),
  );

  /* ---- Unit economics ---------------------------------------------------- */
  const abuUsage = models.abu.components.find((c) => c.key === 'abu-usage')?.monthly ?? 0;
  const acuUsage = models.acu.components.find((c) => c.key === 'acu-usage')?.monthly ?? 0;
  const deliveryCostPerAcu = div(pb.abuPool, acu.total);

  /* ---- SDLC ------------------------------------------------------------- */
  let sdlc: EstimateResults['sdlc'] = null;
  if (inp.sdlc) {
    const s = inp.sdlc;
    const stories = d(s.teams).times(d(s.sprintsPerMonth)).times(d(s.storiesPerSprint));
    const deployments = d(s.deploymentsPerMonth);
    sdlc = {
      derivedVolume: sdlcDerivedVolume(s, proc) ?? n0(vol.V),
      driverLabel: proc.sdlcDriver?.label ?? 'Monthly work items',
      storiesPerMonth: n0(stories),
      storyPointsPerMonth: n0(stories.times(d(s.avgStoryPoints))),
      costPerAcceptedTask: n(div(op.total, vol.accepted)),
      pricePerAcceptedTask: n(div(d(selected.mrr), vol.accepted)),
      costPerRelease: n(div(op.total, deployments)),
      pricePerRelease: n(div(d(selected.mrr), deployments)),
      metrics: computeSdlcMetrics(inp),
    };
  }

  const results: EstimateResults = {
    currency: inp.currency,
    rateCardVersion: rc.version,
    volume: volumeResult(vol),
    tokens: tokenResult(op),
    implementation: implementationResult(impl, inp),
    operating: operatingResult(op, inp),
    acu: {
      method: rc.acu.method,
      total: n0(acu.total),
      perTxn: n(div(acu.total, vol.V)),
      perAgent: n(div(acu.total, inp.agents)),
      eligibleCost: n0(acu.eligible),
      referenceCostInCurrency: n0(acu.refCost, 8),
      consumptionCostPerAcu: n(div(acu.eligible, acu.total), 8),
      deliveryCostPerAcu: n(deliveryCostPerAcu, 8),
      price: n(pb.acuPrice, 8),
      priceOverridden: inp.commercial.acuPriceOverride != null,
      monthlyRevenue: acuUsage,
      components: acu.components.map((c) => ({ key: c.key, label: c.label, quantity: n0(c.quantity), weight: n0(c.weight, 8), acus: n0(c.acus) })),
    },
    abu: {
      weighted: n0(vol.weightedAbus),
      costPerAbuFullyLoaded: n(div(op.total, vol.weightedAbus), 8),
      recoverablePool: n0(pb.abuPool),
      costPerAbuRecoverable: n(div(pb.abuPool, vol.weightedAbus), 8),
      price: n(pb.abuPrice, 8),
      priceOverridden: inp.commercial.abuPriceOverride != null,
      monthlyRevenue: abuUsage,
      costPerAcceptedTxn: n(div(op.total, vol.accepted)),
      failureCostPerAbu: n(div(op.failureCost, vol.weightedAbus)),
    },
    agentOpsBilling: pb.agentOpsBilling,
    agentOpsFee: n0(pb.agentOpsFee),
    recommendation: rec,
    models,
    selectedModel,
    selected,
    value,
    sdlc,
    prices: lockedFromPriceBook(pb),
    issues: [],
    checks: [],
  };
  results.issues = validate(inp, raw, rc, results, proc);
  results.checks = reconcile(results, { op, impl, pb, acu, vol });
  return results;
}

/* ------------------------------------------------------------------------- */
/*  Reconciliation — the engine proves its own totals                        */
/* ------------------------------------------------------------------------- */

const close = (a: Dec | number, b: Dec | number, tol = '0.0001') => d(a).minus(d(b)).abs().lte(d(tol).times(D.max(1, d(b).abs())));

function reconcile(
  r: EstimateResults,
  x: { op: ReturnType<typeof computeOperating>; impl: ReturnType<typeof computeImplementation>; pb: ReturnType<typeof buildPriceBook>; acu: ReturnType<typeof computeAcus>; vol: ReturnType<typeof computeVolume> },
): ReconCheck[] {
  const checks: ReconCheck[] = [];
  const add = (id: string, label: string, pass: boolean, detail: string) => checks.push({ id, label, pass, detail });
  const lineSum = sum(...x.op.lines.map((l) => l.monthly));
  add('lines-total', 'Cost lines add up to total monthly delivery cost', close(lineSum, x.op.total), `${lineSum.toFixed(2)} vs ${x.op.total.toFixed(2)}`);
  const poolSum = sum(...COST_POOLS.map((p) => x.op.pools[p]));
  add('pools-total', 'Cost pools add up to total monthly delivery cost', close(poolSum, x.op.total), `${poolSum.toFixed(2)} vs ${x.op.total.toFixed(2)}`);
  add(
    'llm-split',
    'LLM input + cached + output = LLM total (no cached double count)',
    close(sum(x.op.llm.input, x.op.llm.cached, x.op.llm.output), x.op.llm.total) &&
      close(x.op.quantities.inputCached.plus(x.op.quantities.inputUncached), x.op.quantities.inputTokens),
    'Cached tokens billed once at the cached rate',
  );
  add('abu-unique', 'Accepted transactions never exceed unique submissions', x.vol.accepted.lte(x.vol.unique) && x.vol.unique.lte(x.vol.V), 'Duplicates and retries are not counted as ABUs');
  if (r.acu.method === 'cost' && x.acu.refCost.gt(0))
    add('acu-normalised', 'ACUs × reference cost = eligible consumption cost', close(x.acu.total.times(x.acu.refCost), x.acu.eligible), 'Method A normalisation');
  add('impl-separate', 'Implementation (one-time) kept separate from monthly run cost', !x.op.lines.some((l) => l.key.startsWith('impl')), 'One-time and recurring costs are separate');
  for (const k of MODEL_KEYS) {
    const m = r.models[k];
    const compSum = m.components.reduce((a, c) => a + c.monthly, 0);
    add(`mrr-${k}`, `${m.label}: components add up to monthly recurring revenue`, close(compSum, m.mrr), `${compSum.toFixed(2)} vs ${m.mrr.toFixed(2)}`);
    add(`annual-${k}`, `${m.label}: annual revenue = implementation + 12 × MRR`, close(m.annualRevenue, m.implementationRevenue + 12 * m.mrr), '');
    add(`proj-${k}`, `${m.label}: year-1 projection matches annual revenue`, close(m.projection[0].revenue, m.annualRevenue), '');
    add(`recovery-${k}`, `${m.label}: every cost pool recovered exactly once`, !m.doubleRecovery && m.unrecovered.length === 0, m.doubleRecovery ? 'Duplicate cost recovery detected' : m.unrecovered.length ? `Unrecovered: ${m.unrecovered.join(', ')}` : 'No duplicate recovery');
  }
  if (x.pb.agentOpsBilling === 'separate' && x.pb.abuPrice && !r.abu.priceOverridden && x.vol.weightedAbus.gt(0)) {
    const expected = priceFromMargin(x.op.total.minus(x.op.pools.agentops), x.pb.margin).div(x.vol.weightedAbus);
    add('agentops-excluded', 'AgentOps billed separately is excluded from the ABU price', close(expected, x.pb.abuPrice), 'Prevents recovering AgentOps twice');
  }
  const inv = r.implementation.price + r.value.annualClientCharges;
  add('roi-investment', 'ROI investment = implementation price + year-1 client charges', close(inv, r.value.year1Investment), '');
  return checks;
}

