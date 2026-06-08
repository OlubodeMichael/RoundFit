/**
 * Shared sleep duration → score mapping used by the sleep log UI and readiness.
 * Scores reflect time asleep; 7–8 h is good, not perfect.
 */

/** e.g. 7.25 → "7h 15m", 8 → "8h" */
export function formatSleepDuration(hours: number | null): string {
  if (hours === null || hours <= 0) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`;
}

export type SleepQualityUi = 'poor' | 'fair' | 'good' | 'great';

/** 0–100 score from hours asleep only. */
export function sleepDurationScore(hours: number): number {
  if (hours <= 0) return 0;
  if (hours >= 8 && hours <= 9) return 92;
  if (hours >= 7.5) return 85;
  if (hours >= 7) return 76;
  if (hours >= 6.5) return 66;
  if (hours >= 6) return 56;
  if (hours >= 5) return 42;
  return 22;
}

export function sleepQualityUiFromScore(score: number): SleepQualityUi {
  if (score >= 88) return 'great';
  if (score >= 72) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

export function qualityPctFromUi(q: SleepQualityUi): number {
  return ({ poor: 40, fair: 65, good: 82, great: 95 } as const)[q];
}

export interface SleepQualityInput {
  sleep_hours: number;
  deep_sleep_hours?: number | null;
  rem_sleep_hours?: number | null;
  sleep_efficiency?: number | null;
  /** When false, score uses duration (+ optional deep) only — for manual logs. */
  includeWearableMetrics?: boolean;
}

/** Derive display score and label from sleep metrics. */
export function deriveSleepQuality(input: SleepQualityInput): { score: number; quality: SleepQualityUi } {
  const h = input.sleep_hours;
  if (h <= 0) return { score: 0, quality: 'poor' };

  if (input.includeWearableMetrics === false) {
    let score = sleepDurationScore(h);
    if (input.deep_sleep_hours != null && input.deep_sleep_hours > 0) {
      const pct = (input.deep_sleep_hours / h) * 100;
      const bonus = pct >= 13 && pct <= 23 ? 6 : pct >= 10 && pct <= 28 ? 2 : -4;
      score = Math.min(100, Math.max(0, score + bonus));
    }
    return { score, quality: sleepQualityUiFromScore(score) };
  }

  let weightedSum = sleepDurationScore(h) / 100 * 4;
  let totalWeight = 4;

  if (input.sleep_efficiency != null && input.sleep_efficiency > 0) {
    const eff = input.sleep_efficiency;
    const s = eff >= 92 ? 1.0 : eff >= 88 ? 0.85 : eff >= 83 ? 0.70 : eff >= 75 ? 0.50 : 0.20;
    weightedSum += s * 3;
    totalWeight += 3;
  }

  if (input.deep_sleep_hours != null && input.deep_sleep_hours > 0) {
    const pct = (input.deep_sleep_hours / h) * 100;
    const s = pct >= 13 && pct <= 23 ? 1.0 : pct >= 10 && pct <= 28 ? 0.65 : 0.30;
    weightedSum += s * 2;
    totalWeight += 2;
  }

  if (input.rem_sleep_hours != null && input.rem_sleep_hours > 0) {
    const pct = (input.rem_sleep_hours / h) * 100;
    const s = pct >= 20 && pct <= 25 ? 1.0 : pct >= 15 && pct <= 30 ? 0.65 : 0.30;
    weightedSum += s * 1;
    totalWeight += 1;
  }

  const raw = weightedSum / totalWeight;
  const score = Math.round(raw * 100);
  return { score, quality: sleepQualityUiFromScore(score) };
}
