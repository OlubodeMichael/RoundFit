import { useEffect, useState } from 'react';

import type {
  HealthKitHeartRatePoint,
  HealthKitWorkoutEnergy,
  HealthKitWorkoutSample,
} from '@/utils/healthkit';
import {
  fetchHeartRateSamplesDuringWindow,
  fetchWorkoutEnergyDuringWindow,
} from '@/utils/healthkit';

export interface UseHealthKitWorkoutEnrichmentResult {
  energy: HealthKitWorkoutEnergy | null;
  heartRatePoints: HealthKitHeartRatePoint[];
  isLoading: boolean;
}

export function useHealthKitWorkoutEnrichment(
  sample: HealthKitWorkoutSample | null,
): UseHealthKitWorkoutEnrichmentResult {
  const [energy, setEnergy] = useState<HealthKitWorkoutEnergy | null>(null);
  const [heartRatePoints, setHeartRatePoints] = useState<HealthKitHeartRatePoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!sample) {
      setEnergy(null);
      setHeartRatePoints([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      try {
        const [energyResult, heartRateResult] = await Promise.all([
          fetchWorkoutEnergyDuringWindow(sample.startDate, sample.endDate),
          fetchHeartRateSamplesDuringWindow(sample.startDate, sample.endDate),
        ]);

        if (cancelled) return;
        setEnergy(energyResult);
        setHeartRatePoints(heartRateResult);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [sample]);

  return { energy, heartRatePoints, isLoading };
}
