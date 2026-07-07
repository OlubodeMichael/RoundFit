import type { DailyCoachingDecision } from '@/types/daily-coaching';
import { coachingBadgeCount, visibleBadgeCount } from '@/utils/coaching-badge';

function decision(
  over: Partial<DailyCoachingDecision> = {},
): DailyCoachingDecision {
  return {
    directive: 'moderate',
    safety_override: false,
    primary_reason: 'Moderate session today.',
    duration_text: '30 to 45 minutes',
    secondary_action: null,
    habit_nudge: null,
    focus: 'training',
    dropped: [],
    confidence: 'full',
    nutrition_gap: null,
    assembled_at: '2026-07-07T08:00:00.000Z',
    ...over,
  };
}

describe('coachingBadgeCount — honest, never padded', () => {
  it('is 1 for a directive alone', () => {
    expect(coachingBadgeCount(decision())).toBe(1);
  });

  it('stacks +1 for a nutrition action', () => {
    expect(coachingBadgeCount(decision({ secondary_action: 'Aim for 40g more protein.' }))).toBe(2);
  });

  it('stacks +1 for a habit nudge', () => {
    expect(coachingBadgeCount(decision({ habit_nudge: 'Drink more water.' }))).toBe(2);
  });

  it('caps at 3 with every event present', () => {
    expect(
      coachingBadgeCount(
        decision({ secondary_action: 'protein', habit_nudge: 'water' }),
      ),
    ).toBe(3);
  });
});

describe('visibleBadgeCount — clears on open, re-badges on new info', () => {
  const d = decision({ secondary_action: 'protein' });
  const fp = 'fp-1';

  it('shows the honest count when never opened', () => {
    expect(visibleBadgeCount(d, fp, null)).toBe(2);
  });

  it('clears to 0 once this exact decision is opened', () => {
    expect(visibleBadgeCount(d, fp, { date: '2026-07-07', fingerprint: fp })).toBe(0);
  });

  it('re-badges when the decision fingerprint changes (new event)', () => {
    expect(
      visibleBadgeCount(d, 'fp-2', { date: '2026-07-07', fingerprint: 'fp-1' }),
    ).toBe(2);
  });
});
