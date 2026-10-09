'use client';

import { useState } from 'react';
import { Workflow, Check } from 'lucide-react';
import { useStore } from '@/store/store';
import { CUSTOM_PROCESS_ID, FUNCTIONS, INDUSTRIES, SDLC_STAGE_AGENTS, getProcess, processesFor } from '@/data/catalog';
import { applyProcess, composeWorkflow } from '@/data/templates';
import { REC_CONFIG } from '@/engine/recommend';
import type { EstimateInputs } from '@/engine/types';
import { Badge, Button, Callout, Card, CardTitle, FieldShell, Select, TextField, Toggle, cx } from '@/components/ui';

export function Step1Process({ est, update }: { est: EstimateInputs; update: (fn: (e: EstimateInputs) => EstimateInputs) => void }) {
  const rc = useStore((s) => s.rateCard);
  const [showAll, setShowAll] = useState(false);
  const [stages, setStages] = useState<string[]>(est.workflowStages);
  const proc = getProcess(est.processId);
  const list = processesFor(est.industryId, est.functionId, showAll);
  const isSdlc = est.functionId === 'sdlc';

  const groups = isSdlc
    ? [
        { label: 'Preconfigured SDLC templates', options: list.filter((p) => p.kind === 'sdlc-template').map((p) => ({ value: p.id, label: p.name })) },
        { label: 'Single-stage SDLC agents', options: list.filter((p) => p.kind === 'sdlc-agent').map((p) => ({ value: p.id, label: `${p.sdlcStage} — ${p.name}` })) },
        { label: 'Other', options: [{ value: CUSTOM_PROCESS_ID, label: 'Custom process…' }] },
      ]
    : [
        { label: 'Cross-industry processes', options: list.filter((p) => p.industries === 'all').map((p) => ({ value: p.id, label: p.name })) },
        { label: 'Industry-specific processes', options: list.filter((p) => p.industries !== 'all').map((p) => ({ value: p.id, label: p.name })) },
        { label: 'Other', options: [{ value: CUSTOM_PROCESS_ID, label: 'Custom process…' }] },
      ].filter((g) => g.options.length);

  const selectProcess = (processId: string, functionId = est.functionId) => update((e) => applyProcess(e, processId, functionId, rc));

  const changeFunction = (fn: string) => {
    const first = processesFor(est.industryId, fn, showAll)[0];
    selectProcess(first?.id ?? CUSTOM_PROCESS_ID, fn);
    setStages(first?.stages ?? []);
  };

  const changeIndustry = (ind: string) => {
    update((e) => ({ ...e, industryId: ind }));
    const valid = processesFor(ind, est.functionId, showAll).some((p) => p.id === est.processId);
    if (!valid && est.processId !== CUSTOM_PROCESS_ID) {
      const first = processesFor(ind, est.functionId, showAll)[0];
      update((e) => applyProcess({ ...e, industryId: ind }, first?.id ?? CUSTOM_PROCESS_ID, e.functionId, rc));
    }
  };

  const rec = REC_CONFIG[proc.recommendation];

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle sub="Three dependent selections. Each process comes with illustrative, editable assumptions.">Industry, function and business process</CardTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FieldShell label="Industry">
            <Select value={est.industryId} onChange={changeIndustry} options={INDUSTRIES.map((i) => ({ value: i.id, label: i.name }))} ariaLabel="Industry" />
          </FieldShell>
          <FieldShell label="Business function">
            <Select value={est.functionId} onChange={changeFunction} options={FUNCTIONS.map((f) => ({ value: f.id, label: f.name }))} ariaLabel="Business function" />
          </FieldShell>
          <FieldShell label="Business process" hint={`${list.length} processes available`}>
            <Select
              value={est.processId}
              onChange={(v) => {
                selectProcess(v);
                setStages(getProcess(v).stages ?? []);
              }}
              groups={groups}
              ariaLabel="Business process"
            />
          </FieldShell>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Toggle checked={showAll} onChange={setShowAll} label="Show processes from all industries" tip="Industry-specific processes (e.g. KYC, Claims Processing) are listed for their industries by default." />
          {proc.industries === 'all' ? <Badge>Cross-industry template</Badge> : <Badge tone="info">Industry-specific template</Badge>}
        </div>
        {est.processId === CUSTOM_PROCESS_ID && (
          <div className="mt-4">
            <TextField label="Custom process name" value={est.customProcessName} onChange={(v) => update((e) => ({ ...e, customProcessName: v }))} placeholder="e.g. Vendor master data cleansing" />
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold">{est.customProcessName || proc.name}</h2>
              {proc.agentName && <Badge tone="brand">{proc.agentName}</Badge>}
              {proc.sdlcStage && <Badge>{proc.sdlcStage}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted">{proc.description}</p>
          </div>
          <div className="rounded-lg border border-brand/20 bg-brand-50 px-4 py-3 text-sm lg:max-w-xs">
            <div className="text-[11px] font-medium tracking-wide text-brand uppercase">Suggested commercial model</div>
            <div className="mt-0.5 font-semibold text-ink">{rec.label}</div>
            <div className="mt-1 text-xs text-ink-2">A starting point — refined in step 4 using volume, SLA, hosting and client preference.</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="ABU — accepted unit of business work"
            tip="The outcome you bill for. It must be objectively countable and accepted by the client."
            value={est.abuUnit}
            onChange={(v) => update((e) => ({ ...e, abuUnit: v }))}
          />
          <FieldShell label="Acceptance criteria" tip="When a transaction counts as an accepted ABU. Each unique transaction counts once, regardless of retries.">
            <textarea
              className="min-h-[72px] w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
              value={est.acceptanceCriteria}
              onChange={(ev) => update((e) => ({ ...e, acceptanceCriteria: ev.target.value }))}
            />
          </FieldShell>
        </div>
        {isSdlc && (
          <div className="mt-4">
            <Callout tone="info">Lines of code, generated suggestions and story points are never treated as billable ABUs. Only accepted engineering outcomes (e.g. a merged, reviewed development task) count.</Callout>
          </div>
        )}
      </Card>

      {isSdlc && (
        <Card>
          <CardTitle
            sub="Combine single-stage agents into a multi-agent workflow. Their token and tool profiles are summed into the advanced inputs (all remain editable)."
            tip="Each selected stage adds one AI agent. The workflow's ABU stays the outcome defined above."
          >
            <span className="inline-flex items-center gap-2">
              <Workflow size={16} className="text-brand" /> Multi-agent SDLC workflow
            </span>
          </CardTitle>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {SDLC_STAGE_AGENTS.map((a) => {
              const on = stages.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setStages(on ? stages.filter((s) => s !== a.id) : [...stages, a.id])}
                  className={cx(
                    'flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    on ? 'border-brand/50 bg-brand-50' : 'border-line hover:border-brand/30',
                  )}
                >
                  <span className={cx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-brand bg-brand text-white' : 'border-line')}>
                    {on && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span>
                    <span className="block font-medium text-ink">{a.name}</span>
                    <span className="block text-[11px] text-muted">
                      {a.sdlcStage} · ABU: {a.abuUnit}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              disabled={!stages.length}
              onClick={() => {
                const w = composeWorkflow(stages);
                if (w) update((e) => ({ ...e, ...w }));
              }}
            >
              Apply {stages.length}-agent workflow
            </Button>
            <span className="text-xs text-muted">
              Current workflow: {est.workflowStages.length ? est.workflowStages.map((s) => getProcess(s).name.replace(' Agent', '')).join(' → ') : 'single agent'}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
