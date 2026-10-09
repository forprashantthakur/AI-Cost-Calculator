'use client';

import { useEffect, useMemo, useState } from 'react';
import { Lock, Plus, RotateCcw, Save, Trash2, History, Search } from 'lucide-react';
import { useStore, type Role } from '@/store/store';
import { DEFAULT_RATE_CARD, CURRENCIES } from '@/data/rateCard';
import { FUNCTIONS, INDUSTRIES, PROCESSES, functionName } from '@/data/catalog';
import { REC_CONFIG } from '@/engine/recommend';
import type { AcuMethod, Complexity, CurrencyCode, HostingKey, ModelRate, RateCard, SlaKey } from '@/engine/types';
import { dateFmt } from '@/lib/format';
import { Badge, Button, Callout, Card, CardTitle, Collapsible, FieldShell, NumberField, NumberInput, PageHeader, Segmented, Select, SelectField, Td, TextField, TextInput, Th, Toggle } from '@/components/ui';

const ROLE_INFO: Record<Role, string> = {
  consultant: 'Creates and edits estimates. Read-only access to rate cards.',
  commercial: 'Creates estimates and sets customer-specific prices. Read-only rate cards.',
  admin: 'Full access, including rate cards, ACU methodology, weights and templates.',
};

export default function SettingsPage() {
  const s = useStore();
  const [draft, setDraft] = useState<RateCard>(s.rateCard);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => setDraft(s.rateCard), [s.rateCard]);
  const admin = s.role === 'admin';
  const dirty = JSON.stringify(draft) !== JSON.stringify(s.rateCard);
  const ro = !admin;

  const up = (fn: (r: RateCard) => RateCard) => setDraft((d) => fn(structuredClone(d)));
  const num = (path: (r: RateCard) => void) => up((r) => (path(r), r));

  const publish = () => {
    const version = draft.version === s.rateCard.version ? bumpVersion(draft.version) : draft.version;
    const rc: RateCard = { ...draft, version, changeLog: [{ date: new Date().toISOString().slice(0, 10), version, note: note || 'Rate card updated' }, ...draft.changeLog] };
    s.publishRateCard(rc, note || 'Rate card updated');
    setNote('');
    setMsg(`Published ${version}. All estimates now calculate with this rate card; each estimate records the version it was last edited under.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings — pricing rates, templates and assumptions"
        title="Rate card and assumptions"
        sub="Administer the illustrative rate card: LLM and unit rates, infrastructure, AgentOps, FX, ACU methodology, ABU weights, margins and process templates. Publishing creates a new version; history is kept and can be restored."
        actions={
          <>
            <Button size="sm" disabled={!dirty || ro} onClick={() => setDraft(s.rateCard)}>
              Discard changes
            </Button>
            <Button size="sm" variant="primary" disabled={!dirty || ro} onClick={publish}>
              <Save size={14} /> Publish new version
            </Button>
          </>
        }
      />
      {msg && <Callout tone="good">{msg}</Callout>}

      <Card>
        <CardTitle sub="Demonstration access control — enforced in this browser only, not a security boundary.">User role</CardTitle>
        <div className="flex flex-wrap items-center gap-4">
          <Segmented<Role>
            value={s.role}
            onChange={s.setRole}
            options={[
              { value: 'consultant', label: 'Consultant' },
              { value: 'commercial', label: 'Commercial lead' },
              { value: 'admin', label: 'Administrator' },
            ]}
          />
          <span className="text-sm text-muted">{ROLE_INFO[s.role]}</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField<CurrencyCode> label="Default currency for new estimates" value={s.defaultCurrency} onChange={s.setDefaultCurrency} options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.label}` }))} />
        </div>
      </Card>

      {ro && (
        <Callout tone="info" title="Read-only">
          <span className="inline-flex items-center gap-1">
            <Lock size={12} /> Switch to the Administrator role to edit and publish rate cards.
          </span>
        </Callout>
      )}

      <Card>
        <CardTitle sub="Every rate is illustrative until replaced. Record the source and effective date of contracted rates." action={dirty ? <Badge tone="warn">Unpublished changes</Badge> : <Badge tone="brand">Published</Badge>}>
          Rate card version
        </CardTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <TextField label="Version" value={draft.version} onChange={(v) => up((r) => ({ ...r, version: v }))} />
          <FieldShell label="Effective date">
            <input type="date" disabled={ro} className="h-9 w-full rounded-lg border border-line px-3 text-sm" value={draft.effectiveDate} onChange={(e) => up((r) => ({ ...r, effectiveDate: e.target.value }))} />
          </FieldShell>
          <TextField label="Source reference" value={draft.source} onChange={(v) => up((r) => ({ ...r, source: v }))} className="md:col-span-2" />
          <TextField label="Change note (recorded on publish)" value={note} onChange={setNote} placeholder="e.g. Contracted model rates for FY27" className="md:col-span-4" />
        </div>
      </Card>

      <fieldset disabled={ro} className="min-w-0 space-y-4">
        <Collapsible title="LLM provider and model rates" sub="USD per 1M tokens. Cached = cache-read rate. Mark rates as contracted once replaced." defaultOpen badge={<Badge>{draft.models.length} models</Badge>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr>
                  <Th>Provider</Th>
                  <Th>Model</Th>
                  <Th right>Input / 1M</Th>
                  <Th right>Cached / 1M</Th>
                  <Th right>Output / 1M</Th>
                  <Th>Effective</Th>
                  <Th>Source reference</Th>
                  <Th>Illustrative</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {draft.models.map((m, i) => {
                  const set = (patch: Partial<ModelRate>) => up((r) => ({ ...r, models: r.models.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
                  return (
                    <tr key={m.id}>
                      <Td className="w-40"><TextInput value={m.provider} onChange={(v) => set({ provider: v })} /></Td>
                      <Td className="w-56"><TextInput value={m.name} onChange={(v) => set({ name: v })} /></Td>
                      <Td className="w-28"><NumberInput value={m.inputPer1M} onChange={(v) => set({ inputPer1M: v ?? 0 })} min={0} ariaLabel="Input rate" /></Td>
                      <Td className="w-28"><NumberInput value={m.cachedInputPer1M} onChange={(v) => set({ cachedInputPer1M: v ?? 0 })} min={0} ariaLabel="Cached rate" /></Td>
                      <Td className="w-28"><NumberInput value={m.outputPer1M} onChange={(v) => set({ outputPer1M: v ?? 0 })} min={0} ariaLabel="Output rate" /></Td>
                      <Td className="w-36"><input type="date" className="h-9 w-full rounded-lg border border-line px-2 text-sm" value={m.effectiveDate} onChange={(e) => set({ effectiveDate: e.target.value })} /></Td>
                      <Td><TextInput value={m.source} onChange={(v) => set({ source: v })} /></Td>
                      <Td><Toggle checked={m.illustrative} onChange={(v) => set({ illustrative: v })} label="" /></Td>
                      <Td>
                        <button className="rounded p-1.5 text-muted hover:bg-bad-50 hover:text-bad disabled:opacity-40" disabled={draft.models.length <= 1} onClick={() => up((r) => ({ ...r, models: r.models.filter((_, j) => j !== i) }))} aria-label="Remove model">
                          <Trash2 size={14} />
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() =>
              up((r) => ({
                ...r,
                models: [...r.models, { id: `model-${Date.now().toString(36)}`, provider: 'Provider', name: 'New model', inputPer1M: 1, outputPer1M: 4, cachedInputPer1M: 0.1, effectiveDate: new Date().toISOString().slice(0, 10), source: 'Enter contract or price-list reference', illustrative: false }],
              }))
            }
          >
            <Plus size={13} /> Add model
          </Button>
        </Collapsible>

        <Collapsible title="AI consumption unit rates, OCR and orchestration" sub="USD">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <NumberField label="OCR per page" value={draft.ocrPerPage} onChange={(v) => num((r) => (r.ocrPerPage = v ?? 0))} min={0} />
            <NumberField label="Embeddings per 1M tokens" value={draft.embeddingPer1M} onChange={(v) => num((r) => (r.embeddingPer1M = v ?? 0))} min={0} />
            <NumberField label="Vector search per 1K queries" value={draft.vectorQueryPer1K} onChange={(v) => num((r) => (r.vectorQueryPer1K = v ?? 0))} min={0} />
            <NumberField label="Orchestration per agent run" value={draft.orchestrationPerRun} onChange={(v) => num((r) => (r.orchestrationPerRun = v ?? 0))} min={0} />
            <NumberField label="Tool / API call" value={draft.toolCallCost} onChange={(v) => num((r) => (r.toolCallCost = v ?? 0))} min={0} />
          </div>
        </Collapsible>

        <Collapsible title="Cloud infrastructure and hosting" sub="USD per month">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberField label="Infrastructure base" value={draft.infraBasePerMonth} onChange={(v) => num((r) => (r.infraBasePerMonth = v ?? 0))} min={0} />
            <NumberField label="Infrastructure per agent" value={draft.infraPerAgentPerMonth} onChange={(v) => num((r) => (r.infraPerAgentPerMonth = v ?? 0))} min={0} />
            <NumberField label="Monitoring tooling per agent" value={draft.observabilityPerAgentPerMonth} onChange={(v) => num((r) => (r.observabilityPerAgentPerMonth = v ?? 0))} min={0} />
            {(['shared', 'private', 'onprem'] as HostingKey[]).map((h) => (
              <NumberField key={h} label={`Hosting multiplier — ${h === 'shared' ? 'shared cloud' : h === 'private' ? 'private cloud' : 'client-hosted'}`} value={draft.hostingMultipliers[h]} onChange={(v) => num((r) => (r.hostingMultipliers[h] = v ?? 1))} min={0} />
            ))}
          </div>
        </Collapsible>

        <Collapsible title="AgentOps rates and SLA multipliers" sub="USD per month, before SLA multiplier and delivery cost index">
          <table className="w-full max-w-3xl">
            <thead>
              <tr>
                <Th>Component</Th>
                <Th right>Base / month</Th>
                <Th right>Per agent / month</Th>
              </tr>
            </thead>
            <tbody>
              {draft.agentOps.map((c, i) => (
                <tr key={c.id}>
                  <Td>{c.label}</Td>
                  <Td className="w-40"><NumberInput value={c.basePerMonth} onChange={(v) => num((r) => (r.agentOps[i].basePerMonth = v ?? 0))} min={0} ariaLabel={`${c.label} base`} /></Td>
                  <Td className="w-40"><NumberInput value={c.perAgentPerMonth} onChange={(v) => num((r) => (r.agentOps[i].perAgentPerMonth = v ?? 0))} min={0} ariaLabel={`${c.label} per agent`} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 grid grid-cols-1 max-w-3xl gap-4 sm:grid-cols-3">
            {(['standard', 'enhanced', 'premium'] as SlaKey[]).map((k) => (
              <NumberField key={k} label={`SLA multiplier — ${k}`} value={draft.slaMultipliers[k]} onChange={(v) => num((r) => (r.slaMultipliers[k] = v ?? 1))} min={0} />
            ))}
          </div>
        </Collapsible>

        <Collapsible title="Implementation resource rates and effort" sub="USD delivery cost per hour; base hours are for one agent at medium complexity">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Role</Th>
                  <Th right>Rate / hour</Th>
                </tr>
              </thead>
              <tbody>
                {draft.implRoles.map((ro_, i) => (
                  <tr key={ro_.id}>
                    <Td>{ro_.label}</Td>
                    <Td className="w-36"><NumberInput value={ro_.ratePerHour} onChange={(v) => num((r) => (r.implRoles[i].ratePerHour = v ?? 0))} min={0} ariaLabel={`${ro_.label} rate`} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Activity</Th>
                  <Th right>Base hours</Th>
                </tr>
              </thead>
              <tbody>
                {draft.implActivities.map((a, i) => (
                  <tr key={a.id}>
                    <Td>{a.label}</Td>
                    <Td className="w-32"><NumberInput value={a.baseHours} onChange={(v) => num((r) => (r.implActivities[i].baseHours = v ?? 0))} min={0} ariaLabel={`${a.label} hours`} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid grid-cols-1 max-w-3xl gap-4 sm:grid-cols-4">
            {(['low', 'medium', 'high'] as Complexity[]).map((c) => (
              <NumberField key={c} label={`Effort factor — ${c}`} value={draft.implComplexityFactor[c]} onChange={(v) => num((r) => (r.implComplexityFactor[c] = v ?? 1))} min={0} />
            ))}
            <NumberField label="Extra effort per additional agent" value={draft.implPerExtraAgent} onChange={(v) => num((r) => (r.implPerExtraAgent = v ?? 0))} min={0} />
          </div>
        </Collapsible>

        <Collapsible title="Currency conversion and delivery cost index" sub="Units of each currency per 1 USD. The delivery index scales provider labour (implementation, AgentOps) by market.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField label="FX source" value={draft.fxSource} onChange={(v) => up((r) => ({ ...r, fxSource: v }))} className="sm:col-span-2" />
            <FieldShell label="FX effective date">
              <input type="date" className="h-9 w-full rounded-lg border border-line px-3 text-sm" value={draft.fxEffectiveDate} onChange={(e) => up((r) => ({ ...r, fxEffectiveDate: e.target.value }))} />
            </FieldShell>
          </div>
          <table className="mt-4 w-full max-w-2xl">
            <thead>
              <tr>
                <Th>Currency</Th>
                <Th right>Per 1 USD</Th>
                <Th right>Delivery cost index</Th>
              </tr>
            </thead>
            <tbody>
              {CURRENCIES.map((c) => (
                <tr key={c.code}>
                  <Td>
                    {c.code} — {c.label}
                  </Td>
                  <Td className="w-36"><NumberInput value={draft.fx[c.code]} onChange={(v) => num((r) => (r.fx[c.code] = c.code === 'USD' ? 1 : v ?? 1))} min={0} disabled={c.code === 'USD'} ariaLabel={`${c.code} FX`} /></Td>
                  <Td className="w-36"><NumberInput value={draft.deliveryCostIndex[c.code]} onChange={(v) => num((r) => (r.deliveryCostIndex[c.code] = v ?? 1))} min={0} ariaLabel={`${c.code} index`} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Collapsible>

        <Collapsible title="ACU conversion methodology" sub={`Version ${draft.acu.version} — an ACU is a commercial abstraction; one token is not one ACU.`} defaultOpen>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <FieldShell label="Method">
              <Segmented<AcuMethod>
                size="sm"
                value={draft.acu.method}
                onChange={(v) => num((r) => (r.acu.method = v))}
                options={[
                  { value: 'cost', label: 'A · Cost-normalised' },
                  { value: 'weighted', label: 'B · Weighted resource' },
                ]}
              />
            </FieldShell>
            <TextField label="ACU methodology version" value={draft.acu.version} onChange={(v) => up((r) => ({ ...r, acu: { ...r.acu, version: v } }))} />
            <FieldShell label="Effective date">
              <input type="date" className="h-9 w-full rounded-lg border border-line px-3 text-sm" value={draft.acu.effectiveDate} onChange={(e) => up((r) => ({ ...r, acu: { ...r.acu, effectiveDate: e.target.value } }))} />
            </FieldShell>
          </div>
          {draft.acu.method === 'cost' ? (
            <div className="mt-4 grid max-w-xl grid-cols-2 gap-4">
              <NumberField label="Reference cost per ACU" value={draft.acu.referenceCost} onChange={(v) => num((r) => (r.acu.referenceCost = v ?? 1))} min={0} hint="e.g. 1 = ₹1 of eligible consumption is 1 ACU" />
              <SelectField<CurrencyCode> label="Reference currency" value={draft.acu.referenceCurrency} onChange={(v) => num((r) => (r.acu.referenceCurrency = v))} options={CURRENCIES.map((c) => ({ value: c.code, label: c.code }))} />
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
              {(
                [
                  ['inputTokensPer1K', 'Uncached input tokens (per 1K)'],
                  ['cachedTokensPer1K', 'Cached input tokens (per 1K)'],
                  ['outputTokensPer1K', 'Output tokens (per 1K)'],
                  ['ocrPage', 'OCR page'],
                  ['toolCall', 'Tool / API call'],
                  ['orchestrationRun', 'Agent run'],
                  ['vectorQuery', 'Vector query'],
                  ['embeddingTokensPer1K', 'Embedding tokens (per 1K)'],
                ] as const
              ).map(([k, label]) => (
                <NumberField key={k} label={`ACUs per ${label}`} value={draft.acu.weights[k]} onChange={(v) => num((r) => (r.acu.weights[k] = v ?? 0))} min={0} />
              ))}
            </div>
          )}
        </Collapsible>

        <Collapsible title="ABU complexity weights, effort multipliers and margins">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {(['low', 'medium', 'high'] as Complexity[]).map((c) => (
              <NumberField key={c} label={`ABU weight — ${c}`} value={draft.abuWeights[c]} onChange={(v) => num((r) => (r.abuWeights[c] = v ?? 1))} min={0} />
            ))}
            {(['low', 'medium', 'high'] as Complexity[]).map((c) => (
              <NumberField key={`e-${c}`} label={`Resource effort — ${c}`} value={draft.effortMultipliers[c]} onChange={(v) => num((r) => (r.effortMultipliers[c] = v ?? 1))} min={0} tip="Multiplies tokens, OCR pages, tool calls and queries for this complexity." />
            ))}
            <NumberField label="Default implementation margin" value={draft.defaultMargins.implementation} onChange={(v) => num((r) => (r.defaultMargins.implementation = v ?? 0))} suffix="%" min={0} max={95} />
            <NumberField label="Default run margin" value={draft.defaultMargins.run} onChange={(v) => num((r) => (r.defaultMargins.run = v ?? 0))} suffix="%" min={0} max={95} />
            <NumberField label="Productive hours per FTE / month" value={draft.fteHoursPerMonth} onChange={(v) => num((r) => (r.fteHoursPerMonth = v ?? 160))} min={1} />
          </div>
        </Collapsible>

        <ProcessTemplates draft={draft} up={up} />
      </fieldset>

      <Card>
        <CardTitle sub="Published versions in this browser. Restoring makes a version active again.">
          <span className="inline-flex items-center gap-2">
            <History size={15} /> Version history
          </span>
        </CardTitle>
        <table className="w-full">
          <thead>
            <tr>
              <Th>Version</Th>
              <Th>Published</Th>
              <Th>Note</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {s.rateCardHistory.map((h) => (
              <tr key={h.version}>
                <Td className="font-medium text-ink">
                  {h.version} {h.version === s.rateCard.version && <Badge tone="brand">Active</Badge>}
                </Td>
                <Td className="text-xs text-muted">{dateFmt(h.publishedAt)}</Td>
                <Td className="text-ink-2">{h.note}</Td>
                <Td right>
                  {h.version !== s.rateCard.version && (
                    <Button size="sm" variant="ghost" disabled={ro} onClick={() => s.restoreRateCard(h.version)}>
                      Restore
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4">
          {confirmReset ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-2">Replace the working rate card with the illustrative defaults? You can still publish or discard.</span>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  setDraft({ ...DEFAULT_RATE_CARD, version: bumpVersion(s.rateCard.version) });
                  setConfirmReset(false);
                }}
              >
                Replace
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="danger" disabled={ro} onClick={() => setConfirmReset(true)}>
              <RotateCcw size={13} /> Load illustrative defaults
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function bumpVersion(v: string) {
  const m = v.match(/^(.*?)(\d+)$/);
  if (m) return `${m[1]}${Number(m[2]) + 1}`;
  return `${v}.1`;
}

const TEMPLATE_FIELDS: { key: string; label: string; suffix?: string }[] = [
  { key: 'volume', label: 'Volume / mo' },
  { key: 'agents', label: 'Agents' },
  { key: 'successRate', label: 'Success', suffix: '%' },
  { key: 'manualMinutes', label: 'Manual min' },
  { key: 'aiAssistedMinutes', label: 'AI min' },
  { key: 'laborUSD', label: 'Labour USD/h' },
  { key: 'laborINR', label: 'Labour INR/h' },
  { key: 'callsPerTxn', label: 'Calls' },
  { key: 'inputTokensPerCall', label: 'In tokens' },
  { key: 'outputTokensPerCall', label: 'Out tokens' },
];

function ProcessTemplates({ draft, up }: { draft: RateCard; up: (fn: (r: RateCard) => RateCard) => void }) {
  const [q, setQ] = useState('');
  const [fn, setFn] = useState('all');
  const list = useMemo(
    () => PROCESSES.filter((p) => (fn === 'all' || p.functionId === fn) && `${p.name} ${p.abuUnit}`.toLowerCase().includes(q.toLowerCase())),
    [q, fn],
  );
  const counts = INDUSTRIES.map((i) => ({ ...i, n: PROCESSES.filter((p) => p.industries === 'all' || p.industries.includes(i.id)).length }));
  return (
    <Collapsible
      title="Industry and process templates"
      sub={`${PROCESSES.length} process templates (incl. ${PROCESSES.filter((p) => p.functionId === 'sdlc').length} IT SDLC) across ${FUNCTIONS.length} functions and ${INDUSTRIES.length} industries. Edited defaults apply to new estimates.`}
      badge={<Badge>{Object.keys(draft.processOverrides ?? {}).length} edited</Badge>}
    >
      <div className="mb-4 flex flex-wrap gap-1.5">
        {counts.map((i) => (
          <Badge key={i.id}>
            {i.name}: {i.n}
          </Badge>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-3">
        <div className="relative w-72">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input className="h-9 w-full rounded-lg border border-line pr-3 pl-8 text-sm" placeholder="Search processes" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="w-72">
          <Select value={fn} onChange={setFn} options={[{ value: 'all', label: 'All functions' }, ...FUNCTIONS.map((f) => ({ value: f.id, label: f.name }))]} ariaLabel="Function filter" />
        </div>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[1300px]">
          <thead className="sticky top-0 bg-surface">
            <tr>
              <Th>Process</Th>
              <Th>ABU</Th>
              <Th>Suggested model</Th>
              {TEMPLATE_FIELDS.map((f) => (
                <Th key={f.key} right>
                  {f.label}
                </Th>
              ))}
              <Th />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const ov = draft.processOverrides?.[p.id] ?? {};
              return (
                <tr key={p.id}>
                  <Td className="text-ink">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[11px] text-muted">
                      {functionName(p.functionId)} · {p.industries === 'all' ? 'cross-industry' : p.industries.filter((i) => i !== 'other').join(', ')}
                    </div>
                  </Td>
                  <Td className="text-xs text-ink-2">{p.abuUnit}</Td>
                  <Td className="text-xs">{REC_CONFIG[p.recommendation].label}</Td>
                  {TEMPLATE_FIELDS.map((f) => {
                    const val = (ov[f.key] as number | undefined) ?? (p.defaults[f.key as keyof typeof p.defaults] as number);
                    return (
                      <Td key={f.key} className="w-24">
                        <NumberInput
                          value={val}
                          min={0}
                          ariaLabel={`${p.name} ${f.label}`}
                          onChange={(v) =>
                            up((r) => ({
                              ...r,
                              processOverrides: { ...(r.processOverrides ?? {}), [p.id]: { ...(r.processOverrides?.[p.id] ?? {}), [f.key]: v ?? 0 } },
                            }))
                          }
                        />
                      </Td>
                    );
                  })}
                  <Td>
                    {Object.keys(ov).length > 0 && (
                      <button
                        className="text-xs text-brand hover:underline"
                        onClick={() =>
                          up((r) => {
                            const o = { ...(r.processOverrides ?? {}) };
                            delete o[p.id];
                            return { ...r, processOverrides: o };
                          })
                        }
                      >
                        Reset
                      </button>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Collapsible>
  );
}
