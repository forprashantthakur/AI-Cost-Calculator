'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CurrencyCode, EstimateInputs, RateCard } from '@/engine/types';
import { DEFAULT_RATE_CARD } from '@/data/rateCard';
import { buildSamples } from '@/data/samples';
import { createEstimate, newId } from '@/data/templates';

export type Role = 'consultant' | 'commercial' | 'admin';

export interface AuditEntry {
  at: string;
  role: Role;
  action: string;
  detail: string;
}

export interface RateCardVersion {
  version: string;
  publishedAt: string;
  note: string;
  rateCard: RateCard;
}

interface State {
  rateCard: RateCard;
  rateCardHistory: RateCardVersion[];
  estimates: EstimateInputs[];
  currentId: string | null;
  defaultCurrency: CurrencyCode;
  role: Role;
  audit: AuditEntry[];
  seeded: boolean;

  current: () => EstimateInputs | null;
  newEstimate: (opts: { processId: string; industryId: string; functionId: string; currency?: CurrencyCode }) => string;
  updateCurrent: (fn: (e: EstimateInputs) => EstimateInputs) => void;
  replaceCurrent: (e: EstimateInputs) => void;
  open: (id: string) => void;
  duplicate: (id: string) => string | null;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  setStatus: (id: string, status: EstimateInputs['status']) => void;
  importEstimates: (list: EstimateInputs[]) => number;
  loadSamples: () => void;
  setDefaultCurrency: (c: CurrencyCode) => void;
  setRole: (r: Role) => void;
  publishRateCard: (rc: RateCard, note: string) => void;
  restoreRateCard: (version: string) => void;
  log: (action: string, detail: string) => void;
}

const now = () => new Date().toISOString();

/** localStorage that never throws (private windows, sandboxed frames, blocked site data). */
const safeStorage = {
  getItem: (k: string) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* storage unavailable: keep working in memory */
    }
  },
  removeItem: (k: string) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      rateCard: DEFAULT_RATE_CARD,
      rateCardHistory: [{ version: DEFAULT_RATE_CARD.version, publishedAt: DEFAULT_RATE_CARD.effectiveDate, note: 'Initial illustrative rate card', rateCard: DEFAULT_RATE_CARD }],
      estimates: [],
      currentId: null,
      defaultCurrency: 'INR',
      role: 'admin',
      audit: [],
      seeded: false,

      current: () => {
        const { estimates, currentId } = get();
        return estimates.find((e) => e.id === currentId) ?? null;
      },

      log: (action, detail) =>
        set((s) => ({ audit: [{ at: now(), role: s.role, action, detail }, ...s.audit].slice(0, 500) })),

      newEstimate: ({ processId, industryId, functionId, currency }) => {
        const s = get();
        const est = createEstimate({ processId, industryId, functionId, currency: currency ?? s.defaultCurrency }, s.rateCard);
        set({ estimates: [est, ...s.estimates], currentId: est.id });
        get().log('Created estimate', est.name);
        return est.id;
      },

      updateCurrent: (fn) =>
        set((s) => {
          const idx = s.estimates.findIndex((e) => e.id === s.currentId);
          if (idx < 0) return s;
          const next = [...s.estimates];
          next[idx] = { ...fn(next[idx]), updatedAt: now(), rateCardVersion: s.rateCard.version };
          return { estimates: next };
        }),

      replaceCurrent: (e) => get().updateCurrent(() => e),

      open: (id) => set({ currentId: id }),

      duplicate: (id) => {
        const src = get().estimates.find((e) => e.id === id);
        if (!src) return null;
        const copy: EstimateInputs = { ...structuredClone(src), id: newId(), name: `${src.name} (copy)`, isSample: false, status: 'draft', createdAt: now(), updatedAt: now() };
        set((s) => ({ estimates: [copy, ...s.estimates], currentId: copy.id }));
        get().log('Duplicated estimate', `${src.name} → ${copy.name}`);
        return copy.id;
      },

      remove: (id) => {
        const e = get().estimates.find((x) => x.id === id);
        set((s) => ({ estimates: s.estimates.filter((x) => x.id !== id), currentId: s.currentId === id ? null : s.currentId }));
        if (e) get().log('Deleted estimate', e.name);
      },

      rename: (id, name) => set((s) => ({ estimates: s.estimates.map((e) => (e.id === id ? { ...e, name, updatedAt: now() } : e)) })),

      setStatus: (id, status) => {
        set((s) => ({ estimates: s.estimates.map((e) => (e.id === id ? { ...e, status, updatedAt: now() } : e)) }));
        const e = get().estimates.find((x) => x.id === id);
        if (e) get().log(status === 'final' ? 'Marked estimate final' : 'Reopened estimate as draft', e.name);
      },

      importEstimates: (list) => {
        const valid = list.filter((e) => e && typeof e === 'object' && e.processId && e.commercial && e.value);
        const imported = valid.map((e) => ({ ...e, id: newId(), isSample: false, updatedAt: now() }));
        set((s) => ({ estimates: [...imported, ...s.estimates] }));
        get().log('Imported estimates', `${imported.length} estimate(s)`);
        return imported.length;
      },

      loadSamples: () => {
        const s = get();
        const samples = buildSamples(s.rateCard);
        const ids = new Set(samples.map((x) => x.id));
        set({ estimates: [...s.estimates.filter((e) => !ids.has(e.id)), ...samples], seeded: true });
        get().log('Loaded sample estimates', `${samples.length} samples (re)loaded`);
      },

      setDefaultCurrency: (c) => set({ defaultCurrency: c }),
      setRole: (r) => {
        set({ role: r });
        get().log('Changed role', r);
      },

      publishRateCard: (rc, note) => {
        set((s) => ({
          rateCard: rc,
          rateCardHistory: [{ version: rc.version, publishedAt: now(), note, rateCard: rc }, ...s.rateCardHistory.filter((h) => h.version !== rc.version)].slice(0, 50),
        }));
        get().log('Published rate card', `${rc.version} — ${note}`);
      },

      restoreRateCard: (version) => {
        const h = get().rateCardHistory.find((x) => x.version === version);
        if (!h) return;
        set({ rateCard: h.rateCard });
        get().log('Restored rate card', version);
      },
    }),
    {
      name: 'ai-agent-pricing-calculator',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
      partialize: (s) => ({
        rateCard: s.rateCard,
        rateCardHistory: s.rateCardHistory,
        estimates: s.estimates,
        currentId: s.currentId,
        defaultCurrency: s.defaultCurrency,
        role: s.role,
        audit: s.audit,
        seeded: s.seeded,
      }),
    },
  ),
);
