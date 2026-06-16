import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/constants/badges', () => ({
  BADGE_CATALOGUE: [
    { id: 'first_food_log', name: 'First Log', description: '', icon: '🍽', category: 'starter' },
    { id: 'streak_3', name: 'Streak', description: '', icon: '🔥', category: 'streak' },
  ],
  badgeById: (id: string) =>
    ({
      first_food_log: { id: 'first_food_log', name: 'First Log', description: '', icon: '🍽', category: 'starter' },
      streak_3: { id: 'streak_3', name: 'Streak', description: '', icon: '🔥', category: 'streak' },
    })[id],
}));

jest.mock('@/utils/api', () => ({
  apiFetch: jest.fn(),
  publicApiFetch: jest.fn(),
}));

import { apiFetch } from '@/utils/api';
import {
  getBadgesCached,
  loadBadges,
  patchBadgesAck,
} from '@/utils/badges-cache';

let counter = 0;
function uid(): string {
  counter += 1;
  return `user-badges-${counter}`;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.mocked(apiFetch).mockReset();
});

describe('badges-cache', () => {
  it('serves from cache without calling the API when an entry exists', async () => {
    const userId = uid();
    jest.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      body: {
        badges: [{ id: 'first_food_log', earned: true, earned_at: '2026-06-01', times_earned: 1 }],
        unnotified: [{ award_id: 'award-1', badge_id: 'first_food_log' }],
      },
    });

    await loadBadges(userId);
    expect(apiFetch).toHaveBeenCalledTimes(1);

    jest.mocked(apiFetch).mockClear();
    const cached = await loadBadges(userId);
    expect(apiFetch).not.toHaveBeenCalled();
    expect(cached.unnotified).toEqual([{ award_id: 'award-1', badge_id: 'first_food_log' }]);
    expect(cached.badges[0].times_earned).toBe(1);
  });

  it('patchBadgesAck removes award ids locally without a refetch', async () => {
    const userId = uid();
    jest.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      body: {
        badges: [{ id: 'first_food_log', earned: true, earned_at: '2026-06-01', times_earned: 1 }],
        unnotified: [
          { award_id: 'award-1', badge_id: 'first_food_log' },
          { award_id: 'award-2', badge_id: 'streak_3' },
        ],
      },
    });

    await loadBadges(userId);
    const patched = await patchBadgesAck(userId, ['award-1']);
    expect(patched?.unnotified).toEqual([{ award_id: 'award-2', badge_id: 'streak_3' }]);

    jest.mocked(apiFetch).mockClear();
    const fromDisk = await getBadgesCached(userId);
    expect(fromDisk?.unnotified).toEqual([{ award_id: 'award-2', badge_id: 'streak_3' }]);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('force reload updates cache from the API', async () => {
    const userId = uid();
    jest.mocked(apiFetch)
      .mockResolvedValueOnce({
        ok: true,
        body: { badges: [], unnotified: [] },
      })
      .mockResolvedValueOnce({
        ok: true,
        body: {
          badges: [{ id: 'streak_3', earned: true, earned_at: '2026-06-02', times_earned: 2 }],
          unnotified: [{ award_id: 'award-3', badge_id: 'streak_3' }],
        },
      });

    await loadBadges(userId);
    const fresh = await loadBadges(userId, { force: true });
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(fresh.unnotified).toEqual([{ award_id: 'award-3', badge_id: 'streak_3' }]);
    expect(fresh.badges.find((b) => b.id === 'streak_3')?.times_earned).toBe(2);
  });
});
