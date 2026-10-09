'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Plus, FileDown, FileSpreadsheet } from 'lucide-react';
import { useStore } from '@/store/store';
import { useEstimate } from '@/lib/useEstimate';
import { FUNCTIONS, INDUSTRIES, processesFor } from '@/data/catalog';
import { CURRENCIES } from '@/data/rateCard';
import type { CurrencyCode } from '@/engine/types';
import { Button, Callout, Card, CardTitle, PageHeader, Select, FieldShell, cx } from '@/components/ui';
import { Step1Process } from '@/components/estimate/Step1Process';
import { Step2Inputs } from '@/components/estimate/Step2Inputs';
import { Step3Costs } from '@/components/estimate/Step3Costs';
import { Step4Pricing } from '@/components/estimate/Step4Pricing';
import { Step5Value } from '@/components/estimate/Step5Value';
import { LiveSummary } from '@/components/estimate/LiveSummary';
import { exportExcel, exportPdf } from '@/lib/export/download';

const STEPS = [
  { n: 1, label: 'Process', sub: 'Industry, function, process' },
  { n: 2, label: 'Inputs', sub: 'Volume and workload' },
  { n: 3, label: 'Costs', sub: 'Build, run and AgentOps' },
  { n: 4, label: 'Pricing', sub: 'ACU, ABU and model' },
  { n: 5, label: 'Value', sub: 'ROI and summary' },
];

export default function EstimatePage() {
  const { est, res, update } = useEstimate();
  const [step, setStep] = useState(1);
  const [starting, setStarting] = useState(false);
  const rc = useStore((s) => s.rateCard);
  const setStatus = useStore((s) => s.setStatus);
  const log = useStore((s) => s.log);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new')) setStarting(true);
  }, []);

  if (!est || starting) return <StartEstimate onDone={() => { setStarting(false); setStep(1); }} onCancel={est ? () => setStarting(false) : undefined} />;
  if (!res) return <Callout tone="bad">This estimate could not be calculated. Check its inputs or start a new one.</Callout>;

  return (
    <div>
      <PageHeader
        eyebrow="New Estimate — five-step guided calculator"
        title={est.name || 'Untitled estimate'}
        sub="Simple by default, detailed when needed. Every number updates live; advanced settings stay folded away until you need them."
        actions={
          <>
            <Button size="sm" onClick={() => setStarting(true)}>
              <Plus size={14} /> New estimate
            </Button>
            <Button size="sm" onClick={() => exportPdf('estimate', est, res, rc).then(() => log('Exported PDF', `Pricing Estimate — ${est.name}`))}>
              <FileDown size={14} /> PDF
            </Button>
            <Button size="sm" onClick={() => exportExcel(est, res, rc).then(() => log('Exported Excel', est.name))}>
              <FileSpreadsheet size={14} /> Excel
            </Button>
          </>
        }
      />

      <ol className="mb-6 grid grid-cols-5 gap-1.5 sm:gap-2" aria-label="Steps">
        {STEPS.map((s) => {
          const active = s.n === step;
          const done = s.n < step;
          return (
            <li key={s.n}>
              <button
                type="button"
                onClick={() => setStep(s.n)}
                className={cx(
                  'flex w-full items-center gap-2.5 rounded-xl border px-2 py-2.5 text-left transition-colors sm:px-3',
                  active ? 'border-brand bg-brand-50' : 'border-line bg-surface hover:border-brand/40',
                )}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={cx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    active ? 'bg-brand text-white' : done ? 'bg-brand-100 text-brand-700' : 'bg-line-2 text-muted',
                  )}
                >
                  {done ? <Check size={14} strokeWidth={3} /> : s.n}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className={cx('block text-sm font-semibold', active ? 'text-ink' : 'text-ink-2')}>{s.label}</span>
                  <span className="block truncate text-[11px] text-muted">{s.sub}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {step === 1 && <Step1Process est={est} update={update} />}
          {step === 2 && <Step2Inputs est={est} res={res} update={update} />}
          {step === 3 && <Step3Costs est={est} res={res} update={update} />}
          {step === 4 && <Step4Pricing est={est} res={res} update={update} />}
          {step === 5 && <Step5Value est={est} res={res} update={update} />}

          <div className="mt-6 flex items-center justify-between">
            <Button onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
              <ArrowLeft size={14} /> Back
            </Button>
            {step < 5 ? (
              <Button variant="primary" onClick={() => setStep(step + 1)}>
                Next: {STEPS[step].label} <ArrowRight size={14} />
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={() => setStatus(est.id, est.status === 'final' ? 'draft' : 'final')}>{est.status === 'final' ? 'Reopen as draft' : 'Mark as final'}</Button>
                <Button variant="primary" href="/dashboard/">
                  View dashboard <ArrowRight size={14} />
                </Button>
              </div>
            )}
          </div>
        </div>
        <LiveSummary res={res} />
      </div>
    </div>
  );
}

function StartEstimate({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const router = useRouter();
  const newEstimate = useStore((s) => s.newEstimate);
  const defaultCurrency = useStore((s) => s.defaultCurrency);
  const [industry, setIndustry] = useState('manufacturing');
  const [fn, setFn] = useState('finance');
  const [proc, setProc] = useState('accounts-payable');
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const list = processesFor(industry, fn, industry === 'other');

  useEffect(() => {
    if (!list.some((p) => p.id === proc)) setProc(list[0]?.id ?? 'custom');
  }, [industry, fn]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="New Estimate" title="Start a pricing estimate" sub="Pick the process; every input is prefilled with illustrative, editable assumptions so you can produce a first estimate in minutes." />
      <Card>
        <CardTitle>Step 1 — Industry, function and process</CardTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldShell label="Industry">
            <Select value={industry} onChange={setIndustry} options={INDUSTRIES.map((i) => ({ value: i.id, label: i.name }))} ariaLabel="Industry" />
          </FieldShell>
          <FieldShell label="Business function">
            <Select value={fn} onChange={setFn} options={FUNCTIONS.map((f) => ({ value: f.id, label: f.name }))} ariaLabel="Business function" />
          </FieldShell>
          <FieldShell label="Business process">
            <Select value={proc} onChange={setProc} options={[...list.map((p) => ({ value: p.id, label: p.name })), { value: 'custom', label: 'Custom process…' }]} ariaLabel="Business process" />
          </FieldShell>
          <FieldShell label="Currency">
            <Select value={currency} onChange={(c) => setCurrency(c as CurrencyCode)} options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.label}` }))} ariaLabel="Currency" />
          </FieldShell>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => {
              newEstimate({ processId: proc, industryId: industry, functionId: fn, currency });
              onDone();
            }}
          >
            Create estimate <ArrowRight size={14} />
          </Button>
          <Button onClick={() => router.push('/library/')}>Open a sample project</Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
