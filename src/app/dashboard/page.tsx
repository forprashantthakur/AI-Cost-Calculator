'use client';

import { FileDown, FileSpreadsheet, Pencil, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useStore } from '@/store/store';
import { useEstimate } from '@/lib/useEstimate';
import { getProcess, industryName, functionName } from '@/data/catalog';
import { money, moneyCompact, months, num, pctFmt, unitPrice } from '@/lib/format';
import { TIPS } from '@/lib/tips';
import { NoEstimate } from '@/components/Shell';
import { Badge, Button, Callout, Card, CardTitle, PageHeader, Stat, Td, Th } from '@/components/ui';
import { CostLinesBar, ModelCompareChart, PoolDonut, POOL_META, ProjectionChart, ValueChart } from '@/components/charts';
import { RecommendationCard } from '@/components/pricing';
import { exportExcel, exportPdf } from '@/lib/export/download';
import { MODEL_KEYS } from '@/engine/types';

export default function DashboardPage() {
  const { est, res, update } = useEstimate();
  const rc = useStore((s) => s.rateCard);
  const log = useStore((s) => s.log);
  if (!est || !res) return <NoEstimate />;
  const cur = res.currency;
  const proc = getProcess(est.processId);
  const sel = res.selected;
  const v = res.value;
  const failed = res.checks.filter((c) => !c.pass);
  const warnings = res.issues.filter((i) => i.level !== 'info');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard — pricing and business value summary"
        title={est.name}
        sub={
          <>
            {est.client && <span className="font-medium text-ink-2">{est.client} · </span>}
            {est.customProcessName || proc.name} · {functionName(est.functionId)} · {industryName(est.industryId)} · {num(res.volume.submitted)} transactions / month · {cur}
          </>
        }
        actions={
          <>
            <Button size="sm" href="/estimate/">
              <Pencil size={14} /> Edit inputs
            </Button>
            <Button size="sm" onClick={() => exportPdf('estimate', est, res, rc).then(() => log('Exported PDF', `Pricing Estimate — ${est.name}`))}>
              <FileDown size={14} /> Pricing estimate PDF
            </Button>
            <Button size="sm" variant="primary" onClick={() => exportExcel(est, res, rc).then(() => log('Exported Excel', est.name))}>
              <FileSpreadsheet size={14} /> Excel workbook
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="1 · Implementation price" value={moneyCompact(res.implementation.price, cur)} sub={`One-time · delivery cost ${moneyCompact(res.implementation.deliveryCost, cur)} at ${pctFmt(res.implementation.marginPct, 0)} margin`} tip={TIPS.implementationPrice} />
        <Stat label="2 · Monthly operating cost" value={moneyCompact(res.operating.total, cur)} sub={`${moneyCompact(res.operating.annual, cur)} per year · ${unitPrice(res.operating.perSubmittedTxn, cur)} per transaction`} tip={TIPS.monthlyCost} />
        <Stat label="3 · Cost per successful ABU" value={unitPrice(res.abu.costPerAbuFullyLoaded, cur)} sub={`${num(res.abu.weighted)} accepted weighted ABUs / month`} tip={TIPS.costPerAbu} />
        <Stat
          label="4 · Recommended ABU / ACU price"
          value={
            <span>
              {unitPrice(res.abu.price, cur)} <span className="text-base font-medium text-muted">/ ABU</span>
            </span>
          }
          sub={`${unitPrice(res.acu.price, cur)} per ACU · ${res.agentOpsBilling === 'separate' ? `+ AgentOps fee ${moneyCompact(res.agentOpsFee, cur)}/mo` : 'AgentOps bundled'}`}
          tip={TIPS.abuPrice}
          tone="good"
          emphasis
        />
        <Stat label="5 · Estimated monthly customer charge" value={moneyCompact(sel.mrr, cur)} sub={`${sel.label}: ${sel.structureLabel}`} tip={TIPS.monthlyCharge} emphasis />
        <Stat
          label="6 · Provider gross margin"
          value={pctFmt(sel.recurringMargin)}
          sub={`Gross profit ${moneyCompact(sel.monthlyGrossProfit, cur)} / month · year 1 incl. implementation ${pctFmt(sel.annualGrossMargin)}`}
          tip={TIPS.grossMargin}
          tone={(sel.recurringMargin ?? 0) < 0 ? 'bad' : 'good'}
        />
      </div>

      {(failed.length > 0 || warnings.length > 0) && (
        <div className="space-y-2">
          {failed.map((c) => (
            <Callout key={c.id} tone="bad">
              Reconciliation failed: {c.label} ({c.detail})
            </Callout>
          ))}
          {warnings.map((w, i) => (
            <Callout key={i} tone={w.level === 'error' ? 'bad' : 'warn'}>
              {w.message}
            </Callout>
          ))}
        </div>
      )}

      <RecommendationCard res={res} est={est} update={update} compact />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardTitle tip={TIPS.monthlyCost} sub="Each cost is computed once, then grouped into cost pools.">
            Monthly cost breakdown
          </CardTitle>
          <CostLinesBar res={res} />
        </Card>
        <Card>
          <CardTitle sub="Share of monthly delivery cost by pool">Cost pools</CardTitle>
          <PoolDonut res={res} />
          <ul className="mt-3 space-y-1.5 text-sm">
            {(Object.keys(POOL_META) as (keyof typeof POOL_META)[]).map((p) => (
              <li key={p} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-ink-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: POOL_META[p].color }} />
                  {POOL_META[p].label}
                </span>
                <span className="num font-medium">{money(res.operating.pools[p], cur)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardTitle sub="Monthly revenue, delivery cost and recurring margin under each of the seven commercial models." action={<Button size="sm" href="/compare/">Compare in detail</Button>}>
          Commercial model comparison
        </CardTitle>
        <ModelCompareChart res={res} highlight={res.selectedModel} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <Th>Model</Th>
                <Th right>Monthly charge</Th>
                <Th right>Annual revenue</Th>
                <Th right>Annual gross profit</Th>
                <Th right>Recurring margin</Th>
                <Th right>3-year revenue</Th>
              </tr>
            </thead>
            <tbody>
              {MODEL_KEYS.map((k) => {
                const m = res.models[k];
                return (
                  <tr key={k} className={k === res.selectedModel ? 'bg-brand-50/60' : ''}>
                    <Td className="text-ink">
                      <span className="font-medium">{m.label}</span> {k === res.selectedModel && <Badge tone="brand">Selected</Badge>}
                      <div className="text-[11px] text-muted">{m.structureLabel}</div>
                    </Td>
                    <Td right>{money(m.mrr, cur)}</Td>
                    <Td right>{money(m.annualRevenue, cur)}</Td>
                    <Td right>{money(m.annualGrossProfit, cur)}</Td>
                    <Td right className={(m.recurringMargin ?? 0) < 0 ? 'text-bad' : ''}>
                      {pctFmt(m.recurringMargin)}
                    </Td>
                    <Td right>{money(m.threeYear.revenue, cur)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle tip={TIPS.annualRevenue} sub={`${sel.label} model · contract ${est.commercial.contractYears} year(s) · TCV ${moneyCompact(sel.tcv, cur)}`}>
            Estimated annual revenue and three-year outlook
          </CardTitle>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Stat label="Year-1 revenue" value={moneyCompact(sel.annualRevenue, cur)} />
            <Stat label="3-year revenue" value={moneyCompact(sel.threeYear.revenue, cur)} />
            <Stat label="3-year gross profit" value={moneyCompact(sel.threeYear.grossProfit, cur)} sub={pctFmt(sel.threeYear.grossMargin)} />
          </div>
          <ProjectionChart res={res} modelKey={res.selectedModel} />
        </Card>
        <Card>
          <CardTitle sub="Productivity is shown separately from cash. ROI uses financial benefits only.">Client productivity and financial value</CardTitle>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <Stat label="Hours saved / month" value={num(v.hoursSaved)} sub={`${pctFmt(v.productivityPct)} · ${num(v.redeployableFte, 1)} FTE`} tip={TIPS.productivity} />
            <Stat label="3-year ROI" value={pctFmt(v.roi3, 0)} sub={`Validated only: ${pctFmt(v.roi3Validated, 0)}`} tip={TIPS.roi} tone={(v.roi3 ?? 0) >= 0 ? 'good' : 'bad'} />
            <Stat label="Payback" value={months(v.paybackMonths)} tip={TIPS.payback} />
          </div>
          <ValueChart res={res} />
          <p className="mt-2 text-xs text-muted">
            Annual financial benefit {moneyCompact(v.annualFinancialBenefit, cur)} ({moneyCompact(v.annualValidatedBenefit, cur)} validated) versus {moneyCompact(v.annualClientCharges, cur)} of annual charges.
          </p>
        </Card>
      </div>

      {res.sdlc && (
        <Card>
          <CardTitle sub="Engineering delivery economics. Gains are claimed only where a baseline exists.">IT SDLC economics</CardTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Cost per accepted development task" value={unitPrice(res.sdlc.costPerAcceptedTask, cur)} sub={`Price ${unitPrice(res.sdlc.pricePerAcceptedTask, cur)}`} />
            <Stat label="Cost per release" value={unitPrice(res.sdlc.costPerRelease, cur)} sub={`Price ${unitPrice(res.sdlc.pricePerRelease, cur)}`} />
            <Stat label="Metrics with a baseline" value={`${res.sdlc.metrics.filter((m) => m.claimed).length} / ${res.sdlc.metrics.length}`} />
            <Stat label="Story points / month" value={num(res.sdlc.storyPointsPerMonth)} sub="Context only — not billable" />
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className={failed.length ? 'flex items-center gap-1.5 text-bad' : 'flex items-center gap-1.5 text-brand'}>
            {failed.length ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
            {failed.length ? `${failed.length} reconciliation checks failed` : `All ${res.checks.length} reconciliation checks pass`}
          </span>
          <span className="text-muted">Rate card {res.rateCardVersion} · {rc.models.find((m) => m.id === est.modelId)?.illustrative ? 'illustrative model rates' : 'contracted model rates'}</span>
          <span className="text-muted">Status: {est.status === 'final' ? 'Final' : 'Draft'}</span>
          <span className="text-muted">Last updated {new Date(est.updatedAt).toLocaleString()}</span>
        </div>
      </Card>
    </div>
  );
}
