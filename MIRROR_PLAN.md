# 30-Day Mirror — implementation plan

Status: **UI complete, data 100% fabricated.** `app/(tabs)/progress/mirror.tsx` is 680 lines of
finished design sitting on a `// ─── Dummy data ───` block (L24–L60). Every number on the screen is
a hardcoded constant. Nothing is fetched, nothing is gated, neither CTA is wired.

**Held back from first launch** (2026-08-28) behind `MIRROR_ENABLED` in `constants/features.ts`,
following the `CYCLE_ENABLED` precedent. The screen and its components are untouched; only the entry
point in `app/(tabs)/progress/index.tsx` is gated. Flip the flag once Phase 2 lands.

This plan is about making it true. It is deliberately opinionated about what we will *not* ship.

---

## 1. Non-negotiables

1. **Rules decide WHAT, the LLM only phrases HOW.** Same rule as the coach engine. The deterministic
   assembler computes every number and picks the headline; the model receives a structured brief and
   returns one sentence. It never sees raw logs and never emits a figure.
2. **No number appears without enough data behind it.** A correlation from nine days is not a
   finding, it is a coin flip with a progress bar. Every card carries a minimum-n gate and is
   omitted — not faked, not zeroed — when unmet.
3. **The Mirror is a premium artefact.** It should feel like something a coach handed you. That
   means fewer, better-supported claims, not a fuller-looking screen.

---

## 2. What actually backs each card

Verified against the backend. `daily_summaries`, `check_ins`, `workouts`, `recovery_logs`,
`weight_entries`, `readiness_scores`, `weekly_intelligence_scores`, `patterns` all exist.

| Card | Source | Verdict |
|---|---|---|
| AI synthesis | LLM over a computed brief | **Build** — phrasing only |
| Optimal sleep | `check_ins.sleep_hours` bucketed vs next-day `energy_level` | **Build** — new derivation |
| Optimal protein | `daily_summaries` protein vs next-day `energy_level` | **Build** — new derivation |
| Best / worst training day | `workouts` + `readiness_scores` | **Build** — needs a per-day score |
| Correlations | `patterns` via `patternEngine.ts` | **Reuse** — already computes Pearson r |
| Biggest improvement | `daily_summaries`, this 30d vs prior 30d | **Build** — needs 60 days |
| Share / Save | — | **Not started** |

### 2.1 The correlations card is the problem

`patternEngine.ts` already does the statistics properly — Pearson correlation, thresholds at
r > 0.4 / 0.35, persisted to `patterns` with a 7-day minimum. It detects exactly four types:
`protein_energy`, `sleep_calories`, `strain_recovery`, `deficit_energy`.

The mock shows four different correlations. Only one of them maps to something real:

| Mock row | Reality |
|---|---|
| "Sleep ≥ 7h → next-day energy" | ≈ `sleep_calories` / derivable. **Keep** |
| "Protein ≥ 140g → recovery" | ≈ `protein_energy`, but the outcome is energy, not recovery. **Relabel** |
| "Late dinner → morning mood" | **No meal-timestamp analysis and no mood field exist.** Cut or build |
| "Hydration → afternoon focus" | **There is no "focus" field anywhere.** Cut |

Decision: **the card renders whatever `patterns` returns, ranked by |r|, and renders nothing if
fewer than two clear the threshold.** We do not reverse-engineer data to match a mockup.

### 2.2 "% confidence" is the wrong label

L187 renders `${strength * 100}% confidence`. r = 0.82 is not 82% confidence — those are different
statistical quantities, and conflating them in a paid health product is a credibility risk the first
informed user will catch. Relabel to **"strength"**, or show a real confidence interval. Cheap fix,
worth doing before anyone sees it.

---

## 3. Architecture

One endpoint, one assembler, one snapshot.

```
GET /api/insights/mirror            → current rolling 30-day report (premium, cached 24h)
GET /api/insights/mirror/:id        → a saved snapshot
POST /api/insights/mirror/save      → freeze the current report
```

- **`services/mirrorEngine.ts`** — deterministic. Pulls the window, computes every figure, applies
  every minimum-n gate, returns a typed `MirrorReport` with each section present or explicitly
  `null` with a reason.
