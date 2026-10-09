'use client';

import { useMemo } from 'react';
import { useStore } from '@/store/store';
import { computeEstimate } from '@/engine';
import type { EstimateInputs, EstimateResults } from '@/engine/types';

/** The current estimate, its computed results and an updater. */
export function useEstimate(): {
  est: EstimateInputs | null;
  res: EstimateResults | null;
  update: (fn: (e: EstimateInputs) => EstimateInputs) => void;
  set: <K extends keyof EstimateInputs>(key: K, value: EstimateInputs[K]) => void;
} {
  const est = useStore((s) => s.estimates.find((e) => e.id === s.currentId) ?? null);
  const rc = useStore((s) => s.rateCard);
  const updateCurrent = useStore((s) => s.updateCurrent);
  const res = useMemo(() => {
    if (!est) return null;
    try {
      return computeEstimate(est, rc);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [est, rc]);
  return {
    est,
    res,
    update: updateCurrent,
    set: (key, value) => updateCurrent((e) => ({ ...e, [key]: value })),
  };
}
