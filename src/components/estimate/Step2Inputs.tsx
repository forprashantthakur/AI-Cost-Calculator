'use client';

import { useStore } from '@/store/store';
import { CURRENCIES } from '@/data/rateCard';
import { getProcess } from '@/data/catalog';
import { convertEstimateCurrency } from '@/data/templates';
import { storiesPerMonth } from '@/engine';
import type { Complexity, CurrencyCode, EstimateInputs, EstimateResults, HostingKey, SdlcInputs, SlaKey } from '@/engine/types';
import { currencyMeta, money, num } from '@/lib/format';
import { Callout, Card, CardTitle, Collapsible, FieldShell, NumberField, Segmented, SelectField, TextField, Toggle, Badge } from '@/components/ui';

type Up = (fn: (e: EstimateInputs) => EstimateInputs) => void;

export function Step2Inputs({ est, res, update }: { est: EstimateInputs; res: EstimateResults; update: Up }) {
  const rc = useStore((s) => s.rateCard);
  const proc = getProcess(est.processId);
  const sym = currencyMeta(est.currency).symbol.trim();
  const set = <K extends keyof EstimateInputs>(k: K) => (v: EstimateInputs[K]) => update((e) => ({ ...e, [k]: v }));
  const num0 = <K extends keyof EstimateInputs>(k: K) => (v: number | null) => update((e) => ({ ...e, [k]: v ?? 0 }));
  const isSdlc = !!est.sdlc;
  const derived = isSdlc && est.sdlc!.deriveVolume && !!proc.sdlcDriver;
  const line = (k: string) => res.operating.lines.find((l) => l.key === k)?.monthly ?? 0;

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle sub="Ten inputs are enough for a first estimate. Values are prefilled from the process template and are illustrative.">Basic inputs</CardTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="1. Estimate / project name" value={est.name} onChange={set('name')} />
          <TextField label="Client name" value={est.client} onChange={set('client')} placeholder="Client or prospect" />
          <SelectField
            label="10. Currency"
            tip="Changing currency converts every monetary input at the rate card FX rate."
            value={est.currency}
            onChange={(c: CurrencyCode) => update((e) => convertEstimateCurrency(e, c, rc))}
            options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.label}` }))}
          />
          <div>
            <NumberField
              label={`2. Monthly ${isSdlc ? 'work items' : 'transaction volume'}`}
              tip={isSdlc ? proc.sdlcDriver?.label : 'Business transactions submitted to the agent each month, including those it will not complete.'}
              value={derived ? res.volume.submitted : est.monthlyVolume}
              onChange={num0('monthlyVolume')}
              min={0}
              disabled={derived}
              hint={derived ? 'Derived from SDLC drivers below' : undefined}
            />
          </div>
          <NumberField label="3. Number of AI agents" value={est.agents} onChange={num0('agents')} min={0} step={1} tip="Drives AgentOps, infrastructure and observability cost." />
          <FieldShell label="4. Process complexity" tip="Sets the ABU weight (Low 1.0, Medium 1.5, High 3.0) and the resource effort multiplier. Use the complexity mix under Advanced for a distribution.">
            <Segmented<Complexity>
              value={est.complexity}
              onChange={(v) => update((e) => ({ ...e, complexity: v, useComplexityMix: false }))}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]}
            />
            {est.useComplexityMix && <div className="mt-1 text-[11px] text-warn">Complexity mix is active (Advanced)</div>}
          </FieldShell>
          <NumberField
            label={`5. Expected AI ${isSdlc ? 'acceptance' : 'completion success'} rate`}
            tip={isSdlc ? 'Share of AI-produced work (e.g. AI-generated code) accepted after human validation. Rejected work falls back to manual effort.' : 'Share of unique transactions the agent completes to the acceptance criteria. The rest fall back to manual handling.'}
            value={est.successRate}
            onChange={num0('successRate')}
            min={0}
            max={100}
            suffix="%"
          />
          <NumberField label="6. Current manual time per transaction" value={est.manualMinutes} onChange={num0('manualMinutes')} min={0} suffix="min" />
          <NumberField label="7. Current employee cost per hour" tip="Fully loaded cost of the people doing the work today." value={est.employeeCostPerHour} onChange={num0('employeeCostPerHour')} min={0} prefix={sym} />
          <NumberField
            label={isSdlc ? '8. AI-assisted time incl. human validation' : '8. AI-assisted manual time per transaction'}
            tip="Residual human effort for a transaction the agent completes (review, exceptions, approvals)."
            value={est.aiAssistedMinutes}
            onChange={num0('aiAssistedMinutes')}
            min={0}
            suffix="min"
          />
          <NumberField label="9. Target provider gross margin" value={est.targetMargin} onChange={num0('targetMargin')} min={0} max={95} suffix="%" tip="Price = cost ÷ (1 − margin). Capped at 95%." />
        </div>
      </Card>

      {isSdlc && <SdlcPanel est={est} res={res} update={update} />}

      <Collapsible
        title="Advanced settings — AI workload & operations"
        sub="Tokens, documents, tools, retries, human review, hosting and SLA. Defaults come from the process template and the rate card."
        badge={<Badge>Optional</Badge>}
      >
        <div className="space-y-6">
          <Group title="AI model and tokens">
            <SelectField
              label="LLM provider and model"
              tip="Rates come from Settings. Illustrative tiers are placeholders, not vendor quotes."
              value={est.modelId}
              onChange={set('modelId')}
              options={rc.models.map((m) => ({ value: m.id, label: `${m.provider} — ${m.name}${m.illustrative ? ' (illustrative)' : ''}` }))}
              className="sm:col-span-2"
            />
            <NumberField label="Model calls per transaction" value={est.callsPerTxn} onChange={num0('callsPerTxn')} min={0} />
            <NumberField label="Input tokens per call" value={est.inputTokensPerCall} onChange={num0('inputTokensPerCall')} min={0} />
            <NumberField label="Output tokens per call" value={est.outputTokensPerCall} onChange={num0('outputTokensPerCall')} min={0} />
            <NumberField label="Cached input tokens" tip="Share of input tokens served from the prompt cache. Billed once at the cached rate — never also at the full rate." value={est.cachedInputPct} onChange={num0('cachedInputPct')} min={0} max={100} suffix="%" />
          </Group>
          <Group title="Documents, retrieval and tools">
            <NumberField label="OCR pages per transaction" tip="Charged once per submitted document; retries reuse the extracted text." value={est.ocrPagesPerTxn} onChange={num0('ocrPagesPerTxn')} min={0} />
            <NumberField label="Vector searches per transaction" value={est.ragQueriesPerTxn} onChange={num0('ragQueriesPerTxn')} min={0} />
            <NumberField label="Embedding tokens per transaction" value={est.embeddingTokensPerTxn} onChange={num0('embeddingTokensPerTxn')} min={0} />
            <NumberField label="Tool / API calls per transaction" value={est.toolCallsPerTxn} onChange={num0('toolCallsPerTxn')} min={0} />
            <NumberField
              label="Orchestration cost per agent run"
              tip="Leave empty to use the rate card."
              value={est.orchestrationCostPerRunOverride}
              onChange={set('orchestrationCostPerRunOverride')}
              nullable
              min={0}
              prefix={sym}
              placeholder={`Auto: ${(rc.orchestrationPerRun * (rc.fx[est.currency] ?? 1)).toFixed(4)}`}
            />
          </Group>
          <Group title="Quality, retries and human review">
            <NumberField label="Retry rate" tip="Extra executions as a share of submissions. Their cost is included and allocated to accepted outcomes." value={est.retryRatePct} onChange={num0('retryRatePct')} min={0} suffix="%" />
            <NumberField label="Duplicate submission rate" tip="Duplicates are processed (cost) but never billed as a second ABU." value={est.duplicateRatePct} onChange={num0('duplicateRatePct')} min={0} max={100} suffix="%" />
            <NumberField label="Human review rate" tip="Provider-side human-in-the-loop review of agent output." value={est.humanReviewRatePct} onChange={num0('humanReviewRatePct')} min={0} max={100} suffix="%" />
            <NumberField label="Review time per reviewed item" value={est.humanReviewMinutes} onChange={num0('humanReviewMinutes')} min={0} suffix="min" />
            <NumberField label="Human review cost per hour" value={est.humanReviewCostPerHour} onChange={num0('humanReviewCostPerHour')} min={0} prefix={sym} />
            <NumberField label="AI quality / evaluation cost per month" tip="Evaluation compute, golden-set runs, LLM-as-judge." value={est.evalCostMonthly} onChange={num0('evalCostMonthly')} min={0} prefix={sym} />
          </Group>
          <Group title="Platform, hosting and service levels">
            <SelectField<HostingKey>
              label="Hosting environment"
              tip="Multiplies infrastructure cost (Settings)."
              value={est.hosting}
              onChange={set('hosting')}
              options={[
                { value: 'shared', label: `Shared cloud (×${rc.hostingMultipliers.shared})` },
                { value: 'private', label: `Dedicated private cloud (×${rc.hostingMultipliers.private})` },
                { value: 'onprem', label: `Client-hosted / on-premises (×${rc.hostingMultipliers.onprem})` },
              ]}
            />
            <SelectField<SlaKey>
              label="Service level requirement"
              tip="Multiplies AgentOps cost (Settings)."
              value={est.sla}
              onChange={set('sla')}
              options={[
                { value: 'standard', label: `Standard — business hours (×${rc.slaMultipliers.standard})` },
                { value: 'enhanced', label: `Enhanced — extended hours (×${rc.slaMultipliers.enhanced})` },
                { value: 'premium', label: `Premium — 24×7 (×${rc.slaMultipliers.premium})` },
              ]}
            />
            <NumberField label="Infrastructure cost / month" tip="Leave empty for rate card: base + per agent × hosting factor." value={est.infraOverride} onChange={set('infraOverride')} nullable min={0} prefix={sym} placeholder={`Auto: ${money(line('infra'), est.currency)}`} />
            <NumberField label="Monitoring tooling / month" value={est.observabilityOverride} onChange={set('observabilityOverride')} nullable min={0} prefix={sym} placeholder={`Auto: ${money(line('observability'), est.currency)}`} />
            <NumberField label="AgentOps cost / month" tip="Leave empty to build it from the AgentOps rate card (step 3)." value={est.agentOpsOverride} onChange={set('agentOpsOverride')} nullable min={0} prefix={sym} placeholder={`Auto: ${money(line('agentops'), est.currency)}`} />
            <NumberField label="Other attributable cost / month" value={est.otherMonthly} onChange={num0('otherMonthly')} min={0} prefix={sym} />
          </Group>
          <Group title="Growth and complexity distribution">
            <NumberField label="Annual volume growth" tip="Applied to years 2 and 3 of the projection." value={est.volumeGrowthPct} onChange={num0('volumeGrowthPct')} suffix="%" />
            <div className="sm:col-span-2 lg:col-span-3">
              <Toggle checked={est.useComplexityMix} onChange={set('useComplexityMix')} label="Use a complexity distribution instead of a single complexity" />
              {est.useComplexityMix && (
                <div className="mt-3 grid max-w-xl grid-cols-3 gap-3">
                  {(['low', 'medium', 'high'] as const).map((c) => (
                    <NumberField
                      key={c}
                      label={`${c[0].toUpperCase()}${c.slice(1)} (weight ${rc.abuWeights[c]})`}
                      value={est.complexityMix[c]}
                      onChange={(v) => update((e) => ({ ...e, complexityMix: { ...e.complexityMix, [c]: v ?? 0 } }))}
                      min={0}
                      max={100}
                      suffix="%"
                    />
                  ))}
                  <div className="col-span-3 text-[11px] text-muted">
                    Total {num(est.complexityMix.low + est.complexityMix.medium + est.complexityMix.high)}% (normalised) · blended ABU weight {res.volume.abuWeight.toFixed(3)}
                  </div>
                </div>
              )}
            </div>
          </Group>
        </div>
      </Collapsible>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">{title}</div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function SdlcPanel({ est, res, update }: { est: EstimateInputs; res: EstimateResults; update: Up }) {
  const s = est.sdlc!;
  const proc = getProcess(est.processId);
  const sym = currencyMeta(est.currency).symbol.trim();
  const setS = <K extends keyof SdlcInputs>(k: K) => (v: number | null) => update((e) => ({ ...e, sdlc: { ...e.sdlc!, [k]: v ?? 0 } }));
  // A render helper (not a component), so inputs keep focus while typing.
  const F = (k: keyof SdlcInputs, label: string, tip?: string) => <NumberField key={k} label={label} tip={tip} value={s[k] as number} onChange={setS(k)} min={0} />;
  return (
    <Collapsible
      defaultOpen
      title="IT SDLC engineering inputs"
      sub="Engineering drivers for SDLC agents. Monthly volume can be derived from the driver that matches this agent's ABU."
      badge={<Badge tone="brand">SDLC</Badge>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {F('developers', 'Developers', 'Used for per-developer subscriptions.')}
        {F('teams', 'Engineering teams')}
        {F('sprintsPerMonth', 'Sprints per month')}
        {F('storiesPerSprint', 'User stories per sprint (per team)')}
        {F('avgStoryPoints', 'Average story points', 'Context only — story points are never billable ABUs.')}
        {F('prsPerMonth', 'Pull requests / month')}
        {F('codeReviewsPerMonth', 'Code reviews / month')}
        {F('testCasesPerMonth', 'Test cases / month')}
        {F('defectsPerMonth', 'Defects / month')}
        {F('buildsPerMonth', 'Build executions / month')}
        {F('deploymentsPerMonth', 'Deployments / month')}
        {F('ticketsPerMonth', 'Support tickets / month')}
        <NumberField label="CI/CD and dev environment cost / month" tip="Incremental pipeline and environment cost attributable to the agents." value={s.cicdMonthlyCost} onChange={setS('cicdMonthlyCost')} min={0} prefix={sym} className="sm:col-span-2" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg bg-canvas px-4 py-3 text-sm">
        <Toggle checked={s.deriveVolume} onChange={(v) => update((e) => ({ ...e, sdlc: { ...e.sdlc!, deriveVolume: v }, monthlyVolume: v ? e.monthlyVolume : res.volume.submitted }))} label="Derive monthly volume from SDLC drivers" />
        <span className="text-muted">
          {proc.sdlcDriver ? (
            <>
              Driver: <strong className="text-ink">{proc.sdlcDriver.label}</strong> → {num(res.sdlc?.derivedVolume ?? 0, 1)} items / month
            </>
          ) : (
            'No driver for a custom process — enter volume manually.'
          )}
        </span>
        <span className="text-muted">
          Stories / month: <strong className="text-ink">{num(storiesPerMonth(s))}</strong> · story points: {num(res.sdlc?.storyPointsPerMonth ?? 0)} (not billable)
        </span>
      </div>
      <div className="mt-3">
        <Callout tone="info">AI-generated code acceptance rate and human validation effort are the success rate (5) and AI-assisted time (8) in Basic inputs.</Callout>
      </div>
    </Collapsible>
  );
}

