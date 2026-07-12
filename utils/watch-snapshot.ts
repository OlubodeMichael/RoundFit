import type { Directive } from '@/types/daily-coaching';
import type {
  WatchMood,
  WatchQuickPick,
  WatchSnapshot,
  WatchWorkoutState,
} from '@/types/watch';

// Directive → static wrist mood. The watch has its own visual vocabulary (drives the
// SwiftUI accent colors), kept local + pure so this util pulls in no React Native and
// stays decoupled from the phone's LivingMascot component.
const DIRECTIVE_MOOD: Record<Directive, WatchMood> = {
  rest: 'calm',
  light: 'recovery',
  moderate: 'alert',
  train_hard: 'energized',
};

// Directive → short wrist label.
const DIRECTIVE_LABEL: Record<Directive, string> = {
  rest: 'Rest up',
  light: 'Keep it light',
  moderate: 'Moderate',
  train_hard: 'Train hard',
};

export function watchMood(directive: Directive | null): WatchMood {
  return directive ? DIRECTIVE_MOOD[directive] : 'alert';
}

export function watchDirectiveLabel(directive: Directive | null): string {
  return directive ? DIRECTIVE_LABEL[directive] : 'Go by feel';
}

// workout-catalog id → SF Symbol (the watch has no Ionicons). Unknown ids fall back
// to a generic cardio symbol so a new catalog entry never renders blank.
const WORKOUT_SF_SYMBOL: Record<string, string> = {
  walk: 'figure.walk',
  run: 'figure.run',
  running: 'figure.run',
  cycling: 'figure.outdoor.cycle',
  bike: 'figure.outdoor.cycle',
  swim: 'figure.pool.swim',
  strength: 'dumbbell.fill',
  weights: 'dumbbell.fill',
  hiit: 'figure.highintensity.intervaltraining',
  yoga: 'figure.yoga',
  rowing: 'figure.rower',
  elliptical: 'figure.elliptical',
  hike: 'figure.hiking',
};

export function sfSymbolForWorkout(catalogId: string): string {
  return WORKOUT_SF_SYMBOL[catalogId] ?? 'figure.mixed.cardio';
}

// ── The pure builder ─────────────────────────────────────────────────────────

/** Everything `buildWatchSnapshot` needs, already pulled off the phone's contexts. */
export interface WatchSnapshotSources {
  date: string;
  /** Injectable for deterministic tests; defaults to now. */
  now?: Date;

  readinessScore: number | null;
  directive: Directive | null;

  /** Readiness detail metrics for the swipe pages (each null when untracked). */
  readinessReason?: string | null;
  sleepScore?: number | null;
  sleepHours?: number | null;
  deepSleepHours?: number | null;
  remSleepHours?: number | null;
  strainScore?: number | null;
  soreness?: number | null;
  hrv?: number | null;
  restingHr?: number | null;

  /** Phrased coach message (title + body), or null before it resolves. */
  coachingTitle?: string | null;
  coachingMessage?: string | null;

  caloriesRemaining: number;
  calorieGoal: number;
  proteinRemaining: number;
  proteinGoal: number;

  waterCurrentMl: number;
  waterGoalMl: number;
  cupMl: number;

  steps?: number | null;
  caloriesBurned?: number | null;

  workout: WatchWorkoutState | null;
  quickPicks: WatchQuickPick[];
}

const r = (n: number) => Math.round(n);

/**
 * Builds the wrist snapshot from already-extracted phone state. Pure and
 * deterministic (pass `now` to pin `updatedAt`). Numbers are rounded but NOT floored —
 * a negative "remaining" honestly means over budget / target hit.
 */
export function buildWatchSnapshot(src: WatchSnapshotSources): WatchSnapshot {
  const now = src.now ?? new Date();

  return {
    schema: 1,
    updatedAt: now.toISOString(),
    date: src.date,

    readiness: {
      score: src.readinessScore == null ? null : r(src.readinessScore),
      directive: src.directive,
      label: watchDirectiveLabel(src.directive),
      mood: watchMood(src.directive),
      reason: src.readinessReason ?? null,
      sleepScore: src.sleepScore == null ? null : r(src.sleepScore),
      sleepHours: src.sleepHours ?? null,
      deepSleepHours: src.deepSleepHours ?? null,
      remSleepHours: src.remSleepHours ?? null,
      strainScore: src.strainScore == null ? null : r(src.strainScore),
      soreness: src.soreness ?? null,
      hrv: src.hrv == null ? null : r(src.hrv),
      restingHr: src.restingHr == null ? null : r(src.restingHr),
    },

    coaching:
      src.coachingTitle && src.coachingMessage
        ? { title: src.coachingTitle, message: src.coachingMessage }
        : null,

    energy: {
      caloriesRemaining: r(src.caloriesRemaining),
      calorieGoal: r(src.calorieGoal),
      proteinRemaining: r(src.proteinRemaining),
      proteinGoal: r(src.proteinGoal),
    },

    water: {
      currentMl: r(src.waterCurrentMl),
      goalMl: r(src.waterGoalMl),
      cupMl: r(src.cupMl),
    },

    activity: {
      steps: src.steps == null ? null : r(src.steps),
      caloriesBurned: src.caloriesBurned == null ? null : r(src.caloriesBurned),
    },

    workout: src.workout ?? { active: false },

    quickPicks: src.quickPicks,
  };
}

/**
 * Stable content hash of a snapshot, EXCLUDING `updatedAt`, so the sync hook only
 * pushes to the watch when something the user would see actually changed (not on every
 * timestamp tick). Mirrors the coaching-cache fingerprint approach.
 */
export function watchSnapshotFingerprint(s: WatchSnapshot): string {
  const { updatedAt: _omit, ...rest } = s;
  return JSON.stringify(rest);
}
