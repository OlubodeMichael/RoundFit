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
import {
  filterHeartRatePointsToWindow,
  getWorkoutHeartRateWindow,
} from '@/utils/workout-heart-rate-window';

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
    const window = getWorkoutHeartRateWindow(sample);

    void (async () => {
      try {
        const [energyResult, heartRateResult] = await Promise.all([
          fetchWorkoutEnergyDuringWindow(window.startDate, window.endDate),
          fetchHeartRateSamplesDuringWindow(window.startDate, window.endDate),
        ]);

        if (cancelled) return;
        setEnergy(energyResult);
        setHeartRatePoints(
          filterHeartRatePointsToWindow(heartRateResult, window.startDate, window.endDate),
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [sample]);

  return { energy, heartRatePoints, isLoading };
}
