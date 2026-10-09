'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Calculator, Coins, Gauge, LineChart, Scale, ShieldCheck } from 'lucide-react';
import { useStore } from '@/store/store';
import { getProcess, industryName } from '@/data/catalog';
import { computeEstimate } from '@/engine';
import { moneyCompact } from '@/lib/format';
import { Button, Card } from '@/components/ui';

const STEPS = [
  { icon: Calculator, title: 'Select the process', text: '17 industries, 12 functions and 89 process templates, including 19 SDLC stage agents and 7 SDLC workflows.' },
  { icon: Gauge, title: 'Enter a few inputs', text: 'Volume, success rate, effort and margin. Advanced tokenomics stay folded away.' },
  { icon: Coins, title: 'See costs and unit prices', text: 'Implementation, monthly run cost, AgentOps, cost per ABU and ACU.' },
  { icon: Scale, title: 'Compare seven models', text: 'Fixed, ACU, ABU, subscription, AgentOps, gainshare and hybrid — each cost recovered once.' },
  { icon: LineChart, title: 'Prove client value', text: 'Productivity separated from cash, validated vs assumed benefits, ROI and payback.' },
];

export default function Home() {
  const router = useRouter();
  const estimates = useStore((s) => s.estimates);
  const rc = useStore((s) => s.rateCard);
  const open = useStore((s) => s.open);
  const samples = estimates.filter((e) => e.isSample);
  const mine = estimates.filter((e) => !e.isSample).slice(0, 5);

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <ShieldCheck size={13} /> Deterministic, decimal-safe pricing engine
          </div>
          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-ink sm:text-4xl">Enterprise AI Agent Pricing &amp; Value Calculator</h1>
          <p className="mt-2 text-lg text-muted">From AI Agent Consumption to Business Outcomes and Commercial Value.</p>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-2">
            Price business-process and IT SDLC agents in minutes: what they cost to build and run, what each successful business transaction costs, how to price them, the margin you earn and the value your client realises.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="primary" href="/estimate/?new=1">
              Start a new estimate <ArrowRight size={14} />
            </Button>
            <Button href="/library/">Open a sample project</Button>
          </div>
        </div>
        <Card className="bg-gradient-to-br from-brand-50/60 to-surface">
          <div className="text-xs font-semibold tracking-wide text-brand uppercase">Two units, one cost base</div>
          <dl className="mt-3 space-y-4 text-sm">
            <div>
              <dt className="font-semibold text-ink">ACU — AI Consumption Unit</dt>
              <dd className="text-ink-2">Normalised AI technical consumption (tokens, OCR, tools, orchestration), by cost normalisation or weighted resources. One token is not one ACU.</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">ABU — AI Business Unit</dt>
              <dd className="text-ink-2">One accepted unit of business work — a processed invoice, a completed KYC check, an accepted development task — weighted by complexity and counted once.</dd>
            </div>
            <div className="rounded-lg border border-line bg-surface p-3 font-mono text-xs text-ink-2">
              Price = cost ÷ (1 − target margin)
              <br />
              Cost per ABU = attributable cost ÷ accepted weighted ABUs
            </div>
          </dl>
        </Card>
      </section>

      <section>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand">{i + 1}</span>
                <s.icon size={16} className="text-brand" />
              </div>
              <div className="mt-3 text-sm font-semibold">{s.title}</div>
              <p className="mt-1 text-xs text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Sample projects</h2>
            <Link href="/library/" className="text-xs font-medium text-brand hover:underline">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-line-2">
            {samples.map((e) => {
              let mrr = 0;
              try {
                mrr = computeEstimate(e, rc).selected.mrr;
              } catch {
                /* ignore */
              }
              return (
                <li key={e.id}>
                  <button
                    className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:text-brand"
                    onClick={() => {
                      open(e.id);
                      router.push('/dashboard/');
                    }}
                  >
                    <span>
                      <span className="block text-sm font-medium">{e.name}</span>
                      <span className="block text-[11px] text-muted">
                        {e.client} · {industryName(e.industryId)}
                      </span>
                    </span>
                    <span className="num shrink-0 text-xs text-muted">{moneyCompact(mrr, e.currency)}/mo</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 text-[15px] font-semibold">Your recent estimates</h2>
          {mine.length === 0 ? (
            <p className="text-sm text-muted">Nothing yet. Start a new estimate, or open a sample and save a copy.</p>
          ) : (
            <ul className="divide-y divide-line-2">
              {mine.map((e) => (
                <li key={e.id}>
                  <button
                    className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:text-brand"
                    onClick={() => {
                      open(e.id);
                      router.push('/dashboard/');
                    }}
                  >
                    <span>
                      <span className="block text-sm font-medium">{e.name}</span>
                      <span className="block text-[11px] text-muted">{e.customProcessName || getProcess(e.processId).name}</span>
                    </span>
                    <span className="text-[11px] text-muted">{new Date(e.updatedAt).toLocaleDateString()}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 rounded-lg bg-warn-50 px-3 py-2 text-xs text-ink-2">
            All default rates are <strong>illustrative placeholders</strong>, not vendor quotes. Replace them with contracted rates — with sources and effective dates — in Settings before client use.
          </div>
        </Card>
      </section>
    </div>
  );
}
