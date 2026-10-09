import { describe, expect, test } from 'vitest';
import { computeEstimate, runScenario, presetLevers, tieredCharge } from '@/engine';
import { d } from '@/engine/decimal';
import { PROCESSES, INDUSTRIES } from '@/data/catalog';
import { createEstimate, composeWorkflow, convertEstimateCurrency } from '@/data/templates';
import { buildSamples } from '@/data/samples';
import { RC, simpleEstimate } from './fixtures';

const line = (r: ReturnType<typeof computeEstimate>, key: string) => r.operating.lines.find((l) => l.key === key)!.monthly;

describe('token and consumption costs', () => {
  test('input, cached and output tokens are priced exactly once', () => {
    const r = computeEstimate(simpleEstimate(), RC);
    expect(r.volume.executions).toBe(1250);
    expect(r.tokens.inputUncached).toBe(1_250_000);
    expect(r.tokens.inputCached).toBe(1_250_000);
    expect(r.tokens.output).toBe(1_250_000);
    expect(line(r, 'llm-input')).toBe(6.25);
    expect(line(r, 'llm-cached')).toBe(0.625);
    expect(line(r, 'llm-output')).toBe(31.25);
    expect(r.operating.llm.total).toBe(38.125);
    expect(line(r, 'orchestration')).toBe(2.5);
    expect(r.operating.pools.consumption).toBe(40.625);
    expect(r.operating.total).toBe(1540.625);
  });

  test('100% cache hits never also bill the full input rate', () => {
    const r = computeEstimate(simpleEstimate({ cachedInputPct: 100 }), RC);
    expect(line(r, 'llm-input')).toBe(0);
    expect(line(r, 'llm-cached')).toBe(1.25);
  });

  test('retries and failed executions consume tokens', () => {
    const noRetry = computeEstimate(simpleEstimate({ retryRatePct: 0 }), RC);
    const retry = computeEstimate(simpleEstimate({ retryRatePct: 25 }), RC);
    expect(retry.operating.llm.total / noRetry.operating.llm.total).toBeCloseTo(1.25, 6);
  });

  test('OCR is charged once per document, not per retry', () => {
    const a = computeEstimate(simpleEstimate({ ocrPagesPerTxn: 4, retryRatePct: 0 }), RC);
    const b = computeEstimate(simpleEstimate({ ocrPagesPerTxn: 4, retryRatePct: 50 }), RC);
    expect(line(a, 'ocr')).toBe(line(b, 'ocr'));
    expect(line(a, 'ocr')).toBe(1000 * 4 * 0.0015);
  });

  test('currency conversion applies the FX rate to vendor USD rates', () => {
    const usd = computeEstimate(simpleEstimate(), RC);
    const inr = computeEstimate(simpleEstimate({ currency: 'INR' }), RC);
    expect(inr.operating.pools.consumption).toBeCloseTo(usd.operating.pools.consumption * RC.fx.INR, 6);
  });

  test('decimal-safe arithmetic (no binary floating-point drift)', () => {
    expect(d(0.1).plus(0.2).toNumber()).toBe(0.3);
    const r = computeEstimate(simpleEstimate({ implSimpleCost: 0.3, implMarginPct: 0 }), RC);
    expect(r.implementation.price).toBe(0.3);
  });
});

describe('ACU engine', () => {
  test('Method A: ACUs = eligible consumption ÷ reference cost per ACU', () => {
    const r = computeEstimate(simpleEstimate(), RC);
    // Reference = ₹1 = $1/85, so ACUs = $40.625 × 85
    expect(r.acu.method).toBe('cost');
    expect(r.acu.total).toBe(3453.125);
    expect(r.acu.eligibleCost).toBe(40.625);
    expect(r.acu.perTxn).toBeCloseTo(3.453125, 6);
  });

  test('Method B: weighted resource ACUs — one token is not one ACU', () => {
    const rc = { ...RC, acu: { ...RC.acu, method: 'weighted' as const } };
    const r = computeEstimate(simpleEstimate(), rc);
    const w = RC.acu.weights;
    const expected = 1250 * w.inputTokensPer1K + 1250 * w.cachedTokensPer1K + 1250 * w.outputTokensPer1K + 1250 * w.orchestrationRun;
    expect(r.acu.total).toBeCloseTo(expected, 6);
    expect(r.acu.total).not.toBe(r.tokens.total);
  });

  test('ACU price = fully loaded cost per ACU ÷ (1 − margin)', () => {
    const r = computeEstimate(simpleEstimate(), RC);
    expect(r.acu.price!).toBeCloseTo(1540.625 / 3453.125 / 0.6, 5);
  });
});

