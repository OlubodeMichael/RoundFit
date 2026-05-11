import { getLocalDateString } from '@/utils/date'

// ── Types ──────────────────────────────────────────────────────────────────

export type MetricStatus = 'met' | 'partial' | 'missed' | 'no-data'

export interface InsightTargets {
  calorie_budget: number
  protein_target: number
  steps_target:   number | null
  sleep_target:   number | null
}

export interface NormalizedDay {
  date:          string
  calories:      number
  protein:       number
  carbs:         number
  fat:           number
  steps:         number | null
  sleep_hours:   number | null
  workout_count: number
  water_glasses: number
  score:         number           // 0–100
  met_calories:  MetricStatus
  met_protein:   MetricStatus
  met_steps:     MetricStatus
  met_sleep:     MetricStatus
  is_partial:    boolean          // true = no data logged for this day
  cycle_phase?:  string | null
  data_version:  number
}

export interface WeeklyInsightSummary {
  week_start:               string
  week_end:                 string
  days:                     NormalizedDay[]
  consistency_score:        number
  streak:                   number
  avg_calories:             number
  avg_protein:              number
  avg_steps:                number | null
  avg_sleep:                number | null
  days_met_calories:        number
  days_met_protein:         number
  days_met_steps:           number
  days_met_sleep:           number
  best_day_date:            string | null
  best_day_score:           number | null
  targets_snapshot:         InsightTargets
  last_computed_at:         string
  weekly_insight_message:   string | null
}

export interface DailyInsightSummary {
  day:              NormalizedDay
  targets:          InsightTargets
  last_computed_at: string
}

// ── Pure functions ─────────────────────────────────────────────────────────

export function getMetricStatus(
  actual: number | null,
  target: number | null,
  mode:   'near_target' | 'at_least' = 'at_least',
): MetricStatus {
  if (actual === null || actual === 0) return 'no-data'
  if (target === null || target === 0) return 'no-data'
  const ratio = actual / target
  if (mode === 'near_target') {
    if (ratio >= 0.85 && ratio <= 1.15) return 'met'
    if (ratio >= 0.7  && ratio <= 1.3)  return 'partial'
    return 'missed'
  }
  if (ratio >= 0.9) return 'met'
  if (ratio >= 0.7) return 'partial'
  return 'missed'
}

export function scoreDay(
  calories:    number,
  protein:     number,
  steps:       number | null,
  sleep_hours: number | null,
  targets:     InsightTargets,
): number {
  let score = 0
  let weight = 0

  // Only include a metric when real data exists AND a valid target is set.
  // 'no-data' must not inflate the denominator — it would silently lower the
  // score the same way a fully-missed target does.

  // Calories: penalise both under- and over-eating
  if (calories > 0 && targets.calorie_budget > 0) {
    const s = getMetricStatus(calories, targets.calorie_budget, 'near_target')
    score  += s === 'met' ? 30 : s === 'partial' ? 20 : 0
    weight += 30
  }

  // Protein: reward hitting or exceeding the daily target
  if (protein > 0 && targets.protein_target > 0) {
    const s = getMetricStatus(protein, targets.protein_target, 'at_least')
    score  += s === 'met' ? 30 : s === 'partial' ? 20 : 0
    weight += 30
  }

  // Steps: only score when the health source delivered a real non-zero reading
  if (steps !== null && steps > 0 && targets.steps_target !== null && targets.steps_target > 0) {
    const s = getMetricStatus(steps, targets.steps_target, 'at_least')
    score  += s === 'met' ? 20 : s === 'partial' ? 14 : 0
    weight += 20
  }

  // Sleep: only score when a sleep session was actually recorded
  const sleepTarget = targets.sleep_target ?? 7
  if (sleep_hours !== null && sleep_hours > 0) {
    const s = getMetricStatus(sleep_hours, sleepTarget, 'at_least')
    score  += s === 'met' ? 20 : s === 'partial' ? 14 : 0
    weight += 20
  }

  return weight === 0 ? 0 : Math.round((score / weight) * 100)
}

/**
 * Re-score an already-normalized day against (possibly different) targets.
 * Preserves nutrition + activity values; only `score`, `met_*`, and
 * `is_partial` are recomputed. Use when targets need to be sanitized after a
 * NormalizedDay has been built (e.g. cached responses with stale targets).
 */
export function recomputeNormalizedDay(day: NormalizedDay, targets: InsightTargets): NormalizedDay {
  return apiDayToNormalized(
    {
      date:              day.date,
      calories_consumed: day.calories,
      protein_consumed:  day.protein,
      carbs_consumed:    day.carbs,
      fat_consumed:      day.fat,
      steps:             day.steps,
      sleep_hours:       day.sleep_hours,
      workout_count:     day.workout_count,
      water_glasses:     day.water_glasses,
    },
    targets,
  )
}

