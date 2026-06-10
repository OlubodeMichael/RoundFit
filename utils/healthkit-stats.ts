import type { DistanceUnit } from '@/utils/units';

// Pure parsing/normalisation helpers for HealthKit statistics results.
// Extracted from healthkit.ts so they can be unit-tested without the native
// HealthKit module. These encode the fix for the "lifetime total" bug: a stat
// entry of 0 (or non-positive) is treated as "no value" so a genuine 0 today is
// not mistaken for a missing read — and the result-key search order matches the
// react-native-healthkit v14 shape (`sumQuantity` first).

export function asFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function extractQuantityFromStatEntry(entry: unknown): { qty: number; unit: string } | null {
  if (entry === null || entry === undefined) return null;

  const direct = asFiniteNumber(entry);
  if (direct !== null && direct > 0) return { qty: direct, unit: '' };

  if (typeof entry !== 'object') return null;
  const nested = entry as Record<string, unknown>;
  const qty = asFiniteNumber(nested.quantity ?? nested.value ?? nested.count);
  if (qty === null || qty <= 0) return null;
  const unit = typeof nested.unit === 'string' ? nested.unit.toLowerCase() : '';
  return { qty, unit };
}

export function extractCumulativeFromStatResult(result: unknown): number {
  return extractCumulativeOrNull(result) ?? 0;
}

/**
 * Like {@link extractCumulativeFromStatResult} but distinguishes
 * "query succeeded with a genuine 0" (returns 0) from "no recognisable stat
 * shape" (returns null). Lets callers short-circuit on a real zero instead of
 * burning extra native queries retrying option variants.
 */
export function extractCumulativeOrNull(result: unknown): number | null {
  if (!result || typeof result !== 'object') return null;
  const raw = result as Record<string, unknown>;
  for (const key of ['sumQuantity', 'cumulativeSum', 'value', 'sum']) {
    const entry = raw[key];
    if (entry === null || entry === undefined) continue;
    const parsed = extractQuantityFromStatEntry(entry);
    if (parsed) return Math.round(parsed.qty);
    // Key present with a parseable but non-positive quantity → genuine 0 for
    // the queried window (e.g. no steps yet today).
    const zeroish = typeof entry === 'object'
      ? asFiniteNumber(
          (entry as Record<string, unknown>).quantity
            ?? (entry as Record<string, unknown>).value
            ?? (entry as Record<string, unknown>).count,
        )
      : asFiniteNumber(entry);
    if (zeroish !== null && zeroish <= 0) return 0;
  }
  return null;
}

export function normaliseDistanceQuantity(qty: number, unit: string): { value: number; unit: DistanceUnit } {
  const u = unit.toLowerCase();
  if (u === 'm' || u === 'meter' || u === 'meters') {
    return { value: Math.round((qty / 1000) * 100) / 100, unit: 'km' };
  }
  if (u === 'mi' || u === 'mile' || u === 'miles') {
    return { value: Math.round(qty * 100) / 100, unit: 'mi' };
  }
  if (u === 'km' || u === 'kilometer' || u === 'kilometers') {
    return { value: Math.round(qty * 100) / 100, unit: 'km' };
  }
  if (u === 'ft' || u === 'foot' || u === 'feet') {
    return { value: Math.round((qty / 5280) * 100) / 100, unit: 'mi' };
  }
  if (u === 'in' || u === 'inch' || u === 'inches') {
    return { value: Math.round((qty / 63360) * 100) / 100, unit: 'mi' };
  }
  if (u === 'yd' || u === 'yard' || u === 'yards') {
    return { value: Math.round((qty / 1760) * 100) / 100, unit: 'mi' };
  }
  // HealthKit's SI default for distance is meters when the unit is omitted —
  // ALWAYS treat it as meters. A magnitude guess (e.g. "small values are km")
  // would relabel a 50 m sample as 50 km, and the backend's Math.max merge
  // ratchets the inflated value in permanently (same family as the 11M-steps
  // lifetime-total bug).
  if (!u) {
    return { value: Math.round((qty / 1000) * 100) / 100, unit: 'km' };
  }
  // Unrecognised unit: treat as "no value" rather than mislabeling it as km.
  // Callers fall through to their next query variant / fallback on 0.
  return { value: 0, unit: 'km' };
}

/** Official v14 shape: { sumQuantity: { quantity, unit } }. */
export function parseSumQuantityFromStatistics(result: unknown): { qty: number; unit: string } | null {
  if (!result || typeof result !== 'object') return null;
  const raw = result as Record<string, unknown>;

  const fromSum = extractQuantityFromStatEntry(raw.sumQuantity);
  if (fromSum) return fromSum;

  for (const key of ['cumulativeSum', 'value', 'sum']) {
    const parsed = extractQuantityFromStatEntry(raw[key]);
    if (parsed) return parsed;
  }

  return extractQuantityFromStatEntry(result);
}