describe('ABU engine', () => {
  test('weighted ABUs use the complexity weight', () => {
    expect(computeEstimate(simpleEstimate({ complexity: 'low' }), RC).volume.weightedAbus).toBe(800);
    expect(computeEstimate(simpleEstimate({ complexity: 'medium' }), RC).volume.weightedAbus).toBe(1200);
    expect(computeEstimate(simpleEstimate({ complexity: 'high' }), RC).volume.weightedAbus).toBe(2400);
  });

  test('complexity mix blends weights and is normalised', () => {
    const r = computeEstimate(simpleEstimate({ useComplexityMix: true, complexityMix: { low: 50, medium: 30, high: 20 } }), RC);
    expect(r.volume.abuWeight).toBeCloseTo(0.5 * 1 + 0.3 * 1.5 + 0.2 * 3, 6);
    const r2 = computeEstimate(simpleEstimate({ useComplexityMix: true, complexityMix: { low: 5, medium: 3, high: 2 } }), RC);
    expect(r2.volume.abuWeight).toBeCloseTo(r.volume.abuWeight, 6);
  });

  test('cost per ABU and ABU price', () => {
    const r = computeEstimate(simpleEstimate(), RC);
    expect(r.abu.costPerAbuFullyLoaded!).toBeCloseTo(1540.625 / 1200, 6);
    expect(r.abu.price!).toBeCloseTo(1540.625 / 1200 / 0.6, 6);
  });

  test('failed attempts and retries are allocated to accepted outcomes', () => {
    const good = computeEstimate(simpleEstimate({ successRate: 100, retryRatePct: 0 }), RC);
    const bad = computeEstimate(simpleEstimate({ successRate: 50, retryRatePct: 50 }), RC);
    expect(bad.operating.total).toBeGreaterThan(good.operating.total);
    expect(bad.abu.costPerAbuFullyLoaded!).toBeGreaterThan(good.abu.costPerAbuFullyLoaded!);
    expect(good.operating.failureAndRetryCost).toBe(0);
    // 1,500 executions, 500 accepted → 2/3 of execution-driven cost is failure/retry cost
    const exec = bad.operating.pools.consumption;
    expect(bad.operating.failureAndRetryCost).toBeCloseTo((exec * 1000) / 1500, 5);
  });

  test('duplicates and retries never create extra ABUs', () => {
    const r = computeEstimate(simpleEstimate({ duplicateRatePct: 10, retryRatePct: 100, successRate: 100 }), RC);
    expect(r.volume.unique).toBe(900);
    expect(r.volume.accepted).toBe(900);
    expect(r.volume.weightedAbus).toBe(1350);
    expect(r.volume.executions).toBe(2000);
  });
});

describe('margins and cost separation', () => {
  test('price = cost / (1 − margin) gives exactly the target margin', () => {
    const r = computeEstimate(simpleEstimate({ commercial: { selectedModel: 'abu' } as never }), RC);
    expect(r.models.abu.recurringMargin!).toBeCloseTo(40, 5);
    expect(r.models.fixed.recurringMargin!).toBeCloseTo(40, 5);
    expect(r.implementation.price).toBeCloseTo(10000 / 0.7, 5);
  });

  test('margin of 100% is capped (no division by zero)', () => {
    const r = computeEstimate(simpleEstimate({ targetMargin: 100 }), RC);
    expect(Number.isFinite(r.abu.price!)).toBe(true);
    expect(r.issues.some((i) => i.level === 'error' && i.field === 'targetMargin')).toBe(true);
  });

  test('one-time implementation is kept out of monthly run cost', () => {
    const a = computeEstimate(simpleEstimate({ implSimpleCost: 10000 }), RC);
    const b = computeEstimate(simpleEstimate({ implSimpleCost: 999999 }), RC);
    expect(a.operating.total).toBe(b.operating.total);
    expect(a.abu.price).toBe(b.abu.price);
    expect(b.models.abu.annualRevenue - a.models.abu.annualRevenue).toBeCloseTo((999999 - 10000) / 0.7, 4);
  });

  test('detailed implementation = Σ hours × role rate', () => {
    const est = simpleEstimate({ implMode: 'detailed', implActivities: [{ id: 'x', label: 'X', roleId: 'ai', hours: 100 }] });
    const r = computeEstimate(est, RC);
    expect(r.implementation.deliveryCost).toBe(100 * 65);
  });
});

