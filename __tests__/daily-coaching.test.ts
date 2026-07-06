import { assembleDailyCoachingDecision } from '@/utils/daily-coaching';
import { rankNutritionGaps } from '@/utils/nutrition-gap-ranker';
import { coachingDuration } from '@/utils/coaching-duration';
import { renderCoachingTemplate, coachingTitle } from '@/utils/coaching-template';
import { buildPhrasingPrompt } from '@/utils/coaching-prompt';
import type {
  DailyCoachingInput,
  DailyCoachingDecision,
  IllnessSignals,
  NutritionDay,
} from '@/types/daily-coaching';

// ── Input factory with nested overrides ─────────────────────────────────────

type Overrides = Partial<Omit<DailyCoachingInput, 'readiness' | 'illness' | 'cycle' | 'hydration'>> & {
  readiness?: Partial<DailyCoachingInput['readiness']>;
  illness?: Partial<IllnessSignals>;
  cycle?: Partial<DailyCoachingInput['cycle']>;
  hydration?: Partial<DailyCoachingInput['hydration']>;
};

const onTargetDay = (date: string): NutritionDay => ({
  date,
  logged: true,
  calories_consumed: 2000,
  protein_consumed: 130,
});

function makeInput(o: Overrides = {}): DailyCoachingInput {
  return {
    date: '2026-07-06',
    readiness: {
      available: true,
      score: 75,
      recommendation: 'Moderate',
      limiting_pillar: 'sleep',
      reason: 'solid',
      ...(o.readiness ?? {}),
    },
    consecutive_hard_days: o.consecutive_hard_days ?? 0,
    illness: {
      resting_hr_elevated: false,
      hrv_suppressed: false,
      respiratory_rate_elevated: false,
      ...(o.illness ?? {}),
    },
    goal: o.goal ?? 'maintain',
    nutrition_days: o.nutrition_days ?? [onTargetDay('2026-07-04'), onTargetDay('2026-07-05'), onTargetDay('2026-07-06')],
    nutrition_targets: o.nutrition_targets ?? { calorie_budget: 2000, protein_target: 130 },
    cycle: { include: false, phase: null, days_remaining: null, ...(o.cycle ?? {}) },
    hydration: { active: true, logged_ml: 2000, target_ml: 2000, ...(o.hydration ?? {}) },
    has_baselines: o.has_baselines ?? true,
    history_days: o.history_days ?? 7,
  };
}

const proteinShortDays = (protein: number): NutritionDay[] => [
  { date: '2026-07-04', logged: true, calories_consumed: 2000, protein_consumed: protein },
  { date: '2026-07-05', logged: true, calories_consumed: 2000, protein_consumed: protein },
  { date: '2026-07-06', logged: true, calories_consumed: 2000, protein_consumed: protein },
];

// ── Nutrition gap ranker ─────────────────────────────────────────────────────

describe('rankNutritionGaps', () => {
  it('ignores unlogged days — never reports more days under than were logged', () => {
    const days: NutritionDay[] = [
      { date: 'd1', logged: true, calories_consumed: 2000, protein_consumed: 80 },
      { date: 'd2', logged: false, calories_consumed: null, protein_consumed: null },
      { date: 'd3', logged: false, calories_consumed: null, protein_consumed: null },
    ];
    const gaps = rankNutritionGaps(days, { calorie_budget: 2000, protein_target: 160 });
    const protein = gaps.find((g) => g.nutrient === 'protein')!;

    expect(protein.logged_days).toBe(1);
    expect(protein.days_under).toBe(1); // NOT 3
    expect(protein.avg_consumed).toBe(80); // avg over the one logged day only
  });

  it('returns nothing when no days are logged', () => {
    const days: NutritionDay[] = [
      { date: 'd1', logged: false, calories_consumed: null, protein_consumed: null },
    ];
    expect(rankNutritionGaps(days, { calorie_budget: 2000, protein_target: 160 })).toEqual([]);
  });

  it('ranks a bigger deficit higher', () => {
    const gaps = rankNutritionGaps(proteinShortDays(90), { calorie_budget: 2000, protein_target: 160 });
    expect(gaps[0].nutrient).toBe('protein');
    expect(gaps[0].deficit).toBe(70);
    expect(gaps[0].days_under).toBe(3);
  });
});

// ── Duration + late-luteal cap ───────────────────────────────────────────────

describe('coachingDuration', () => {
  const noCycle = { include: false, phase: null, days_remaining: null };

  it('maps directives to durations, rest is null', () => {
    expect(coachingDuration('rest', noCycle).text).toBeNull();
    expect(coachingDuration('train_hard', noCycle).text).toBe('45 to 60 minutes');
  });

  it('caps hard training in late luteal', () => {
    const lateLuteal = { include: true, phase: 'luteal' as const, days_remaining: 2 };
    const capped = coachingDuration('train_hard', lateLuteal);
    expect(capped.text).toBe('30 to 45 minutes');
    expect(capped.capped).toBe(true);
  });

  it('does not cap outside the late-luteal window', () => {
    const earlyLuteal = { include: true, phase: 'luteal' as const, days_remaining: 8 };
    expect(coachingDuration('train_hard', earlyLuteal).capped).toBe(false);
  });
});

