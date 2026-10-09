'use client';

import { Sparkles, Check } from 'lucide-react';
import type { EstimateInputs, EstimateResults, ModelKey } from '@/engine/types';
import { MODEL_KEYS } from '@/engine/types';
import { moneyCompact, pctFmt, titleCase } from '@/lib/format';
import { Badge, Button, Card, cx } from '@/components/ui';

type Up = (fn: (e: EstimateInputs) => EstimateInputs) => void;

export function RecommendationCard({ res, est, update, compact = false }: { res: EstimateResults; est: EstimateInputs; update?: Up; compact?: boolean }) {
  const rec = res.recommendation;
  const overridden = est.commercial.selectedModel != null && est.commercial.selectedModel !== rec.model;
  return (
    <Card className="border-brand/30 bg-gradient-to-br from-brand-50/70 to-surface">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-brand uppercase">
            <Sparkles size={14} /> Recommended commercial structure
          </div>
          <div className="mt-1 text-xl font-semibold text-ink">{rec.label}</div>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{rec.explanation}</p>
          {!compact && (
            <p className="mt-2 text-xs text-muted">
              Alternatives worth considering: {rec.alternatives.join(' · ')}. Recommendations are starting points, not mandatory pricing rules.
            </p>
          )}
        </div>
        {!compact && (
          <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-line bg-surface p-3 text-xs lg:w-80">
            {rec.factors.map((f) => (
              <div key={f.label}>
                <dt className="text-muted">{f.label}</dt>
                <dd className="font-medium text-ink">{titleCase(f.value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {overridden && update && (
        <div className="mt-3 flex items-center gap-3 text-xs text-warn">
          You selected {res.models[est.commercial.selectedModel!].label} instead.
          <Button size="sm" variant="ghost" onClick={() => update((e) => ({ ...e, commercial: { ...e.commercial, selectedModel: null } }))}>
            Use recommended
          </Button>
        </div>
      )}
    </Card>
  );
}

export function ModelPicker({ res, est, update }: { res: EstimateResults; est: EstimateInputs; update: Up }) {
  const cur = res.currency;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {MODEL_KEYS.map((k: ModelKey) => {
        const m = res.models[k];
        const sel = res.selectedModel === k;
        const rec = res.recommendation.model === k;
        const neg = (m.recurringMargin ?? 0) < 0;
        return (
          <button
            key={k}
            type="button"
            onClick={() => update((e) => ({ ...e, commercial: { ...e.commercial, selectedModel: k === res.recommendation.model ? null : k } }))}
            className={cx(
              'relative rounded-xl border p-4 text-left transition-all',
              sel ? 'border-brand bg-brand-50/60 ring-2 ring-brand/20' : 'border-line bg-surface hover:border-brand/40',
            )}
            aria-pressed={sel}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-ink">{m.label}</div>
                <div className="text-[11px] text-muted">{m.structureLabel}</div>
              </div>
              {sel ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                  <Check size={12} strokeWidth={3} />
                </span>
              ) : rec ? (
                <Badge tone="brand">Recommended</Badge>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted">Monthly charge</div>
                <div className="num text-sm font-semibold text-ink">{moneyCompact(m.mrr, cur)}</div>
              </div>
              <div>
                <div className="text-muted">Recurring margin</div>
                <div className={cx('num text-sm font-semibold', neg ? 'text-bad' : 'text-ink')}>{pctFmt(m.recurringMargin)}</div>
              </div>
              <div>
                <div className="text-muted">Year-1 revenue</div>
                <div className="num font-medium text-ink-2">{moneyCompact(m.annualRevenue, cur)}</div>
              </div>
              <div>
                <div className="text-muted">3-year GP</div>
                <div className="num font-medium text-ink-2">{moneyCompact(m.threeYear.grossProfit, cur)}</div>
              </div>
            </div>
            {rec && sel && <Badge tone="brand" className="mt-2">Recommended</Badge>}
          </button>
        );
      })}
    </div>
  );
}
