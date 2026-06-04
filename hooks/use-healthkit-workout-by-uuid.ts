import { useCallback, useEffect, useState } from 'react';

import type { HealthKitWorkoutSample } from '@/utils/healthkit';
import { fetchHealthKitWorkoutByUuid } from '@/utils/healthkit';

export interface UseHealthKitWorkoutByUuidResult {
  sample: HealthKitWorkoutSample | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useHealthKitWorkoutByUuid(
  uuid: string | undefined,
): UseHealthKitWorkoutByUuidResult {
  const [sample, setSample] = useState<HealthKitWorkoutSample | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!uuid) {
      setSample(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const found = await fetchHealthKitWorkoutByUuid(uuid);
      if (!found) {
        setSample(null);
        setError('This workout is no longer available in Apple Health.');
        return;
      }
      setSample(found);
    } catch (err: unknown) {
      setSample(null);
      setError(err instanceof Error ? err.message : 'Failed to load workout from Apple Health');
    } finally {
      setIsLoading(false);
    }
  }, [uuid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { sample, isLoading, error, refresh };
}
