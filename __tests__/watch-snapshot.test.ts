import {
  buildWatchSnapshot,
  sfSymbolForWorkout,
  watchDirectiveLabel,
  watchMood,
  watchSnapshotFingerprint,
  type WatchSnapshotSources,
} from '@/utils/watch-snapshot';

function sources(over: Partial<WatchSnapshotSources> = {}): WatchSnapshotSources {
  return {
    date: '2026-07-07',
    now: new Date('2026-07-07T08:00:00.000Z'),
    readinessScore: 72.4,
    directive: 'train_hard',
    caloriesRemaining: 1240.6,
    calorieGoal: 2200,
    proteinRemaining: 40.2,
    proteinGoal: 160,
    waterCurrentMl: 1250,
    waterGoalMl: 2000,
    cupMl: 250,
    workout: null,
    quickPicks: [],
    ...over,
  };
}

describe('watchMood / watchDirectiveLabel', () => {
  it('maps each directive to its mood', () => {
    expect(watchMood('rest')).toBe('calm');
    expect(watchMood('light')).toBe('recovery');
    expect(watchMood('moderate')).toBe('alert');
    expect(watchMood('train_hard')).toBe('energized');
  });

  it('falls back to alert / go-by-feel when there is no directive', () => {
    expect(watchMood(null)).toBe('alert');
    expect(watchDirectiveLabel(null)).toBe('Go by feel');
  });
});

describe('sfSymbolForWorkout', () => {
  it('maps known ids and falls back for unknown', () => {
    expect(sfSymbolForWorkout('run')).toBe('figure.run');
    expect(sfSymbolForWorkout('strength')).toBe('dumbbell.fill');
    expect(sfSymbolForWorkout('some-new-activity')).toBe('figure.mixed.cardio');
  });
});

describe('buildWatchSnapshot', () => {
  it('rounds numbers and derives readiness label + mood', () => {
    const s = buildWatchSnapshot(sources());
    expect(s.schema).toBe(1);
    expect(s.updatedAt).toBe('2026-07-07T08:00:00.000Z');
    expect(s.readiness).toEqual({
      score: 72,
      directive: 'train_hard',
      label: 'Train hard',
      mood: 'energized',
    });
    expect(s.energy.caloriesRemaining).toBe(1241);
    expect(s.energy.proteinRemaining).toBe(40);
  });

  it('keeps negative remaining (over budget / target hit) — never floored', () => {
    const s = buildWatchSnapshot(
      sources({ caloriesRemaining: -180, proteinRemaining: -12 }),
    );
    expect(s.energy.caloriesRemaining).toBe(-180);
    expect(s.energy.proteinRemaining).toBe(-12);
  });

  it('preserves a null readiness score at cold start', () => {
    const s = buildWatchSnapshot(sources({ readinessScore: null, directive: null }));
    expect(s.readiness.score).toBeNull();
    expect(s.readiness.mood).toBe('alert');
    expect(s.readiness.label).toBe('Go by feel');
  });

  it('defaults workout to inactive when none is passed', () => {
    expect(buildWatchSnapshot(sources()).workout).toEqual({ active: false });
  });
});

describe('watchSnapshotFingerprint', () => {
  it('ignores updatedAt so only visible changes trigger a push', () => {
    const a = buildWatchSnapshot(sources({ now: new Date('2026-07-07T08:00:00Z') }));
    const b = buildWatchSnapshot(sources({ now: new Date('2026-07-07T09:30:00Z') }));
    expect(watchSnapshotFingerprint(a)).toBe(watchSnapshotFingerprint(b));
  });

  it('changes when a visible value changes', () => {
    const a = buildWatchSnapshot(sources({ waterCurrentMl: 1250 }));
    const b = buildWatchSnapshot(sources({ waterCurrentMl: 1500 }));
    expect(watchSnapshotFingerprint(a)).not.toBe(watchSnapshotFingerprint(b));
  });
});
