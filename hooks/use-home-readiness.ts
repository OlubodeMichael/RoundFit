import { useRecovery } from '@/hooks/use-recovery';
import type { RecoveryDisplay } from '@/context/recovery-context';

const EMPTY_DISPLAY: RecoveryDisplay = {
  score:          null,
  recommendation: null,
  reason:         null,
  sleepScore:     null,
  strainScore:    null,
  factors:        [],
  tips:           [],
  trend7d:        [],
  trend30d:       [],
};

/**
 * Home readiness — same full model as Recovery (cached in recovery context,
 * recomputed when underlying data changes). Avoids a second lightweight score.
 */
export function useHomeReadiness(): RecoveryDisplay {
  const { display, initialized } = useRecovery();
  if (!initialized && display.score === null) return EMPTY_DISPLAY;
  return display;
}
