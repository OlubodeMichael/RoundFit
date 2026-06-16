export interface WorkoutHeartRateSample {
  timestamp: Date;
  bpm: number;
}

/** Query/chart window scoped to the workout period (start → start + duration). */
export function getWorkoutHeartRateWindow(sample: {
  startDate: Date;
  durationSeconds: number;
}): { startDate: Date; endDate: Date } {
  const startMs = sample.startDate.getTime();
  const durationMs = Math.max(sample.durationSeconds, 1) * 1000;
  return {
    startDate: new Date(startMs),
    endDate: new Date(startMs + durationMs),
  };
}

export function filterHeartRatePointsToWindow<T extends WorkoutHeartRateSample>(
  points: readonly T[],
  startDate: Date,
  endDate: Date,
): T[] {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  return points.filter((point) => {
    const t = point.timestamp.getTime();
    return t >= startMs && t <= endMs;
  });
}
