import { PHASE_META } from '@/components/cycle/cycle-phase-config';
import type { CurrentCycle, CycleLog } from '@/context/cycle-context';

export interface CycleLogCardCopy {
  value: string;
  valueUnit?: string;
  caption: string;
  progress?: number;
}

export function buildCycleLogCardCopy(
  current: CurrentCycle | null,
  history: CycleLog[],
): CycleLogCardCopy {
  const cycleLength = history[0]?.cycle_length ?? current?.cycle_length ?? 28;
  const cycleDay =
    current?.day_of_cycle != null
      ? current.day_of_cycle
      : current?.days_remaining != null
        ? Math.max(cycleLength - current.days_remaining, 1)
        : null;

  if (history.length === 0 && cycleDay == null) {
    return {
      value: '—',
      caption: 'Not logged · tap to log period',
    };
  }

  const phaseLabel = current?.phase ? PHASE_META[current.phase].label : null;
  const nextPeriod = current?.predicted_next_period
    ? new Date(current.predicted_next_period)
    : null;
  const daysUntil = nextPeriod
    ? Math.ceil((nextPeriod.getTime() - Date.now()) / 86400000)
    : null;

  const parts: string[] = [];
  if (phaseLabel) parts.push(`${phaseLabel} phase`);
  if (daysUntil != null) {
    parts.push(daysUntil <= 0 ? 'period due today' : `${daysUntil}d to next period`);
  } else if (cycleDay != null) {
    parts.push(`day ${cycleDay} of ${cycleLength}`);
  }

  return {
    value: cycleDay != null ? String(cycleDay) : '—',
    valueUnit: cycleDay != null ? 'day' : undefined,
    caption: parts.length > 0 ? parts.join(' · ') : 'Tap to log or update',
    progress: cycleDay != null ? Math.min(cycleDay / cycleLength, 1) : undefined,
  };
}
