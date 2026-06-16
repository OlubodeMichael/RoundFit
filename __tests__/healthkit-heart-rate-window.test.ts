import {
  filterHeartRatePointsToWindow,
  getWorkoutHeartRateWindow,
} from '@/utils/workout-heart-rate-window';

describe('getWorkoutHeartRateWindow', () => {
  it('uses start + durationSeconds, not an open-ended endDate', () => {
    const startDate = new Date('2026-06-16T09:00:00.000Z');
    const window = getWorkoutHeartRateWindow({
      startDate,
      durationSeconds: 45 * 60,
    });

    expect(window.startDate).toEqual(startDate);
    expect(window.endDate.getTime()).toBe(startDate.getTime() + 45 * 60 * 1000);
  });
});

describe('filterHeartRatePointsToWindow', () => {
  const start = new Date('2026-06-16T09:00:00');
  const end = new Date('2026-06-16T09:45:00');

  it('drops samples outside the workout window', () => {
    const points = [
      { timestamp: new Date('2026-06-16T08:59:00'), bpm: 70 },
      { timestamp: new Date('2026-06-16T09:10:00'), bpm: 130 },
      { timestamp: new Date('2026-06-16T09:45:00'), bpm: 120 },
      { timestamp: new Date('2026-06-16T10:00:00'), bpm: 80 },
    ];

    const filtered = filterHeartRatePointsToWindow(points, start, end);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((p) => p.bpm)).toEqual([130, 120]);
  });
});
