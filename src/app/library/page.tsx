'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, FileDown, FileJson, FileSpreadsheet, FolderOpen, Trash2, Upload, RefreshCw, Search } from 'lucide-react';
import { useStore } from '@/store/store';
import { computeEstimate } from '@/engine';
import type { EstimateInputs } from '@/engine/types';
import { getProcess, industryName } from '@/data/catalog';
import { REPORTS } from '@/lib/export/reports';
import { exportExcel, exportJson, exportPdf } from '@/lib/export/download';
import { dateFmt, moneyCompact, pctFmt } from '@/lib/format';
import { Badge, Button, Callout, Card, CardTitle, PageHeader, Td, Th, cx } from '@/components/ui';

export default function LibraryPage() {
  const router = useRouter();
  const s = useStore();
  const rc = s.rateCard;
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const current = s.estimates.find((e) => e.id === s.currentId) ?? null;
  const currentRes = useMemo(() => (current ? computeEstimate(current, rc) : null), [current, rc]);

  const rows = useMemo(
    () =>
      s.estimates.map((e) => {
        let mrr: number | null = null;
        let roi: number | null = null;
        let model = '';
        try {
          const r = computeEstimate(e, rc);
          mrr = r.selected.mrr;
          roi = r.value.roi3;
          model = r.selected.label;
        } catch {
          /* ignore */
        }
        return { e, mrr, roi, model };
      }),
    [s.estimates, rc],
  );
  const filtered = rows.filter(({ e }) => {
    const text = `${e.name} ${e.client} ${getProcess(e.processId).name} ${industryName(e.industryId)}`.toLowerCase();
    return text.includes(q.toLowerCase());
  });
  const mine = filtered.filter((r) => !r.e.isSample);
  const samples = filtered.filter((r) => r.e.isSample);

  const open = (id: string, to = '/dashboard/') => {
    s.open(id);
    router.push(to);
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const onImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const list: EstimateInputs[] = Array.isArray(data) ? data : Array.isArray(data?.estimates) ? data.estimates : [data];
      const n = s.importEstimates(list);
      setMsg(n ? `Imported ${n} estimate(s).` : 'No valid estimates found in that file.');
    } catch {
      setMsg('That file is not a valid estimates JSON export.');
    }
  };

  const Table = ({ list, sample }: { list: typeof rows; sample?: boolean }) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px]">
        <thead>
          <tr>
            <Th>Estimate</Th>
            <Th>Process · industry</Th>
            <Th right>Monthly charge</Th>
            <Th right>3-yr client ROI</Th>
            <Th>Status</Th>
            <Th>Updated</Th>
            <Th right>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {list.map(({ e, mrr, roi, model }) => (
            <tr key={e.id} className={cx(e.id === s.currentId && 'bg-brand-50/50')}>
              <Td>
                <button className="text-left font-medium text-ink hover:text-brand" onClick={() => open(e.id)}>
                  {e.name}
                </button>
                <div className="text-[11px] text-muted">{e.client || '—'}</div>
              </Td>
              <Td>
                <div className="text-ink-2">{e.customProcessName || getProcess(e.processId).name}</div>
                <div className="text-[11px] text-muted">
                  {industryName(e.industryId)} · {e.currency} · {model}
                </div>
              </Td>
              <Td right>{moneyCompact(mrr, e.currency)}</Td>
              <Td right className={(roi ?? 0) < 0 ? 'text-bad' : ''}>
                {pctFmt(roi, 0)}
              </Td>
              <Td>{e.status === 'final' ? <Badge tone="brand">Final</Badge> : <Badge tone="warn">Draft</Badge>}</Td>
              <Td className="text-xs text-muted">{dateFmt(e.updatedAt)}</Td>
              <Td right>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => open(e.id, '/estimate/')} title="Open in calculator">
                    <FolderOpen size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => s.duplicate(e.id)} title={sample ? 'Copy to my estimates' : 'Duplicate'}>
                    <Copy size={14} />
                  </Button>
                  {!sample &&
                    (confirmId === e.id ? (
                      <>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            s.remove(e.id);
                            setConfirmId(null);
                          }}
                        >
                          Delete
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" title="Delete" onClick={() => setConfirmId(e.id)}>
                        <Trash2 size={14} />
                      </Button>
                    ))}
                </div>
              </Td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <Td colSpan={7} className="py-6 text-center text-muted">
                {sample ? 'No sample projects loaded.' : 'No saved estimates yet — create one or copy a sample.'}
              </Td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Saved Estimates & Reports — project library and exports"
        title="Project library"
        sub="Estimates are saved automatically in this browser. Export reports for clients, or export JSON to share and back up estimates."
        actions={
          <>
            <Button size="sm" href="/estimate/?new=1">
              New estimate
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Import JSON
            </Button>
            <Button size="sm" onClick={() => exportJson(s.estimates.filter((e) => !e.isSample), 'my-estimates')}>
              <FileJson size={14} /> Export all (JSON)
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(ev) => {
                const f = ev.target.files?.[0];
                if (f) onImport(f);
                ev.target.value = '';
              }}
            />
          </>
        }
      />
      {msg && <Callout tone="info">{msg}</Callout>}

      <Card>
        <CardTitle sub={current ? `Current estimate: ${current.name}` : 'Open an estimate to export its reports.'}>Reports and exports</CardTitle>
        {current && currentRes ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {REPORTS.map((r) => (
              <button
                key={r.kind}
                type="button"
                disabled={busy !== null}
                onClick={() => run(r.kind, async () => { if (await exportPdf(r.kind, current, currentRes, rc)) s.log('Exported PDF', `${r.title} — ${current.name}`); })}
                className="flex items-start gap-3 rounded-xl border border-line p-4 text-left transition-colors hover:border-brand/40 hover:bg-brand-50/40 disabled:opacity-60"
              >
                <FileDown size={18} className="mt-0.5 shrink-0 text-brand" />
                <span>
                  <span className="block text-sm font-semibold text-ink">{r.title} <span className="font-normal text-muted">· PDF</span></span>
                  <span className="block text-xs text-muted">{busy === r.kind ? 'Preparing…' : r.description}</span>
                </span>
              </button>
            ))}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run('xlsx', async () => { if (await exportExcel(current, currentRes, rc)) s.log('Exported Excel', current.name); })}
              className="flex items-start gap-3 rounded-xl border border-brand/40 bg-brand-50/50 p-4 text-left transition-colors hover:bg-brand-50 disabled:opacity-60"
            >
              <FileSpreadsheet size={18} className="mt-0.5 shrink-0 text-brand" />
              <span>
                <span className="block text-sm font-semibold text-ink">Editable Excel Pricing Workbook <span className="font-normal text-muted">· XLSX</span></span>
                <span className="block text-xs text-muted">{busy === 'xlsx' ? 'Preparing…' : 'Live formulas and editable inputs, with a reconciliation sheet proving it matches the dashboard.'}</span>
              </span>
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted">No estimate is open.</p>
        )}
      </Card>

      <div className="relative max-w-sm">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm focus:border-brand focus:ring-2 focus:ring-brand/15 focus:outline-none"
          placeholder="Search estimates, clients, processes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card pad={false}>
        <div className="p-5 pb-2">
          <CardTitle sub={`${mine.length} estimate(s)`}>My estimates</CardTitle>
        </div>
        <Table list={mine} />
      </Card>

      <Card pad={false}>
        <div className="p-5 pb-2">
          <CardTitle
            sub="Twelve working samples across industries and the IT SDLC. Client names are fictitious; all inputs are illustrative and editable."
            action={
              <Button size="sm" variant="ghost" onClick={() => { s.loadSamples(); setMsg('Sample projects reloaded with the current rate card.'); }}>
                <RefreshCw size={13} /> Reload samples
              </Button>
            }
          >
            Sample projects
          </CardTitle>
        </div>
        <Table list={samples} sample />
      </Card>

      <Card>
        <CardTitle sub="Recent actions in this browser (role, time and detail). Client-side only.">Audit trail</CardTitle>
        {s.audit.length === 0 ? (
          <p className="text-sm text-muted">No actions recorded yet.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Role</Th>
                  <Th>Action</Th>
                  <Th>Detail</Th>
                </tr>
              </thead>
              <tbody>
                {s.audit.slice(0, 100).map((a, i) => (
                  <tr key={i}>
                    <Td className="text-xs whitespace-nowrap text-muted">{dateFmt(a.at)}</Td>
                    <Td className="text-xs">{a.role}</Td>
                    <Td className="text-xs font-medium text-ink">{a.action}</Td>
                    <Td className="text-xs text-ink-2">{a.detail}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
