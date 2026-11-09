import type { EstimateInputs, ImplActivityDef, RateCard } from '@/engine/types';
import { DEFAULT_RATE_CARD } from './rateCard';

/** Role ids used before the people rate card, mapped to the nearest designation. */
const LEGACY_ROLE_MAP: Record<string, string> = {
  lead: 'advise-manager',
  architect: 'advise-associate-director',
  ai: 'implement-senior-consultant',
  data: 'implement-consultant',
  qa: 'implement-analyst',
  devops: 'implement-consultant',
  change: 'advise-consultant',
};

/** A designation id that exists on the rate card: kept, mapped from a legacy role, or the first Implement designation. */
export function mapRoleId(id: string, rc: Pick<RateCard, 'resourceRates'>): string {
  if (rc.resourceRates.some((r) => r.id === id)) return id;
  const mapped = LEGACY_ROLE_MAP[id];
  if (mapped && rc.resourceRates.some((r) => r.id === mapped)) return mapped;
  return (rc.resourceRates.find((r) => r.memberFirm.toLowerCase() === 'implement') ?? rc.resourceRates[0])?.id ?? id;
}

type LegacyRateCard = Partial<RateCard> & { implRoles?: unknown; agentOps?: unknown };

/**
 * Bring a stored rate card up to the current shape. Rate cards saved before
 * the people rate card (with `implRoles` / `agentOps`) take the default
 * designations, AgentOps team and implementation activities, keeping any
 * base-hour edits to activities that still exist. Everything else is kept.
 */
export function normalizeRateCard(input: LegacyRateCard | null | undefined): RateCard {
  const base = DEFAULT_RATE_CARD;
  if (!input || typeof input !== 'object') return base;
  const legacy = !Array.isArray(input.resourceRates) || input.resourceRates.length === 0;
  const { implRoles: _r, agentOps: _a, ...rest } = input;
  void _r;
  void _a;
  const out: RateCard = { ...base, ...(rest as Partial<RateCard>) };
  if (legacy) {
    out.resourceRates = base.resourceRates;
    out.resourceCurrency = base.resourceCurrency;
    out.resourceRatesUpdated = base.resourceRatesUpdated;
    out.resourceRatesSource = base.resourceRatesSource;
    const oldHours = new Map((input.implActivities ?? []).map((a: ImplActivityDef) => [a.id, a.baseHours]));
    out.implActivities = base.implActivities.map((a) => ({ ...a, baseHours: oldHours.get(a.id) ?? a.baseHours }));
    out.version = base.version;
    out.effectiveDate = base.effectiveDate;
    out.source = base.source;
    out.changeLog = [base.changeLog[0], ...(input.changeLog ?? [])];
  }
  if (!Array.isArray(input.agentOpsTeam) || input.agentOpsTeam.length === 0) out.agentOpsTeam = base.agentOpsTeam;
  if (typeof input.defaultDiscountPct !== 'number') out.defaultDiscountPct = base.defaultDiscountPct;
  if (!input.resourceCurrency) out.resourceCurrency = base.resourceCurrency;
  out.implActivities = out.implActivities.map((a) => ({ ...a, roleId: mapRoleId(a.roleId, out) }));
  out.agentOpsTeam = out.agentOpsTeam.map((t) => ({ ...t, resourceId: mapRoleId(t.resourceId, out) }));
  return out;
}

/**
 * Bring a stored or imported estimate up to the current shape. Estimates made
 * before discount pricing keep pricing on margin, so their selling prices
 * follow the same method as before; activity roles move to designations.
 */
export function normalizeEstimate(e: EstimateInputs, rc: RateCard): EstimateInputs {
  const legacyPricing = e.peoplePricing !== 'discount' && e.peoplePricing !== 'margin';
  return {
    ...e,
    peoplePricing: legacyPricing ? 'margin' : e.peoplePricing,
    discountPct: typeof e.discountPct === 'number' ? e.discountPct : rc.defaultDiscountPct,
    implActivities: (e.implActivities ?? []).map((a) => ({ ...a, roleId: mapRoleId(a.roleId, rc) })),
  };
}