export function apiDayToNormalized(day: Record<string, any>, targets: InsightTargets): NormalizedDay {
  const calories    = day.calories_consumed  ?? 0
  const protein     = day.protein_consumed   ?? 0
  const carbs       = day.carbs_consumed     ?? 0
  const fat         = day.fat_consumed       ?? 0
  const steps       = day.steps             ?? null
  const sleep_hours = day.sleep_hours        ?? null
  // `is_partial` flags days with no food logged — used by weekly aggregates and
  // the daily empty-state card. It does NOT zero the score: scoreDay already
  // ignores empty metrics, so steps/sleep can still earn credit on a no-food day.
  const is_partial  = calories === 0 && protein === 0

  return {
    date:          day.date,
    calories,
    protein,
    carbs,
    fat,
    steps,
    sleep_hours,
    workout_count: day.workout_count ?? 0,
    water_glasses: day.water_glasses ?? 0,
    score:         scoreDay(calories, protein, steps, sleep_hours, targets),
    met_calories:  getMetricStatus(calories, targets.calorie_budget, 'near_target'),
    met_protein:   getMetricStatus(protein,  targets.protein_target, 'at_least'),
    met_steps:
      steps === null || targets.steps_target === null
        ? 'no-data'
        : getMetricStatus(steps, targets.steps_target, 'at_least'),
    met_sleep:
      sleep_hours === null
        ? 'no-data'
        : getMetricStatus(sleep_hours, targets.sleep_target ?? 7, 'at_least'),
    is_partial,
    data_version: 1,
  }
}

export function computeWithinWeekStreak(days: NormalizedDay[]): number {
  const today  = getLocalDateString()
  const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date))
  let streak = 0
  for (const d of sorted) {
    if (d.date > today)    continue
    if (d.is_partial)      break
    if (d.met_calories === 'met' || d.met_calories === 'partial') streak++
    else break
  }
  return streak
}

export function apiWeeklyToSummary(
  apiData:        Record<string, any>,
  insightMessage: string | null,
): WeeklyInsightSummary {
  const targets: InsightTargets = apiData.targets_snapshot ?? {
    calorie_budget: 2000,
    protein_target: 150,
    steps_target:   null,
    sleep_target:   null,
  }

  const normalizedDays: NormalizedDay[] = (apiData.days ?? []).map((d: any) =>
    apiDayToNormalized(d, targets)
  )

  const logged = normalizedDays.filter(d => !d.is_partial)
  const bestDay = normalizedDays.length > 0
    ? normalizedDays.reduce((b, d) => d.score > b.score ? d : b, normalizedDays[0])
    : null

  return {
    week_start:             apiData.week_start,
    week_end:               apiData.week_end,
    days:                   normalizedDays,
    consistency_score:      apiData.consistency_score ?? 0,
    streak:                 computeWithinWeekStreak(normalizedDays),
    avg_calories:           apiData.avg_calories ?? 0,
    avg_protein:            apiData.avg_protein  ?? 0,
    avg_steps:              apiData.avg_steps    ?? null,
    avg_sleep:              apiData.avg_sleep    ?? null,
    days_met_calories:      logged.filter(d => d.met_calories === 'met').length,
    days_met_protein:       logged.filter(d => d.met_protein  === 'met').length,
    days_met_steps:         logged.filter(d => d.met_steps    === 'met').length,
    days_met_sleep:         logged.filter(d => d.met_sleep    === 'met').length,
    best_day_date:          bestDay && !bestDay.is_partial ? bestDay.date : null,
    best_day_score:         bestDay && !bestDay.is_partial ? bestDay.score : null,
    targets_snapshot:       targets,
    last_computed_at:       apiData.computed_at ?? new Date().toISOString(),
    weekly_insight_message: insightMessage,
  }
}

// ── Date helpers ───────────────────────────────────────────────────────────

export function getWeekStart(date?: Date): string {
  const d    = date ?? new Date()
  const dow  = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
  return getLocalDateString(monday)
}

export function formatWeekRange(weekStart: string, weekEnd: string): string {
  const fmt = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${fmt(weekStart)} — ${fmt(weekEnd)}`
}

export function getDayLetter(isoDate: string): string {
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(isoDate + 'T00:00:00').getDay()]
}

export function getDayName(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' })
}

export function formatSleepHours(hours: number | null): string {
  if (hours === null) return '—'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function formatDelta(diff: number, unit = ''): string {
  const sign = diff >= 0 ? '+' : ''
  return `${sign}${Math.round(diff)}${unit}`
}
