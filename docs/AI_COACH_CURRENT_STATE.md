# AI Coach — Current State (what we're already doing)

> **Vision:** AI is the coach, not a feature. Everything we collect — sleep,
> nutrition, cycle, HRV, workouts, readiness — exists so the AI can synthesize it
> and tell the user *what to do next*.
>
> **The one test for every AI feature:**
> *Does this tell the user what to do, or just show them data?* If the latter,
> it's not ready.

This doc is an honest inventory of what exists **today**, mapped to the five
coaching pillars. No new code — just the current reality and where it sits.

---

## Snapshot

| Pillar | Status | Directive or observational? |
|--------|--------|------------------------------|
| 1. Daily coaching message | ⚠️ Partial | Mostly observational; readiness piece is directive |
| 2. Meal suggestions | ❌ Missing | — |
| 3. Workout recommendations | ⚠️ Partial (strongest) | Directive category + rationale, not a full prescription |
| 4. Pattern coaching | 🟡 Built but **dormant** | N/A — not delivered to the user |
| 5. Weekly debrief | ⚠️ Partial | Observational summary |

Legend: ✅ done · ⚠️ partial · 🟡 built but not wired · ❌ missing

---

## 1. Daily coaching message — ⚠️ partial

**What exists:**
- **Rules-based "Daily insight"** — `todayInsight` from `GET /insights/today`
  (`context/insights-context.tsx`). A single observation for today.
- **RIS / Claude AI insight** — `claudeInsight` from `GET /insights/ai`
  (premium; daily cap returns 429 → `claudeLimitReached`). This is the only
  genuinely LLM-generated coaching surface today.
- **Surfaces:** Home `InsightCard` (3-line preview) → `Insights → Daily`, which
  now shows the full paragraph beneath the daily stats.
- **Push:** daily insight is delivered via notification (HealthKit sleep
  background delivery + one-shot fallback).

**Gap vs vision:**
- Not explicitly **gated on the morning check-in** ("every morning, after the
  check-in…"). It's available whenever fetched.
- Quality is **observation-leaning** unless the RIS prompt is written to be
  directive. The vision's example ("you're 48g under protein for 3 days and
  readiness is low — eat 40g before noon, skip the hard session, here's why")
  requires the message to read sleep + 3-day nutrition + readiness + cycle
  *together* and end in a single instruction. We have all those inputs; the
  synthesis-into-one-directive step is the missing piece.
- The most directive daily output we ship is actually the **readiness
  recommendation + tips** (see pillar 3), not the insight text.

---

## 2. Meal suggestions — ❌ missing

**What exists:**
- We track **remaining macros** for the day (`context/summary-context.tsx`:
  calories/protein/carbs/fat consumed vs budget/targets).
- The home **burn coach card** (`components/home/burn-coach-card.tsx`,
  "Today's coach") suggests **movement / calorie burn**, not food.

**Gap vs vision:** there is **no "eat this next" feature**. Nothing reads
remaining macros + what's already eaten + goal and proposes a specific next meal.
This pillar is entirely unbuilt.

---

## 3. Workout recommendations — ⚠️ partial (our strongest pillar)

**What exists:** the readiness engine (`utils/readiness.ts`,
`context/recovery-context.tsx`) produces a real, directive output:
- **Recommendation:** `Rest` / `Light workout` / `Moderate` / `Train hard`,
  derived from the 6-pillar readiness score (sleep, HRV, training load,
  nutrition, soreness, cycle — hydration added in v2).
- **Reason:** names the limiting pillar(s) in plain language.
- **Tips:** up to 3 directive lines (e.g. "Prioritise protein — aim for Xg",
  "Schedule a rest day or deload"). v2 also forces **Rest** after 3 consecutive
  hard days.
- Cycle-phase and HRV-baseline aware.

**Gap vs vision:** it prescribes a **category + rationale**, not a **specific
session** (e.g. "45 min zone-2 + 20 min mobility"). It says *how hard*, not
*exactly what to do*. Closing that gap means turning the readiness output +
training history into a concrete prescription (type, duration, intensity).

---

## 4. Pattern coaching — 🟡 built but dormant

**What exists in code (not delivered to users):**
- `context/engine-context.tsx` defines:
  - `DailyEngine` with `action`, `prediction`, `status`, `daily_score`
    (`GET /engine/daily`).
  - `DetectedPattern` with `pattern_type`, `description`, `confidence`,
    `times_confirmed` (`GET /engine/patterns`) — i.e. confirmed behavioural
    correlations, exactly what the vision's "pattern coaching" needs.

**The catch:** `EngineProvider` is **unmounted**. Per `app/_layout.tsx:206`:
> "EngineProvider unmounted: no screen consumes `useEngine()`; it only generated
> unused `/engine/daily` + `/engine/patterns` requests. Context/hook kept for
> when engine UI is wired."

So the backend can detect patterns and produce a daily `action`/`prediction`,
and the client types/hooks exist — but **nothing renders any of it**. This is the
biggest "infrastructure built, coaching not delivered" gap. Turning patterns into
"here's the loop you're in and how to break it" is mostly a wiring + phrasing job
on top of data that already flows.

---

## 5. Weekly debrief — ⚠️ partial

**What exists:**
- `GET /insights/weekly` → `weekly_insight_message` plus weekly summary stats
  (`hooks/use-weekly-insights.ts`, `utils/insights-aggregator.ts`).
- **Surface:** `Insights → Weekly` shows the week's stats and the message.

**Gap vs vision:** it's a **stats summary + one message**, not a structured
debrief ("what went well / what hurt progress / one focus for next week"), and
it's **not pushed every Sunday**. The data to build it exists.

---

## The throughline

We are strong on **data collection** (sleep, nutrition, cycle, HRV, workouts,
readiness all flow and are cached) and we have **two real directive surfaces**:
the readiness recommendation/tips and the RIS/Claude insight. Everything else is
either **observational** (daily/weekly insights describe, they don't instruct) or
**built but dormant** (the pattern/daily engine).

The product gap is not data and not infrastructure — it's the **synthesis layer**
that reads the full picture and ends every output in a single, specific
instruction. That's the line the vision draws, and it's where the next work goes.

### Concrete next steps implied (for later — no code yet)
1. Make the **daily message directive** and check-in-gated (synthesize sleep +
   3-day nutrition + readiness + cycle → one instruction). Highest leverage.
2. **Wire the dormant engine** (remount `EngineProvider`, render
   `patterns` + daily `action`/`prediction`) → unlocks pattern coaching cheaply.
3. Upgrade workout recommendation from **category → specific prescription**.
4. Build the **Sunday weekly debrief** (went well / hurt / one focus + push).
5. Net-new: **meal suggestions** from remaining macros + goal.
