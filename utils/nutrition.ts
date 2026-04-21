/**
 * Client-side nutrition math: BMR, TDEE, calorie budget, and macro targets.
 *
 * All functions are pure and deterministic. They take canonical profile types
 * (see `@/context/auth-context`) so callers with raw onboarding IDs must
 * normalise first (e.g. via `sign-up.tsx`'s `mapGoal` / `mapActivity`).
 *
 * Formula references:
 *   - BMR: Mifflin-St Jeor (1990) — the current ACSM-recommended default.
 *   - Activity multipliers: Harris-Benedict-derived, commonly used in practice.
 *   - Protein g/kg: goal-aware, anchored to ISSN position stand (1.6–2.2 g/kg).
 */

import type { UserProfile, UserGoal } from '@/context/auth-context';

// ── Types ──────────────────────────────────────────────────────────────────

export type Sex           = UserProfile['sex'];
export type ActivityLevel = UserProfile['activityLevel'];

export interface NutritionInput {
  sex:           Sex;
  /** Whole years. */
  age:           number;
  heightCm:      number;
  weightKg:      number;
  activityLevel: ActivityLevel;
  goal:          UserGoal;
}

export interface MacroTargets {
  /** Protein target in grams/day. */
  proteinG:    number;
  /** Carbs target in grams/day. */
  carbsG:      number;
  /** Fat target in grams/day. */
  fatG:        number;
  /** Kcal contributed by protein (proteinG × 4). */
  proteinKcal: number;
  /** Kcal contributed by carbs (carbsG × 4). */
  carbsKcal:   number;
  /** Kcal contributed by fat (fatG × 9). */
  fatKcal:     number;
}

export interface NutritionPlan {
  /** Basal metabolic rate (kcal/day). */
  bmr:           number;
  /** Total daily energy expenditure (kcal/day). */
  tdee:          number;
  /** Target intake for the user's goal (kcal/day). */
  calorieBudget: number;
  /** Macro breakdown for `calorieBudget`. */
  macros:        MacroTargets;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Kcal per gram of each macronutrient. */
export const KCAL_PER_G_PROTEIN = 4;
export const KCAL_PER_G_CARBS   = 4;
export const KCAL_PER_G_FAT     = 9;

/** Activity multiplier applied to BMR to yield TDEE. */
const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary:         1.2,
  lightly_active:    1.375,
  moderately_active: 1.55,
  very_active:       1.725,
};

/** Calorie delta vs TDEE for each goal (kcal/day). */
const GOAL_CALORIE_DELTA: Record<UserGoal, number> = {
  lose_weight:  -500,
  build_muscle:  300,
  boost_energy:    0,
  maintain:        0,
};

/** Protein target in g per kg of bodyweight, tuned per goal. */
const PROTEIN_G_PER_KG: Record<UserGoal, number> = {
  lose_weight:  2.0,
  build_muscle: 2.0,
  boost_energy: 1.6,
  maintain:     1.6,
};

/** Fraction of total daily kcal that should come from fat. */
const FAT_KCAL_SHARE: Record<UserGoal, number> = {
  lose_weight:  0.28,
  build_muscle: 0.25,
  boost_energy: 0.30,
  maintain:     0.28,
};

/** Safety floors so aggressive goals don't produce unsafe budgets. */
const MIN_CALORIE_BUDGET_MALE   = 1500;
const MIN_CALORIE_BUDGET_FEMALE = 1200;

// ── Core calculators ───────────────────────────────────────────────────────

/**
 * Mifflin-St Jeor basal metabolic rate.
 * Returns kcal/day rounded to the nearest integer.
 */
export function calculateBMR(
  input: Pick<NutritionInput, 'sex' | 'age' | 'heightCm' | 'weightKg'>,
): number {
  const { sex, age, heightCm, weightKg } = input;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr  = sex === 'male' ? base + 5 : base - 161;
  return Math.round(bmr);
}

/**
 * Total daily energy expenditure = BMR × activity multiplier.
 * Represents maintenance calories before any goal adjustment.
 */
export function calculateTDEE(
  input: Pick<NutritionInput, 'sex' | 'age' | 'heightCm' | 'weightKg' | 'activityLevel'>,
): number {
  const bmr = calculateBMR(input);
  return Math.round(bmr * ACTIVITY_MULTIPLIER[input.activityLevel]);
}

/**
 * Target daily calories for the user's goal, floor-clamped by sex.
 * Formula: TDEE + goal delta, never below the safety floor.
 */
export function calculateCalorieBudget(input: NutritionInput): number {
  const tdee     = calculateTDEE(input);
  const adjusted = tdee + GOAL_CALORIE_DELTA[input.goal];
  const floor    = input.sex === 'female' ? MIN_CALORIE_BUDGET_FEMALE : MIN_CALORIE_BUDGET_MALE;
  return Math.max(floor, Math.round(adjusted));
}

/**
 * Macro targets for a given calorie budget.
 *
 * Allocation order (protein first, fat second, carbs fill the rest):
 *   1. Protein  → fixed g/kg (goal-aware)
 *   2. Fat      → fixed share of total kcal (goal-aware)
 *   3. Carbs    → whatever kcal remain
 *
 * If `calorieBudget` is omitted it is computed from `input`.
 */
export function calculateMacros(
  input: NutritionInput,
  calorieBudget: number = calculateCalorieBudget(input),
): MacroTargets {
  const proteinG    = Math.round(input.weightKg * PROTEIN_G_PER_KG[input.goal]);
  const proteinKcal = proteinG * KCAL_PER_G_PROTEIN;

  const fatKcal = Math.round(calorieBudget * FAT_KCAL_SHARE[input.goal]);
  const fatG    = Math.round(fatKcal / KCAL_PER_G_FAT);

  const remainingKcal = Math.max(0, calorieBudget - proteinKcal - fatKcal);
  const carbsG        = Math.round(remainingKcal / KCAL_PER_G_CARBS);
  const carbsKcal     = carbsG * KCAL_PER_G_CARBS;

  return { proteinG, carbsG, fatG, proteinKcal, carbsKcal, fatKcal };
}

/**
 * One-shot: BMR + TDEE + calorie budget + macros.
 * This is the function the onboarding reveal screen should call.
 */
export function calculateNutritionPlan(input: NutritionInput): NutritionPlan {
  const bmr           = calculateBMR(input);
  const tdee          = calculateTDEE(input);
  const calorieBudget = calculateCalorieBudget(input);
  const macros        = calculateMacros(input, calorieBudget);
  return { bmr, tdee, calorieBudget, macros };
}