describe('AgentOps double-count prevention', () => {
  test('separate AgentOps is excluded from the ABU price, and total recovery is unchanged', () => {
    const bundled = computeEstimate(simpleEstimate({ commercial: { agentOpsBilling: 'bundled' } as never }), RC);
    const separate = computeEstimate(simpleEstimate({ commercial: { agentOpsBilling: 'separate' } as never }), RC);
    expect(separate.abu.price!).toBeCloseTo(1040.625 / 1200 / 0.6, 6);
    expect(separate.agentOpsFee).toBeCloseTo(500 / 0.6, 6);
    expect(bundled.models.abu.mrr).toBeCloseTo(1540.625 / 0.6, 6);
    expect(separate.models.abu.mrr).toBeCloseTo(1540.625 / 0.6, 6);
    expect(separate.models.abu.components.map((c) => c.key)).toEqual(['abu-usage', 'agentops-fee']);
    expect(separate.checks.find((c) => c.id === 'agentops-excluded')?.pass).toBe(true);
  });

  test('every model recovers each cost pool exactly once', () => {
    for (const sample of buildSamples(RC)) {
      const r = computeEstimate(sample, RC);
      for (const m of Object.values(r.models)) {
        expect(m.doubleRecovery, `${sample.name} / ${m.label}`).toBe(false);
        expect(m.unrecovered, `${sample.name} / ${m.label}`).toEqual([]);
      }
    }
  });

  test('hybrid with AgentOps fee: subscription and usage exclude AgentOps', () => {
    const r = computeEstimate(
      simpleEstimate({ commercial: { selectedModel: 'hybrid', hybrid: { subscription: true, usage: 'abu', agentOps: true, gainshare: false } } as never }),
      RC,
    );
    const h = r.models.hybrid;
    expect(h.recovery.agentops).toEqual(['agentops-fee']);
    expect(h.recovery.platform).toEqual(['subscription']);
    expect(h.recovery.consumption).toEqual(['usage']);
    expect(h.mrr).toBeCloseTo(1540.625 / 0.6, 6);
  });
});

describe('commercial terms', () => {
  test('graduated volume tiers', () => {
    const tiers = [
      { upTo: 100, discountPct: 0 },
      { upTo: 200, discountPct: 10 },
      { upTo: null, discountPct: 20 },
    ];
    expect(tieredCharge(d(250), d(2), tiers).toNumber()).toBe(100 * 2 + 100 * 1.8 + 50 * 1.6);
    expect(tieredCharge(d(50), d(2), tiers).toNumber()).toBe(100);
    expect(tieredCharge(d(0), d(2), tiers).toNumber()).toBe(0);
    expect(tieredCharge(d(10), d(2), []).toNumber()).toBe(20);
  });

  test('minimum monthly commitment is a floor on usage charges', () => {
    const r = computeEstimate(simpleEstimate({ commercial: { minMonthlyCommitment: 5000 } as never }), RC);
    expect(r.models.abu.mrr).toBe(5000);
  });

  test('subscription allowance: no overage at baseline, overage once volume exceeds it', () => {
    const r = computeEstimate(simpleEstimate({ volumeGrowthPct: 50 }), RC);
    const sub = r.models.subscription;
    expect(sub.components.find((c) => c.key === 'overage')!.monthly).toBe(0);
    expect(sub.mrr).toBeCloseTo(1540.625 / 0.6, 6);
    // Year 2: 1,500 txns → 1,800 ABUs, 600 above the 1,200 allowance
    const overPrice = (1540.625 / 1200 / 0.6) * 1.15;
    const y2Recurring = (1540.625 / 0.6 + 600 * overPrice) * 12;
    expect(sub.projection[1].recurringRevenue).toBeCloseTo(y2Recurring, 4);
  });

  test('annual escalation applies to prices from year 2', () => {
    const r = computeEstimate(simpleEstimate({ commercial: { escalationPct: 5 } as never }), RC);
    const p = r.models.fixed.projection;
    expect(p[1].recurringRevenue / p[0].recurringRevenue).toBeCloseTo(1.05, 6);
    expect(p[2].recurringRevenue / p[0].recurringRevenue).toBeCloseTo(1.1025, 6);
  });

  test('customer-specific price overrides are honoured', () => {
    const r = computeEstimate(simpleEstimate({ commercial: { abuPriceOverride: 3 } as never }), RC);
    expect(r.abu.price).toBe(3);
    expect(r.models.abu.mrr).toBe(3600);
  });

  test('managed AgentOps: consumption and platform are client pass-through', () => {
    const r = computeEstimate(simpleEstimate(), RC);
    const m = r.models.agentops;
    expect(m.monthlyDeliveryCost).toBe(500);
    expect(m.clientPassThroughMonthly).toBe(1040.625);
    expect(m.mrr).toBeCloseTo(500 / 0.6, 5);
  });
});

