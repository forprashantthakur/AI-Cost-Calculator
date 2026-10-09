'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calculator, LayoutDashboard, Columns3, SlidersHorizontal, FolderOpen, Settings, Menu, X } from 'lucide-react';
import { useStore } from '@/store/store';
import { getProcess } from '@/data/catalog';
import { cx } from './ui';

const NAV = [
  { href: '/estimate/', label: 'New Estimate', icon: Calculator },
  { href: '/dashboard/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/compare/', label: 'Compare Models', icon: Columns3 },
  { href: '/simulator/', label: 'Scenario Simulator', icon: SlidersHorizontal },
  { href: '/library/', label: 'Saved Estimates & Reports', icon: FolderOpen },
  { href: '/settings/', label: 'Settings', icon: Settings },
];

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
      <rect width="32" height="32" rx="7" fill="var(--color-brand)" />
      <rect x="7" y="17" width="4" height="8" rx="1" fill="#fff" opacity=".7" />
      <rect x="14" y="12" width="4" height="13" rx="1" fill="#fff" opacity=".85" />
      <rect x="21" y="7" width="4" height="18" rx="1" fill="#fff" />
    </svg>
  );
}

function CurrentChip() {
  const est = useStore((s) => s.estimates.find((e) => e.id === s.currentId) ?? null);
  if (!est) return null;
  const proc = getProcess(est.processId);
  return (
    <Link href="/estimate/" className="hidden max-w-[280px] items-center gap-2 truncate rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink-2 hover:border-brand/40 xl:flex" title="Current estimate">
      <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', est.status === 'final' ? 'bg-brand' : 'bg-warn')} />
      <span className="truncate font-medium text-ink">{est.name}</span>
      <span className="truncate text-muted">· {est.customProcessName || proc.name}</span>
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    Promise.resolve(useStore.persist.rehydrate()).then(() => {
      const s = useStore.getState();
      if (!s.seeded) {
        s.loadSamples();
        if (!useStore.getState().currentId) useStore.setState({ currentId: 'sample-mfg-ap' });
      }
      setReady(true);
    });
  }, []);

  useEffect(() => setMobile(false), [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <Logo />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">Enterprise AI Agent Pricing &amp; Value Calculator</span>
              <span className="hidden truncate text-[11px] text-muted sm:block">From AI Agent Consumption to Business Outcomes and Commercial Value.</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <CurrentChip />
            <button className="rounded-lg p-2 text-ink-2 hover:bg-line-2 lg:hidden" onClick={() => setMobile(!mobile)} aria-label="Menu">
              {mobile ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        <nav className={cx('mx-auto max-w-[1440px] px-2 sm:px-4 lg:block', mobile ? 'block pb-3' : 'hidden')} aria-label="Main">
          <ul className="flex flex-col gap-0.5 lg:flex-row lg:gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname === href.slice(0, -1);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cx(
                      'flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors lg:py-3',
                      active ? 'border-brand text-brand-700' : 'border-transparent text-muted hover:text-ink',
                    )}
                  >
                    <Icon size={15} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {ready ? children : <div className="py-24 text-center text-sm text-muted">Loading calculator…</div>}
      </main>
      <footer className="no-print border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-4 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            All rates, samples and client names are <strong className="text-ink-2">illustrative</strong>. Replace rates with contracted or published figures, with sources and effective dates, before client use.
          </span>
          <span className="flex gap-4">
            <Link href="/methodology/" className="hover:text-brand">
              Methodology &amp; formulas
            </Link>
            <span>Calculations run in your browser · deterministic decimal engine</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

/** Shown on result pages when no estimate is open. */
export function NoEstimate() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-dashed border-line bg-surface p-10 text-center">
      <h2 className="text-lg font-semibold">No estimate open</h2>
      <p className="mt-1 text-sm text-muted">Start a new estimate or open a saved one or a sample project.</p>
      <div className="mt-5 flex justify-center gap-2">
        <Link href="/estimate/" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          New estimate
        </Link>
        <Link href="/library/" className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-canvas">
          Open saved
        </Link>
      </div>
    </div>
  );
}
