import AsyncStorage from '@react-native-async-storage/async-storage';

// daily-summary-cache fetches through @/utils/api (native deps). Stub it.
jest.mock('@/utils/api', () => ({
  apiFetch: jest.fn(),
  publicApiFetch: jest.fn(),
}));

import { apiFetch } from '@/utils/api';
import {
  buildSummaryCacheKey,
  fetchDailySummaryBundle,
  getCachedSummary,
  invalidateSummaryCache,
  invalidateUserDayCaches,
  setCachedSummary,
  type DailySummaryBundle,
  TTL_COLD_START_MS,
  TTL_SUMMARY_CURRENT_DAY,
  TTL_SUMMARY_PAST_DAY,
  TTL_FOREGROUND_SKIP_MS,
} from '@/utils/daily-summary-cache';

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

const FRESH = 1_000_000;
const STALE = -1_000;

let counter = 0;
function uniqueDate(): string {
  counter += 1;
  return `2026-01-${String(counter).padStart(2, '0')}`;
}

function bundle(overrides: Partial<DailySummaryBundle['daily']> = {}): DailySummaryBundle {
  return {
    daily: {
      date: '2026-01-01',
      calorie_budget: 2200,
      calories_consumed: 1450,
      calories_burned: 320,
      net_calories: 1130,
      delta: -750,
      protein_consumed: 98,
      carbs_consumed: 140,
      fat_consumed: 44,
      water_glasses: 5,
      calorie_burn_source: 'healthkit',
      ...overrides,
    },
    raw: {},
    computed_at: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockApiFetch.mockReset();
});

describe('TTL constants', () => {
  it('match the documented contract', () => {
    expect(TTL_COLD_START_MS).toBe(2 * 60 * 60 * 1000);
    expect(TTL_SUMMARY_CURRENT_DAY).toBe(TTL_COLD_START_MS);
    expect(TTL_SUMMARY_PAST_DAY).toBe(24 * 60 * 60 * 1000);
    expect(TTL_FOREGROUND_SKIP_MS).toBe(15 * 60 * 1000);
  });
});

describe('buildSummaryCacheKey', () => {
  it('namespaces by version, user, and date', () => {
    expect(buildSummaryCacheKey('user-1', '2026-06-09')).toBe(
      'daily-summary:v1:user-1:2026-06-09',
    );
  });
});

describe('get/set round-trip', () => {
  it('marks future-TTL fresh and past-TTL stale', async () => {
    const key = buildSummaryCacheKey('u', uniqueDate());
    await setCachedSummary(key, bundle(), FRESH);
    expect((await getCachedSummary(key))?.isStale).toBe(false);

    await setCachedSummary(key, bundle(), STALE);
    expect((await getCachedSummary(key))?.isStale).toBe(true);
  });

  it('hydrates from AsyncStorage when mem is cold', async () => {
    const key = buildSummaryCacheKey('u', uniqueDate());
    await AsyncStorage.setItem(
      key,
      JSON.stringify({ data: bundle({ calories_consumed: 999 }), expiresAt: Date.now() + FRESH }),
    );
    const got = await getCachedSummary(key);
    expect(got?.data.daily.calories_consumed).toBe(999);
    expect(got?.isStale).toBe(false);
  });

  it('returns null for an absent key', async () => {
    expect(await getCachedSummary(buildSummaryCacheKey('u', uniqueDate()))).toBeNull();
  });
});

describe('fetchDailySummaryBundle', () => {
  it('fetches /summary/daily, parses the bundle, and caches it', async () => {
    const date = uniqueDate();
    mockApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        summary: {
          date,
          calorie_budget: 2000,
          calories_consumed: 1500,
          calories_burned: 300,
          net_calories: 1200,
          delta: -500,
          protein_consumed: 100,
          carbs_consumed: 150,
          fat_consumed: 50,
          water_glasses: 6,
          calorie_burn_source: 'baseline',
        },
        computed_at: '2026-01-01T10:00:00.000Z',
      },
    });

    const result = await fetchDailySummaryBundle('u', date);
    expect(mockApiFetch).toHaveBeenCalledWith(`/summary/daily/${date}`);
    expect(result?.daily.calories_consumed).toBe(1500);
    expect(result?.daily.calorie_burn_source).toBe('baseline');
    // Cached for next time.
    const cached = await getCachedSummary(buildSummaryCacheKey('u', date));
    expect(cached?.data.daily.calories_consumed).toBe(1500);
  });

  it('serves a fresh cache hit without calling the network', async () => {
    const date = uniqueDate();
    await setCachedSummary(buildSummaryCacheKey('u', date), bundle({ calories_consumed: 111 }), FRESH);
    const result = await fetchDailySummaryBundle('u', date);
    expect(result?.daily.calories_consumed).toBe(111);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('bypasses a fresh cache when force is set', async () => {
    const date = uniqueDate();
    await setCachedSummary(buildSummaryCacheKey('u', date), bundle({ calories_consumed: 111 }), FRESH);
    mockApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: { summary: { date, calories_consumed: 222 }, computed_at: 'x' },
    });
    const result = await fetchDailySummaryBundle('u', date, { force: true });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(result?.daily.calories_consumed).toBe(222);
  });

  it('returns null and caches nothing when the request fails', async () => {
    const date = uniqueDate();
    mockApiFetch.mockResolvedValue({ ok: false, status: 500, body: {} });
    expect(await fetchDailySummaryBundle('u', date)).toBeNull();
    expect(await getCachedSummary(buildSummaryCacheKey('u', date))).toBeNull();
  });

  it('returns null when the response has no summary object', async () => {
    const date = uniqueDate();
    mockApiFetch.mockResolvedValue({ ok: true, status: 200, body: { computed_at: 'x' } });
    expect(await fetchDailySummaryBundle('u', date)).toBeNull();
  });

  it('defaults missing numeric fields to 0 and a non-string burn source to null', async () => {
    const date = uniqueDate();
    mockApiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: { summary: { date, calorie_burn_source: 42 }, computed_at: 'x' },
    });
    const result = await fetchDailySummaryBundle('u', date);
    expect(result?.daily.calories_consumed).toBe(0);
    expect(result?.daily.calorie_budget).toBe(0);
    expect(result?.daily.calorie_burn_source).toBeNull();
  });

  it('dedupes concurrent fetches for the same key', async () => {
    const date = uniqueDate();
    let resolve!: (v: { ok: boolean; status: number; body: Record<string, unknown> }) => void;
    mockApiFetch.mockReturnValue(new Promise((res) => { resolve = res; }) as ReturnType<typeof apiFetch>);

    const a = fetchDailySummaryBundle('u', date);
    const b = fetchDailySummaryBundle('u', date);
    await new Promise((r) => setTimeout(r, 0));
    resolve({ ok: true, status: 200, body: { summary: { date, calories_consumed: 7 }, computed_at: 'x' } });

    expect((await a)?.daily.calories_consumed).toBe(7);
    expect((await b)?.daily.calories_consumed).toBe(7);
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });
});

describe('invalidation', () => {
  it('invalidateSummaryCache drops the entry', async () => {
    const key = buildSummaryCacheKey('u', uniqueDate());
    await setCachedSummary(key, bundle(), FRESH);
    await invalidateSummaryCache(key);
    expect(await getCachedSummary(key)).toBeNull();
  });

  it('invalidateUserDayCaches clears that day\'s summary entry', async () => {
    const date = uniqueDate();
    const key = buildSummaryCacheKey('u', date);
    await setCachedSummary(key, bundle(), FRESH);
    await invalidateUserDayCaches('u', date);
    expect(await getCachedSummary(key)).toBeNull();
  });
});
