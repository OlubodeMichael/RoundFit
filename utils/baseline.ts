/**
 * Baseline helpers for HRV / resting-HR (Recovery Algorithm v2, item 1).
 *
 * Replaces the flat 30-day mean with an exponentially weighted moving average
 * so recent readings carry more influence, plus outlier rejection so one night
 * of bad sensor contact can't shift the baseline.
 */

const DEFAULT_ALPHA = 0.15;   // EWMA smoothing: 0.1 (slow/stable) … 0.2 (fast)
const DEFAULT_SIGMA = 2;      // reject readings > 2σ from the mean
const MIN_EWMA_READINGS = 5;  // below this, fall back to a simple mean

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((a, v) => a + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Drop readings more than `sigma` standard deviations from the mean. */
export function rejectOutliers(series: number[], sigma = DEFAULT_SIGMA): number[] {
  const valid = series.filter((v) => Number.isFinite(v) && v > 0);
  if (valid.length < 3) return valid; // too few to judge outliers reliably
  const avg = mean(valid);
  const sd = stdDev(valid, avg);
  if (sd === 0) return valid;
  return valid.filter((v) => Math.abs(v - avg) <= sigma * sd);
}

/**
 * Exponentially weighted moving average over a chronological (oldest → newest)
 * series. Seeded with the first reading. Returns null for an empty series.
 */
export function ewmaBaseline(series: number[], alpha = DEFAULT_ALPHA): number | null {
  if (series.length === 0) return null;
  let ewma = series[0];
  for (let i = 1; i < series.length; i++) {
    ewma = alpha * series[i] + (1 - alpha) * ewma;
  }
  return ewma;
}

/**
 * Full baseline pipeline: reject outliers, then EWMA once there are enough
 * readings, otherwise a simple mean. `series` must be chronological
 * (oldest → newest). Returns null when there's no usable data.
 */
export function computeBaseline(
  series: number[],
  { alpha = DEFAULT_ALPHA, sigma = DEFAULT_SIGMA }: { alpha?: number; sigma?: number } = {},
): number | null {
  const cleaned = rejectOutliers(series, sigma);
  if (cleaned.length === 0) return null;
  if (cleaned.length < MIN_EWMA_READINGS) return mean(cleaned);
  return ewmaBaseline(cleaned, alpha);
}
