import type { CyclePhase } from '@/context/cycle-context';
import type { Directive } from '@/types/daily-coaching';

export interface DurationGuidance {
  /** Human duration guidance, or null for `rest`. */
  text: string | null;
  /** True when the late-luteal cap reduced the guidance below the directive's default. */
  capped: boolean;
}

const BASE_DURATION: Record<Directive, string | null> = {
  rest: null,
  light: '20 to 30 minutes',
  moderate: '30 to 45 minutes',
  train_hard: '45 to 60 minutes',
};

// Late-luteal: energy/thermoregulation dip. Cap the top-end sessions one notch.
const LUTEAL_CAP: Partial<Record<Directive, string>> = {
  train_hard: '30 to 45 minutes',
  moderate: '25 to 35 minutes',
};

/** True in the late-luteal window (a few days before the next period). */
function isLateLuteal(cycle: { include: boolean; phase: CyclePhase; days_remaining: number | null }): boolean {
  return (
    cycle.include &&
    cycle.phase === 'luteal' &&
    cycle.days_remaining != null &&
    cycle.days_remaining <= 3
  );
}

/**
 * Maps a directive to duration guidance, applying the late-luteal cap. `rest`
 * always returns null text. The cap only ever reduces guidance, never raises it.
 */
export function coachingDuration(
  directive: Directive,
  cycle: { include: boolean; phase: CyclePhase; days_remaining: number | null },
): DurationGuidance {
  const base = BASE_DURATION[directive];
  if (base == null) return { text: null, capped: false };

  if (isLateLuteal(cycle) && LUTEAL_CAP[directive]) {
    return { text: LUTEAL_CAP[directive]!, capped: true };
  }

  return { text: base, capped: false };
}