describe('client value and ROI', () => {
  test('productivity, cash savings and ROI', () => {
    const r = computeEstimate(simpleEstimate(), RC);
    const v = r.value;
    // manual 1000 × 12 min = 200 h; AI: 800 × 3 + 200 × 12 = 4,800 min = 80 h
    expect(v.manualHours).toBe(200);
    expect(v.aiAssistedHours).toBe(80);
    expect(v.hoursSaved).toBe(120);
    expect(v.productivityPct).toBe(60);
    expect(v.capacityValueMonthly).toBe(3600);
    expect(v.hardSavingsMonthly).toBe(1800);
    const charge = r.selected.mrr;
    const impl = r.implementation.price;
    expect(v.year1Investment).toBeCloseTo(impl + 12 * charge, 3);
    expect(v.roiYear1!).toBeCloseTo(((1800 * 12 - (impl + 12 * charge)) / (impl + 12 * charge)) * 100, 3);
    // Monthly cash benefit (1,800) is below the monthly charge, so there is no payback.
    expect(charge).toBeGreaterThan(1800);
    expect(v.paybackMonths).toBeNull();
    const full = computeEstimate(simpleEstimate({ value: { cashRealisationPct: 100 } as never }), RC);
    expect(full.value.paybackMonths!).toBeCloseTo(full.implementation.price / (3600 - full.selected.mrr), 2);
  });

  test('productivity is not cash: zero cash realisation means zero financial benefit', () => {
    const r = computeEstimate(simpleEstimate({ value: { cashRealisationPct: 0 } as never }), RC);
    expect(r.value.capacityValueMonthly).toBeGreaterThan(0);
    expect(r.value.financialBenefitMonthly).toBe(0);
    expect(r.value.paybackMonths).toBeNull();
  });

  test('validated and assumed benefits are separated', () => {
    const r = computeEstimate(
      simpleEstimate({ value: { cashRealisationPct: 50, cashRealisationStatus: 'assumed', costAvoidanceAnnual: 12000, costAvoidanceStatus: 'validated', revenueUpliftAnnual: 0, revenueUpliftStatus: 'assumed' } }),
      RC,
    );
    expect(r.value.validatedBenefitMonthly).toBe(1000);
    expect(r.value.assumedBenefitMonthly).toBe(1800);
    expect(r.value.roi3Validated!).toBeLessThan(r.value.roi3!);
  });

  test('SDLC gains are only claimed with a baseline', () => {
    const est = createEstimate({ processId: 'tpl-e2e-agentic-sdlc', industryId: 'technology', currency: 'USD' }, RC);
    est.sdlc!.metrics.mttrHours = { baseline: null, improvementPct: 30, source: 'none' };
    const r = computeEstimate(est, RC);
    const mttr = r.sdlc!.metrics.find((m) => m.key === 'mttrHours')!;
    expect(mttr.claimed).toBe(false);
    expect(mttr.projected).toBeNull();
    const dep = r.sdlc!.metrics.find((m) => m.key === 'deploymentsPerMonth')!;
    expect(dep.projected).toBeCloseTo(dep.baseline! * 1.25, 5);
  });
});

