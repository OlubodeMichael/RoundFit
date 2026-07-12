import type { Directive } from '@/types/daily-coaching';

// ── Shared vocabulary ────────────────────────────────────────────────────────

/** Static mascot mood shown on the watch (no animation on-device). Mirrors MascotMood. */
export type WatchMood = 'calm' | 'alert' | 'energized' | 'recovery';

/** A single activity the user can pick and start from the wrist. */
export interface WatchQuickPick {
  /** workout-catalog id. */
  id: string;
  label: string;
  /** SF Symbol name (the watch renders SF Symbols, not Ionicons). */
  sfSymbol: string;
  mode: 'strength' | 'cardio';
}

/** Live phone-tracked workout state, surfaced so the watch can show + end it. */
export interface WatchWorkoutState {
  active: boolean;
  paused?: boolean;
  activityId?: string;
  label?: string;
  startedAt?: string; // ISO
  caloriesBurned?: number;
}

// ── Snapshot: phone → watch (latest-wins application context) ─────────────────

export interface WatchSnapshot {
  schema: 1;
  /** ISO timestamp the snapshot was built — drives the "as of" staleness label. */
  updatedAt: string;
  /** Client-local day (YYYY-MM-DD) the snapshot describes. */
  date: string;

  readiness: {
    /** 0–100, or null at cold start. */
    score: number | null;
    directive: Directive | null;
    /** Short wrist label, e.g. "Train hard" / "Rest up". */
    label: string;
    mood: WatchMood;
    /** One-line reason under the score. */
    reason: string | null;
    /** Detail metrics — each null when untracked; drives the swipe-left detail pages. */
    sleepScore: number | null;
    sleepHours: number | null;
    /** Sleep stages (hours) for the sleep graph; core = sleepHours − deep − rem. */
    deepSleepHours: number | null;
    remSleepHours: number | null;
    strainScore: number | null;
    soreness: number | null;
    hrv: number | null;
    restingHr: number | null;
  };

  /** Today's coach message (the iPhone home hero), or null before it's computed. */
  coaching: {
    title: string;
    message: string;
  } | null;

  energy: {
    /** budget − eaten. May be negative (over budget) — that's meaningful, keep it. */
    caloriesRemaining: number;
    calorieGoal: number;
    /** target − consumed. May be negative once the target is hit. */
    proteinRemaining: number;
    proteinGoal: number;
  };

  water: {
    currentMl: number;
    goalMl: number;
    /** Increment step for the +1 button. */
    cupMl: number;
  };

  /** Today's activity output. Each null when untracked. */
  activity: {
    steps: number | null;
    caloriesBurned: number | null;
  };

  workout: WatchWorkoutState;

  /** Top activities offered for on-watch selection. */
  quickPicks: WatchQuickPick[];
}

// ── Actions: watch → phone (sendMessage if reachable, else queued userInfo) ────

interface WatchActionBase {
  /** UUID minted on the watch — the phone dedups on this. */
  id: string;
  /** ISO timestamp the action was taken — lets the phone drop stale-day actions. */
  ts: string;
}

export type WatchAction =
  | (WatchActionBase & { type: 'logWater'; amountMl: number })
  | (WatchActionBase & { type: 'startWorkout'; activityId: string; calorieGoal?: number })
  | (WatchActionBase & { type: 'pauseWorkout' })
  | (WatchActionBase & { type: 'resumeWorkout' })
  | (WatchActionBase & { type: 'endWorkout' })
  | (WatchActionBase & { type: 'logWorkout'; activityId: string; durationMin: number });

export type WatchActionType = WatchAction['type'];
