import type { ProcessDef } from '@/data/catalog';
import type { SdlcInputs } from './types';

/** Stories per month = teams × sprints per month × stories per sprint. */
export const storiesPerMonth = (s: SdlcInputs) => Math.max(0, s.teams) * Math.max(0, s.sprintsPerMonth) * Math.max(0, s.storiesPerSprint);

/**
 * Monthly work items for an SDLC agent, derived from the engineering drivers
 * (e.g. code reviews per month for a Code Review Agent). Story points are
 * shown for context only — they are never a billable ABU.
 */
export function sdlcDerivedVolume(s: SdlcInputs, proc: ProcessDef): number | null {
  const drv = proc.sdlcDriver;
  if (!drv) return null;
  const base = drv.field === 'stories' ? storiesPerMonth(s) : Math.max(0, Number(s[drv.field]) || 0);
  return Math.round(base * drv.factor * 100) / 100;
}