- **Phrasing** — reuse the existing `/insights/coaching/phrase` path. Brief in, one sentence out.
  If the model fails or is slow, fall back to a deterministic template. The Mirror must render
  without it.
- **`mirror_snapshots` table** — a frozen report is immutable. Required for Save, for Share, and so
  a user's March Mirror doesn't silently rewrite itself in April.
- **Cadence** — rolling 30 days computed on demand and cached, *not* a monthly cron. Simpler, always
  current, and sidesteps a scheduler. Revisit if we want push notifications on the 1st.

---

## 4. Eligibility — the part that decides if this feels good

The screen currently assumes a fully-populated 30 days. Real users will not have that.

| Requirement | Gate |
|---|---|
| Report renders at all | ≥ 21 of 30 days with a daily summary |
| A correlation row | ≥ 14 paired observations **and** \|r\| above the engine threshold |
| Optimal sleep/protein | ≥ 10 days in each compared bucket |
| Biggest improvement | ≥ 45 of the previous 60 days logged |

Three states, all designed, none currently built:

1. **Not yet** — under 21 days. Show progress toward it. This is the state most new users see, and
   it is the one most likely to be skipped in implementation.
2. **Partial** — enough for some sections. Render those, omit the rest cleanly. No skeletons, no
   "—", no empty cards.
3. **Full** — the mock.

---

## 5. Blocking cross-dependency

The Mirror is gated on `useIsPremium()`, and the backend route on `requirePremium`. Today
`isPremium` is **false for every user**, because the RevenueCat entitlement `premium` does not exist
— only `Roundfit Pro` does. If the Mirror ships before that is reconciled, it is locked for
everyone, including us.

**Fix the entitlement before Phase 3 lands.** See `revenuecat_setup.md`.

---

## 6. Phases

**Phase 0 — honesty pass (small, do first)**
Relabel "confidence" → "strength". Delete the two correlations with no data source so the mock stops
implying capabilities we don't have.

**Phase 1 — backend assembler**
`mirrorEngine.ts` + `GET /api/insights/mirror`, deterministic only, no LLM. Unit-tested against
fixture windows: full, partial, sparse, and empty. This is the bulk of the work and the part worth
getting right.

**Phase 2 — wire the screen**
Replace the dummy block with the fetched report. Build the three eligibility states. No new design —
the screen already exists.

**Phase 3 — synthesis + gating**
Add the phrased sentence with template fallback. Apply premium gating and the upsell path for
non-subscribers.

**Phase 4 — Save**
`mirror_snapshots`, plus history so past Mirrors are reachable.

**Phase 5 — Share**
`react-native-view-shot` → `expo-sharing`. Needs its own share-card layout: the scrolling screen is
not a shareable image. Deliberately last — it is the most visible and the least load-bearing.

---

## 7. Decisions needed before Phase 1

1. **Best/worst training day** needs a per-day score; RIS is weekly. Reuse `readiness_scores`, or
   define a Mirror-local day score?
2. **"Optimal"** — is that the bucket with peak next-day energy, or peak RIS contribution? They will
   disagree, and the answer changes what the card claims.
3. **Cut or build** meal-timing analysis? Building it means timestamping food logs and a new
   detector — that is its own project, not a Mirror sub-task.
4. **Rolling vs calendar month.** Recommending rolling; "Mar 19 – Apr 18" in the mock implies rolling
   already, but Share and Save read more naturally as calendar months.

---

## 8. Risks

- **The correlation card is the product.** Everything else is arithmetic the user could roughly do
  themselves. If `patternEngine` rarely clears its thresholds on real data, the Mirror is a nice
  layout around an empty middle. **Before Phase 1, run the engine against real accounts and count
  how often ≥ 2 patterns fire.** If the answer is "rarely", this plan needs rethinking, not
  building.
- **60-day requirement** for the improvement card means it is invisible for the first two months of
  a user's life — i.e. for essentially the entire launch cohort.
- **Share is a growth feature wearing an analytics costume.** If the point is acquisition, it
  deserves its own design pass, not a screenshot of a report.
