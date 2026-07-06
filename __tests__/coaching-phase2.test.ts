import {
  assembleCoachingInput,
  deriveIllnessSignals,
  deriveLimitingPillar,
  type CoachingInputSources,
} from '@/utils/assemble-coaching-input';
import { resolveCoachingMessage, type CoachingPhraser } from '@/utils/resolve-coaching-message';
import { assembleDailyCoachingDecision } from '@/utils/daily-coaching';
import type { ComputedReadiness, PillarScore } from '@/types/readiness';
import type { DailyCoachingInput } from '@/types/daily-coaching';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const pillar = (id: PillarScore['id'], score: number, active = true): PillarScore => ({
  id, label: id, score, weight: 0.1, active,
});

const computed = (over: Partial<ComputedReadiness> = {}): ComputedReadiness => ({
  score: 72,
  recommendation: 'Moderate',
  reason: 'solid',
  pillars: [pillar('sleep', 80), pillar('hrv', 40), pillar('nutrition', 90)],
  factors: [],
  tips: [],
  sleep_score: 80,
  strain_score: 50,
  soreness_level: 2,
  ...over,
});

const baseSources = (over: Partial<CoachingInputSources> = {}): CoachingInputSources => ({
  date: '2026-07-06',
  computed: computed(),
  todayRestingHr: 55,
  todayHrv: 60,
  restingHrBaseline: 55,
  hrvBaseline: 60,
  respiratoryRate: null,
  respiratoryRateBaseline: null,
  consecutiveHardDays: 0,
  goal: 'maintain',
  nutritionDays: [],
  nutritionTargets: { calorie_budget: 2000, protein_target: 130 },
  cycle: { include: false, phase: null, days_remaining: null },
  hydration: { active: true, logged_ml: 2000, target_ml: 2000 },
  hasBaselines: true,
  historyDays: 7,
  ...over,
});

// ── Illness proxy ────────────────────────────────────────────────────────────

describe('deriveIllnessSignals', () => {
  it('flags resting HR only when ≥ 5% above baseline', () => {
    expect(deriveIllnessSignals(baseSources({ todayRestingHr: 58, restingHrBaseline: 55 })).resting_hr_elevated).toBe(true);
    expect(deriveIllnessSignals(baseSources({ todayRestingHr: 56, restingHrBaseline: 55 })).resting_hr_elevated).toBe(false);
  });

  it('flags HRV only when ≥ 20% below baseline', () => {
    expect(deriveIllnessSignals(baseSources({ todayHrv: 47, hrvBaseline: 60 })).hrv_suppressed).toBe(true); // 47 ≤ 48
    expect(deriveIllnessSignals(baseSources({ todayHrv: 50, hrvBaseline: 60 })).hrv_suppressed).toBe(false);
  });

  it('respiratory rate is never flagged while untracked (null)', () => {
    expect(deriveIllnessSignals(baseSources()).respiratory_rate_elevated).toBe(false);
  });

  it('two signals feed a rest decision through the engine', () => {
    const input = assembleCoachingInput(
      baseSources({
        todayRestingHr: 60, restingHrBaseline: 55,   // elevated
        todayHrv: 45, hrvBaseline: 60,               // suppressed
        computed: computed({ recommendation: 'Train hard' }),
      }),
    );
    expect(assembleDailyCoachingDecision(input).directive).toBe('rest');
  });
});

// ── Limiting pillar + mapping ────────────────────────────────────────────────

describe('deriveLimitingPillar', () => {
  it('picks the lowest-scoring active pillar', () => {
    expect(deriveLimitingPillar(computed())).toBe('hrv'); // 40 is lowest
  });
  it('ignores inactive pillars', () => {
    const c = computed({ pillars: [pillar('sleep', 80), pillar('hrv', 10, false), pillar('nutrition', 60)] });
    expect(deriveLimitingPillar(c)).toBe('nutrition'); // hrv inactive
  });
  it('returns null with no readiness', () => {
    expect(deriveLimitingPillar(null)).toBeNull();
  });
});

describe('assembleCoachingInput', () => {
  it('maps readiness through and marks it available', () => {
    const input: DailyCoachingInput = assembleCoachingInput(baseSources());
    expect(input.readiness.available).toBe(true);
    expect(input.readiness.recommendation).toBe('Moderate');
    expect(input.readiness.limiting_pillar).toBe('hrv');
  });
  it('marks readiness unavailable at cold start', () => {
    const input = assembleCoachingInput(baseSources({ computed: null }));
    expect(input.readiness.available).toBe(false);
    expect(input.readiness.recommendation).toBeNull();
  });
});

// ── Fallback chain ───────────────────────────────────────────────────────────

describe('resolveCoachingMessage', () => {
  const decision = assembleDailyCoachingDecision(assembleCoachingInput(baseSources()));

  const phraser = (over: Partial<CoachingPhraser>): CoachingPhraser => ({
    appleAvailable: () => false,
    generateOnDevice: async () => null,
    phraseViaOpenAI: async () => null,
    ...over,
  });

  it('uses Apple FM when available and it returns', async () => {
    const r = await resolveCoachingMessage(decision, phraser({
      appleAvailable: () => true,
      generateOnDevice: async () => ({ title: 'On device', message: 'Local msg' }),
    }));
    expect(r.source).toBe('apple_fm');
    expect(r.message).toBe('Local msg');
  });

  it('falls back to OpenAI when Apple FM throws', async () => {
    const r = await resolveCoachingMessage(decision, phraser({
      appleAvailable: () => true,
      generateOnDevice: async () => { throw new Error('model not ready'); },
      phraseViaOpenAI: async () => ({ title: 'Cloud', message: 'Cloud msg' }),
    }));
    expect(r.source).toBe('openai');
    expect(r.message).toBe('Cloud msg');
  });

  it('uses OpenAI directly on an ineligible device', async () => {
    const r = await resolveCoachingMessage(decision, phraser({
      phraseViaOpenAI: async () => ({ title: 'Cloud', message: 'Cloud msg' }),
    }));
    expect(r.source).toBe('openai');
  });

  it('falls back to the template when everything fails (offline)', async () => {
    const r = await resolveCoachingMessage(decision, phraser({
      appleAvailable: () => true,
      generateOnDevice: async () => { throw new Error('no model'); },
      phraseViaOpenAI: async () => { throw new Error('offline'); },
    }));
    expect(r.source).toBe('template');
    expect(r.message.trim().length).toBeGreaterThan(0);
    expect(r.title.length).toBeGreaterThan(0);
  });

  it('never returns a blank message', async () => {
    const r = await resolveCoachingMessage(decision, phraser({}));
    expect(r.message.trim().length).toBeGreaterThan(0);
  });
});