// ── Priority ladder ──────────────────────────────────────────────────────────

describe('assembleDailyCoachingDecision — safety', () => {
  it('3 consecutive hard days forces rest regardless of a high readiness score', () => {
    const d = assembleDailyCoachingDecision(
      makeInput({ consecutive_hard_days: 3, readiness: { recommendation: 'Train hard', score: 92 } }),
    );
    expect(d.directive).toBe('rest');
    expect(d.safety_override).toBe(true);
    expect(d.primary_reason).toMatch(/3 days in a row/);
  });

  it('illness proxy needs TWO signals to force rest', () => {
    const oneSignal = assembleDailyCoachingDecision(
      makeInput({ illness: { resting_hr_elevated: true }, readiness: { recommendation: 'Train hard' } }),
    );
    expect(oneSignal.directive).toBe('light'); // capped, NOT rest
    expect(oneSignal.safety_override).toBe(true);

    const twoSignals = assembleDailyCoachingDecision(
      makeInput({
        illness: { resting_hr_elevated: true, hrv_suppressed: true },
        readiness: { recommendation: 'Train hard' },
      }),
    );
    expect(twoSignals.directive).toBe('rest');
    expect(twoSignals.safety_override).toBe(true);
  });

  it('drops supporting actions when safety fires', () => {
    const d = assembleDailyCoachingDecision(
      makeInput({
        consecutive_hard_days: 3,
        nutrition_targets: { calorie_budget: 2000, protein_target: 160 },
        nutrition_days: proteinShortDays(100),
        hydration: { active: true, logged_ml: 400, target_ml: 2000 },
      }),
    );
    expect(d.directive).toBe('rest');
    expect(d.secondary_action).toBeNull();
    expect(d.habit_nudge).toBeNull();
    expect(d.dropped.length).toBeGreaterThanOrEqual(1);
  });
});

describe('assembleDailyCoachingDecision — nutrition vs hydration', () => {
  it('a protein gap beats the hydration nudge', () => {
    const d = assembleDailyCoachingDecision(
      makeInput({
        nutrition_targets: { calorie_budget: 2000, protein_target: 160 },
        nutrition_days: proteinShortDays(100),
        hydration: { active: true, logged_ml: 400, target_ml: 2000 }, // 20% — low
      }),
    );
    expect(d.secondary_action).toMatch(/protein/);
    expect(d.secondary_action).toMatch(/60g under/); // 160 - 100
    expect(d.habit_nudge).toBeNull();
    expect(d.dropped.some((s) => /water/i.test(s))).toBe(true);
  });

  it('offers the hydration nudge only when there is no nutrition gap', () => {
    const d = assembleDailyCoachingDecision(
      makeInput({ hydration: { active: true, logged_ml: 400, target_ml: 2000 } }),
    );
    expect(d.secondary_action).toBeNull();
    expect(d.habit_nudge).toMatch(/water/i);
    expect(d.habit_nudge).toMatch(/20%/);
  });

  it('excludes a calorie shortfall for a non-gain goal', () => {
    const lowCal: NutritionDay[] = [
      { date: 'd1', logged: true, calories_consumed: 1400, protein_consumed: 130 },
      { date: 'd2', logged: true, calories_consumed: 1400, protein_consumed: 130 },
      { date: 'd3', logged: true, calories_consumed: 1400, protein_consumed: 130 },
    ];
    const lose = assembleDailyCoachingDecision(makeInput({ goal: 'lose', nutrition_days: lowCal }));
    expect(lose.secondary_action).toBeNull(); // calorie deficit is not a "gap" when losing

    const gain = assembleDailyCoachingDecision(makeInput({ goal: 'gain', nutrition_days: lowCal }));
    expect(gain.secondary_action).toMatch(/calories/);
  });
});

describe('assembleDailyCoachingDecision — confidence & cold start', () => {
  it('minimal confidence reshapes into a cautious "go by feel" directive', () => {
    const d = assembleDailyCoachingDecision(
      makeInput({ history_days: 1, readiness: { recommendation: 'Train hard' } }),
    );
    expect(d.confidence).toBe('minimal');
    expect(d.directive).toBe('light'); // never a confident hard prescription on thin data
    expect(d.primary_reason).toMatch(/go by feel/i);
  });

  it('minimal confidence still yields to a safety rest', () => {
    const d = assembleDailyCoachingDecision(
      makeInput({ history_days: 1, consecutive_hard_days: 3 }),
    );
    expect(d.directive).toBe('rest');
    expect(d.safety_override).toBe(true);
  });

  it('cold start gives a simple, non-broken first-week message', () => {
    const d = assembleDailyCoachingDecision(
      makeInput({
        history_days: 0,
        has_baselines: false,
        readiness: { available: false, score: null, recommendation: null, limiting_pillar: null, reason: null },
      }),
    );
    expect(d.directive).toBe('light');
    expect(d.confidence).toBe('minimal');
    expect(d.primary_reason).toMatch(/Welcome/);
    expect(d.secondary_action).toBeNull();
    expect(d.habit_nudge).toBeNull();
  });

  it('applies the late-luteal cap through the full assembler', () => {
    const d = assembleDailyCoachingDecision(
      makeInput({
        readiness: { recommendation: 'Train hard' },
        cycle: { include: true, phase: 'luteal', days_remaining: 2 },
      }),
    );
    expect(d.directive).toBe('train_hard');
    expect(d.duration_text).toBe('30 to 45 minutes'); // capped
  });
});

