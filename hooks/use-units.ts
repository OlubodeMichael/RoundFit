import { useMemo } from 'react';
import { useProfile } from '@/hooks/use-profile';
import { LB_PER_KG } from '@/utils/body-units';
import type { ProfileUnit } from '@/utils/body-units';
import { distanceUnit } from '@/utils/units';

export interface UnitsValue {
  profileUnit: ProfileUnit;
  weightUnit: 'kg' | 'lb';
  distanceUnit: 'km' | 'mi';
  toDisplayWeight: (weightKg: number) => number;
  toKg: (weight: number, weightUnit: 'kg' | 'lb') => number;
}

export function useUnits(): UnitsValue {
  const { profile } = useProfile();

  return useMemo(() => {
    const profileUnit: ProfileUnit = profile?.unit ?? 'metric';
    const weightUnit: 'kg' | 'lb' = profileUnit === 'imperial' ? 'lb' : 'kg';
    const resolvedDistanceUnit: 'km' | 'mi' = distanceUnit(profileUnit);

    const toDisplayWeight = (weightKg: number): number =>
      weightUnit === 'lb' ? weightKg * LB_PER_KG : weightKg;

    const toKg = (weight: number, unit: 'kg' | 'lb'): number =>
      unit === 'lb' ? weight / LB_PER_KG : weight;

    return { profileUnit, weightUnit, distanceUnit: resolvedDistanceUnit, toDisplayWeight, toKg };
  }, [profile?.unit]);
}