describe('edge cases', () => {
  test('zero volume: no crash, undefined unit prices, fixed costs remain', () => {
    const r = computeEstimate(simpleEstimate({ monthlyVolume: 0 }), RC);
    expect(r.volume.weightedAbus).toBe(0);
    expect(r.abu.price).toBeNull();
    expect(r.abu.costPerAbuFullyLoaded).toBeNull();
    expect(r.acu.price).toBeNull();
    expect(r.operating.total).toBe(1500);
    expect(r.issues.some((i) => i.field === 'monthlyVolume')).toBe(true);
    expect(r.checks.every((c) => c.pass)).toBe(true);
  });

  test('zero success rate: no ABUs, warning raised', () => {
    const r = computeEstimate(simpleEstimate({ successRate: 0 }), RC);
    expect(r.volume.weightedAbus).toBe(0);
    expect(r.issues.some((i) => i.field === 'successRate')).toBe(true);
  });

  test('every process template computes and reconciles in every industry', () => {
    for (const p of PROCESSES) {
      const ind = p.industries === 'all' ? INDUSTRIES[0].id : p.industries[0];
      const r = computeEstimate(createEstimate({ processId: p.id, industryId: ind, currency: 'INR' }, RC), RC);
      const failed = r.checks.filter((c) => !c.pass);
      expect(failed, `${p.name}: ${failed.map((f) => f.label).join(', ')}`).toEqual([]);
      expect(r.operating.total).toBeGreaterThan(0);
      expect(r.issues.filter((i) => i.level === 'error')).toEqual([]);
    }
  });

  test('all 12 sample projects compute and reconcile', () => {
    const samples = buildSamples(RC);
    expect(samples).toHaveLength(12);
    for (const s of samples) {
      const r = computeEstimate(s, RC);
      expect(r.checks.filter((c) => !c.pass), s.name).toEqual([]);
      expect(r.abu.price, s.name).not.toBeNull();
    }
  });

  test('currency conversion keeps results equivalent', () => {
    const usd = simpleEstimate({ infraOverride: null, agentOpsOverride: null, observabilityOverride: null });
    const inr = convertEstimateCurrency(usd, 'INR', RC);
    const a = computeEstimate(usd, RC);
    const b = computeEstimate({ ...inr, currency: 'INR' }, RC);
    expect(b.operating.pools.consumption).toBeCloseTo(a.operating.pools.consumption * RC.fx.INR, 4);
  });

  test('multi-agent SDLC workflow composition sums stage profiles', () => {
    const w = composeWorkflow(['sdlc-code-generation', 'sdlc-code-review'])!;
    expect(w.agents).toBe(2);
    expect(w.callsPerTxn).toBe(26);
  });
});

describe('scenario simulator', () => {
  test('baseline scenario reproduces the estimate exactly', () => {
    for (const s of buildSamples(RC).slice(0, 4)) {
      const base = computeEstimate(s, RC);
      const run = runScenario(s, base, presetLevers('baseline', s), RC);
      expect(run.repriced.operating.total).toBe(base.operating.total);
      expect(run.repriced.abu.price).toBe(base.abu.price);
      expect(run.locked.selected.mrr).toBeCloseTo(base.selected.mrr, 6);
      expect(run.locked.selected.recurringMargin!).toBeCloseTo(base.selected.recurringMargin!, 6);
    }
  });

  test('locked prices: higher cost erodes margin; repriced restores target margin', () => {
    const s = simpleEstimate();
    const base = computeEstimate(s, RC);
    const run = runScenario(s, base, { tokenFactor: 3 }, RC);
    expect(run.locked.abu.price).toBe(base.abu.price);
    expect(run.locked.selected.recurringMargin!).toBeLessThan(40);
    expect(run.repriced.selected.recurringMargin!).toBeCloseTo(40, 6);
    expect(run.repriced.abu.price!).toBeGreaterThan(base.abu.price!);
  });

  test('optimized costs less than baseline, stress costs more', () => {
    const s = buildSamples(RC)[0];
    const base = computeEstimate(s, RC);
    const opt = runScenario(s, base, presetLevers('optimized', s), RC);
    const stress = runScenario(s, base, presetLevers('stress', s), RC);
    expect(opt.repriced.abu.costPerAbuFullyLoaded!).toBeLessThan(base.abu.costPerAbuFullyLoaded!);
    expect(stress.repriced.abu.costPerAbuFullyLoaded!).toBeGreaterThan(base.abu.costPerAbuFullyLoaded!);
  });
});
