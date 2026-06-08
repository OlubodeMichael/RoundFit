import { useCallback, useEffect, useState } from 'react';

import { useProfile } from '@/hooks/use-profile';
import { getCachedLocalTargets, getLocalTargets } from '@/utils/local-targets';
import { registerTodayTargetsListener } from '@/utils/today-sync';

export const DEFAULT_STEPS_TARGET = 10_000;

function resolveStepsTarget(
  profileSteps: number | undefined,
  localSteps: number | null | undefined,
): number {
  return profileSteps ?? localSteps ?? DEFAULT_STEPS_TARGET;
}

/** Daily step goal from profile + local targets; updates when targets are saved. */
export function useStepsTarget(): number {
  const { profile } = useProfile();

  const [stepsTarget, setStepsTarget] = useState(() =>
    resolveStepsTarget(
      profile?.stepsTarget,
      getCachedLocalTargets()?.steps_target,
    ),
  );

  const reload = useCallback(async () => {
    const local = await getLocalTargets();
    setStepsTarget(resolveStepsTarget(profile?.stepsTarget, local.steps_target));
  }, [profile?.stepsTarget]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return registerTodayTargetsListener(() => {
      void reload();
    });
  }, [reload]);

  return stepsTarget;
}