// ── Template renderer ────────────────────────────────────────────────────────

describe('renderCoachingTemplate', () => {
  const base: DailyCoachingDecision = {
    directive: 'moderate',
    safety_override: false,
    primary_reason: 'Directive sentence.',
    duration_text: '30 to 45 minutes',
    secondary_action: null,
    habit_nudge: null,
    focus: 'training',
    dropped: [],
    confidence: 'full',
    nutrition_gap: null,
    assembled_at: '2026-07-06T08:00:00.000Z',
  };

  it('renders directive only', () => {
    expect(renderCoachingTemplate(base)).toBe('Directive sentence.');
  });

  it('renders directive + nutrition', () => {
    expect(renderCoachingTemplate({ ...base, secondary_action: 'Protein sentence.' })).toBe(
      'Directive sentence. Protein sentence.',
    );
  });

  it('renders directive + habit', () => {
    expect(renderCoachingTemplate({ ...base, habit_nudge: 'Water sentence.' })).toBe(
      'Directive sentence. Water sentence.',
    );
  });

  it('renders all three fields in order', () => {
    expect(
      renderCoachingTemplate({ ...base, secondary_action: 'Protein sentence.', habit_nudge: 'Water sentence.' }),
    ).toBe('Directive sentence. Protein sentence. Water sentence.');
  });

  it('renders the ugly combo: safety rest, no nutrition, minimal confidence, no cycle', () => {
    const ugly: DailyCoachingDecision = {
      ...base,
      directive: 'rest',
      safety_override: true,
      primary_reason: 'Rest today.',
      duration_text: null,
      secondary_action: null,
      habit_nudge: null,
      confidence: 'minimal',
    };
    expect(renderCoachingTemplate(ugly)).toBe('Rest today.');
    expect(renderCoachingTemplate(ugly).length).toBeGreaterThan(0);
  });

  it('always produces a non-empty message for any assembled decision', () => {
    const inputs: DailyCoachingInput[] = [
      makeInput(),
      makeInput({ consecutive_hard_days: 3 }),
      makeInput({ history_days: 0, has_baselines: false, readiness: { available: false, recommendation: null } }),
      makeInput({ nutrition_days: proteinShortDays(90), nutrition_targets: { calorie_budget: 2000, protein_target: 160 } }),
      makeInput({ hydration: { active: true, logged_ml: 100, target_ml: 2000 } }),
    ];
    for (const input of inputs) {
      const msg = renderCoachingTemplate(assembleDailyCoachingDecision(input));
      expect(msg.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('buildPhrasingPrompt', () => {
  it('serializes only the decision fields, directive first, and omits empty actions', () => {
    const decision = assembleDailyCoachingDecision(
      makeInput({
        nutrition_targets: { calorie_budget: 2000, protein_target: 160 },
        nutrition_days: proteinShortDays(100),
      }),
    );
    const prompt = buildPhrasingPrompt(decision);

    expect(prompt).toMatch(/^Directive: /);
    expect(prompt).toContain('Say this first:');
    expect(prompt).toContain(decision.primary_reason);
    expect(prompt).toContain('Also cover:');
    expect(prompt).toContain(decision.secondary_action!);
    // No habit line when there is no habit nudge.
    expect(prompt.match(/Also cover:/g)!.length).toBe(1);
  });

  it('carries the safety override marker and never leaks raw data', () => {
    const decision = assembleDailyCoachingDecision(makeInput({ consecutive_hard_days: 3 }));
    const prompt = buildPhrasingPrompt(decision);
    expect(prompt).toContain('(safety override)');
    // Only the decision's own sentences — every number traces to a decision field.
    expect(prompt).toContain(decision.primary_reason);
  });
});

describe('coachingTitle', () => {
  it('titles each directive', () => {
    const mk = (directive: DailyCoachingDecision['directive'], safety_override = false): DailyCoachingDecision => ({
      directive, safety_override, primary_reason: '', duration_text: null, secondary_action: null,
      habit_nudge: null, focus: 'training', dropped: [], confidence: 'full', nutrition_gap: null,
      assembled_at: '',
    });
    expect(coachingTitle(mk('light'))).toBe('Keep it light');
    expect(coachingTitle(mk('moderate'))).toBe('Moderate day');
    expect(coachingTitle(mk('train_hard'))).toBe('Train hard');
    expect(coachingTitle(mk('rest', true))).toBe('Rest and recover');
  });
});
