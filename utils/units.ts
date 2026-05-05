/**
 * Distance (and derived) unit helpers.
 *
 * Storage contract:
 *   - HealthKit values are stored as-is with their source unit ('km' | 'mi').
 *   - Display is driven by the user's profile `unit` field ('metric' | 'imperial').
 *
 * Rule: never convert at rest — only convert at display time.
 */

import type { ProfileUnit } from '@/utils/body-units';

export type DistanceUnit = 'km' | 'mi';

export const KM_PER_MI = 1.60934;
export const MI_PER_KM = 1 / KM_PER_MI;

// ── Unit resolution ────────────────────────────────────────────────────────

/** Returns the display distance unit for a profile preference. */
export function distanceUnit(profileUnit: ProfileUnit): DistanceUnit {
  return profileUnit === 'imperial' ? 'mi' : 'km';
}

/** Human-readable label for a distance unit. */
export function distanceUnitLabel(profileUnit: ProfileUnit): string {
  return profileUnit === 'imperial' ? 'mi' : 'km';
}

// ── Conversion ─────────────────────────────────────────────────────────────

/** Converts a raw distance value from its stored unit to the user's preferred unit. */
export function toPreferredDistance(
  value:      number,
  storedUnit: DistanceUnit,
  profileUnit: ProfileUnit,
): number {
  const target = distanceUnit(profileUnit);
  if (storedUnit === target) return value;
  return storedUnit === 'km'
    ? value * MI_PER_KM   // km → mi
    : value * KM_PER_MI;  // mi → km
}

// ── Formatting ─────────────────────────────────────────────────────────────

/**
 * Returns a display string for a distance value, e.g. "2.7 mi" or "4.35 km".
 * Pass the value and the unit it is stored in; the function converts if needed.
 */
export function formatDistance(
  value:       number,
  storedUnit:  DistanceUnit,
  profileUnit: ProfileUnit,
  options?: { showUnit?: boolean; decimals?: number },
): string {
  const { showUnit = true, decimals = 2 } = options ?? {};
  const converted = toPreferredDistance(value, storedUnit, profileUnit);
  const rounded   = Math.round(converted * 10 ** decimals) / 10 ** decimals;
  const label     = distanceUnitLabel(profileUnit);
  return showUnit ? `${rounded} ${label}` : String(rounded);
}

/**
 * Returns just the numeric display value (already converted, already rounded).
 * Useful when the unit label is rendered separately.
 */
export function distanceValue(
  value:       number,
  storedUnit:  DistanceUnit,
  profileUnit: ProfileUnit,
  decimals     = 2,
): number {
  const converted = toPreferredDistance(value, storedUnit, profileUnit);
  return Math.round(converted * 10 ** decimals) / 10 ** decimals;
}

// ── Speed / pace helpers (for future workout display) ──────────────────────

/** km/h → mph or km/h depending on profile unit. */
export function formatSpeed(
  kmh:         number,
  profileUnit: ProfileUnit,
  options?: { showUnit?: boolean },
): string {
  const { showUnit = true } = options ?? {};
  if (profileUnit === 'imperial') {
    const mph = Math.round(kmh * MI_PER_KM * 10) / 10;
    return showUnit ? `${mph} mph` : String(mph);
  }
  const rounded = Math.round(kmh * 10) / 10;
  return showUnit ? `${rounded} km/h` : String(rounded);
}

/** Returns min/km or min/mi pace string from km/h, e.g. "5:30 /km". */
export function formatPace(kmh: number, profileUnit: ProfileUnit): string {
  if (kmh <= 0) return '--';
  const minPerKm  = 60 / kmh;
  const minPerMi  = minPerKm * KM_PER_MI;
  const raw       = profileUnit === 'imperial' ? minPerMi : minPerKm;
  const mins      = Math.floor(raw);
  const secs      = Math.round((raw - mins) * 60);
  const unit      = profileUnit === 'imperial' ? '/mi' : '/km';
  return `${mins}:${String(secs).padStart(2, '0')} ${unit}`;
}
