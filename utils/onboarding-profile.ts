import type { UserProfile } from '@/context/auth-context';
import {
  mapOnboardingActivity,
  mapOnboardingGoal,
  mapOnboardingSex,
  mapOnboardingUnit,
} from '@/utils/onboarding-mapping';

export type OnboardingRouteParams = {
  name?: string;
  age?: string;
  sex?: string;
  height?: string;
  weight?: string;
  goal?: string;
  activity?: string;
  unit?: string;
};

export function hasOnboardingParams(params: OnboardingRouteParams): boolean {
  return Boolean(
    params.name?.trim() &&
      params.age &&
      params.height &&
      params.weight &&
      params.goal &&
      params.activity,
  );
}

export function buildOnboardingProfile(
  params: OnboardingRouteParams,
): Omit<UserProfile, 'id' | 'email' | 'createdAt' | 'tdee' | 'calorieBudget'> {
  return {
    name: params.name?.trim() ?? '',
    age: params.age ? Number(params.age) : 0,
    sex: mapOnboardingSex(params.sex),
    heightCm: params.height ? Number(params.height) : 0,
    weightKg: params.weight ? Number(params.weight) : 0,
    goal: mapOnboardingGoal(params.goal),
    activityLevel: mapOnboardingActivity(params.activity),
    unit: mapOnboardingUnit(params.unit),
  };
}
