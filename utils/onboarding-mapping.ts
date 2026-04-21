/**
 * Maps raw onboarding IDs (as passed through expo-router query params) to the
 * canonical profile types used by the rest of the app.
 *
 * Onboarding screens use short, display-friendly IDs (e.g. `lose`, `muscle`,
 * `light`, `very`) for brevity in URLs. The server and the rest of the app
 * speak in canonical `UserProfile` values (e.g. `lose_weight`, `build_muscle`,
 * `lightly_active`, `very_active`). These helpers bridge the two and provide
 * safe defaults for missing or malformed values.
 */

import type { UserGoal, UserProfile } from '@/context/auth-context';

type Sex           = UserProfile['sex'];
type ActivityLevel = UserProfile['activityLevel'];
type Unit          = UserProfile['unit'];

const DEFAULT_GOAL:     UserGoal      = 'maintain';
const DEFAULT_ACTIVITY: ActivityLevel = 'lightly_active';
const DEFAULT_SEX:      Sex           = 'male';
const DEFAULT_UNIT:     Unit          = 'metric';

const GOAL_MAP: Record<string, UserGoal> = {
  lose:     'lose_weight',
  muscle:   'build_muscle',
  energy:   'boost_energy',
  maintain: 'maintain',
};

const ACTIVITY_MAP: Record<string, ActivityLevel> = {
  sedentary: 'sedentary',
  light:     'lightly_active',
  moderate:  'moderately_active',
  very:      'very_active',
};

export function mapOnboardingGoal(raw: string | undefined | null): UserGoal {
  return GOAL_MAP[raw ?? ''] ?? DEFAULT_GOAL;
}

export function mapOnboardingActivity(raw: string | undefined | null): ActivityLevel {
  return ACTIVITY_MAP[raw ?? ''] ?? DEFAULT_ACTIVITY;
}

export function mapOnboardingSex(raw: string | undefined | null): Sex {
  if (raw === 'female' || raw === 'male') return raw;
  return DEFAULT_SEX;
}

export function mapOnboardingUnit(raw: string | undefined | null): Unit {
  if (raw === 'imperial' || raw === 'metric') return raw;
  return DEFAULT_UNIT;
}
