/** Visual size of a sip dot on the 6 AM–midnight water timeline */

export interface TimelineBubbleSize {
  inner: number;
  halo: number;
}

const INNER_MIN = 8;
const INNER_MAX = 26;
const HALO_RATIO = 1.65;

/** Normalize ml to 0–1 using typical sip → bottle range */
function mlToUnit(ml: number): number {
  const min = 50;
  const max = 1000;
  const clamped = Math.min(Math.max(ml, min), max);
  return (clamped - min) / (max - min);
}

/**
 * Bubble diameter from amount. Uses the day's min/max when there is spread,
 * otherwise absolute ml tiers so a single entry still looks right.
 */
export function timelineBubbleForMl(
  ml: number,
  dayMinMl: number,
  dayMaxMl: number,
): TimelineBubbleSize {
  const absoluteT = mlToUnit(ml);

  let t = absoluteT;
  if (dayMaxMl > dayMinMl) {
    const relativeT = (ml - dayMinMl) / (dayMaxMl - dayMinMl);
    t = relativeT * 0.75 + absoluteT * 0.25;
  }

  const inner = INNER_MIN + t * (INNER_MAX - INNER_MIN);
  const halo = inner * HALO_RATIO;
  return { inner, halo };
}

export function timelineBubbleRange(entries: { amount_ml: number }[]): {
  minMl: number;
  maxMl: number;
} {
  if (entries.length === 0) {
    return { minMl: 0, maxMl: 0 };
  }
  const amounts = entries.map((e) => e.amount_ml);
  return {
    minMl: Math.min(...amounts),
    maxMl: Math.max(...amounts),
  };
}
