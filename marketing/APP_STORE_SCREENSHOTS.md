# App Store Screenshots — Script & Capture Guide

10 slots. Slots 1–5 answer "what is this app?"; 6–10 give reasons to believe.

Voice follows the positioning posts (`marketing/social/positioning-posts`): calm, concrete,
anti-dashboard. No exclamation marks, no "AI-powered", no feature lists. One idea per screen.

**RoundFit is not a food app.** It covers food, training, sleep, rest and recovery, and turns
them into one daily focus. The screenshot set has to say that in the first three images, or the
App Store will read it as another calorie tracker — the most crowded category there is.

---

## The arc

| # | Says | Pillar |
|---|---|---|
| 1 | One focus, every day | The promise |
| 2 | Everything in one picture | **All five** |
| 3 | Know when to push, when to rest | Recovery / rest |
| 4 | Every set tracked live | Training |
| 5 | A meal logged in seconds | Food |
| 6 | Sleep is the input | Sleep |
| 7 | A weekly report that picks one thing | The coach |
| 8 | Scan it or shoot it | Food, depth |
| 9 | Wrist and lock screen | Ecosystem |
| 10 | See the trend | Long-term payoff |

Pillars own slots 2–6. Food gets one slot in the first five, not three.

---

## Slot 1 — the promise

> # Your one focus, every day
> Not another dashboard.

**Screen:** Home — `app/(tabs)/index.tsx`
**Set up:** Coaching card (`components/home/CoachingCard.tsx`) at the top, with the calorie ring,
macros row and readiness widget visible beneath. The coaching headline must read as a decision
("Protein's short — front-load it at lunch"), not a stat.

The only screenshot most people see. It has to say *we tell you what to do*, not *we show you
numbers*.

---

## Slot 2 — the breadth

> # Food, training, sleep, recovery
> One app. One picture.

**Screen:** Log tab — `app/(tabs)/log/index.tsx`
**Set up:** Every card populated on the same day — Eaten, Training, Water, Sleep, Weight. No
zeros, no empty rows. This is the slot that stops RoundFit being filed as a calorie counter, so
it has to be visibly *not* about food.

If the Log tab looks sparse, use the Home tab scrolled to show the full stack instead — but then
change slot 1's crop so the two aren't near-identical images.

---

## Slot 3 — recovery and rest

> # Know when to push
> And when to back off.

**Screen:** Recovery — `app/(tabs)/progress/recovery.tsx`
**Set up:** A day with a clear readiness score and a directional verdict. Use a **low** readiness
day — "back off today" is more surprising than another green ring, and it proves the app will
tell you something you didn't want to hear. That's the whole difference between a coach and a
dashboard.

---

## Slot 4 — training

> # Every set, tracked live

**Screen:** Workout — `app/(tabs)/log/workout.tsx`, live session running
**Set up:** A strength session mid-flight: several sets logged with weight and reps, elapsed
timer running. Not an empty session, and not the picker.

---

## Slot 5 — food

> # A meal logged in seconds
> Search millions of foods.

**Screen:** Food search — `app/(tabs)/log/food/search.tsx`
**Set up:** Type `chicken breast` and wait for live results, so generic foods rank first
(`Chicken, breast, boneless, skinless, raw`) with kcal on the right. Needs the deployed backend —
that's live. Never screenshot the empty state.

---

## Slot 6 — sleep

> # Sleep is where progress happens

**Screen:** Sleep — `app/(tabs)/log/sleep.tsx`, or the sleep view under Progress if its chart is
stronger
**Set up:** A week of real HealthKit sleep data so duration and consistency both read. Ideally
pair it visually with slot 3 so the sleep → readiness link is implicit.

---

## Slot 7 — the weekly report

> # A weekly report that picks one thing

**Screen:** Weekly insight — `app/(tabs)/insights/weekly.tsx`
**Set up:** A report where the **one focus** line is visible and specific ("Protect your sleep
window before midnight"). Per `docs/ris-architecture.md` this is the product's core idea — it
earns a slot even though it isn't a "feature".

---

## Slot 8 — food, depth

> # Scan it or shoot it

**Screen:** Food log — `app/(tabs)/log/food/index.tsx`, barcode camera card **or** the AI photo
result (`PhotoAnalysisModal`)
**Set up:** For barcode, capture the preview sheet with a real product found — the inline camera
card layered over the meal list is the more modern-looking shot. For photo, capture the *result*
with identified meal and macros, not the camera. Pick one; don't spend two slots here.

---

## Slot 9 — wrist and lock screen

> # On your wrist, on your lock screen

**Screen:** Watch app (`watch/`) beside the iOS Lock Screen Live Activity
**Set up:** Compose both on one plain background. For the Live Activity: start a Strength
workout, lock the device, screenshot. **Check exactly one card appears** — the duplicate-activity
bug was just fixed — with sets and elapsed time populated, not `0 sets`.

---

## Slot 10 — progress

> # See the trend, not the noise

**Screen:** Weight — `app/(tabs)/progress/weight.tsx`
**Set up:** 60–90 days of data so the trend line is unmistakable and daily scatter reads as noise
around it. A 7-day chart undermines the caption.

**Alternate:** Profile → badges, captioned *"Streaks that survive real life"* — but only if the
badge artwork in `BADGE_IMAGES` is finished. Ship 9 screenshots before shipping placeholder art.

---

## Before you capture

**Do not show**
- Cycle — gated off for launch (`CYCLE_ENABLED`), not in v1
- Any paywall — `PAYWALL_ENABLED` is off
- Text/natural-language food logging — `/food/parse` returns 501, not shipping
- Placeholder art, `Lorem`, zeroed metrics, or an empty day

**Seed realistic data across all five pillars.** The biggest quality gap in indie screenshots is
empty or obviously fake state — and here it's also a positioning risk: if only food has data,
the set still reads as a food app. Log several real days: meals across breakfast/lunch/dinner,
workouts with sets, sleep, water, weight. Round numbers like `2000 kcal` read as fake; `1,847`
doesn't.

**Clean the status bar** so every shot is identical:

```bash
xcrun simctl status_bar booted override \
  --time "9:41" --batteryState charged --batteryLevel 100 \
  --cellularBars 4 --wifiBars 3
```

**Sizes.** iPad is disabled for this build, so iPhone only. Apple's required set has changed
recently — confirm in App Store Connect before rendering; at time of writing it's the 6.9"
display class, with older sizes auto-scaled.

**Caption treatment.** One line where possible, two at most, set in the app's display face (Syne,
per `app/_layout.tsx`) on a solid or subtly-gradient background above the device frame. The real
test is legibility at thumbnail size — slots 1–3 are what appear in search results.

**Light or dark, pick one.** Mixed themes across a set look accidental. Dark shows the rings and
accent colours better; light reads cleaner in search. Given the light-theme contrast issue found
on the check-in sheet (`textFaint` sits near 2.2:1 on light surfaces app-wide), dark is safer
until light gets a contrast pass.
