# On-Device LLM for AI Insights — Hybrid Routing Plan

**Goal:** Cut OpenAI cost by generating AI insights **on-device** (Apple Foundation Models, free) whenever the
device supports it, and **falling back to the existing OpenAI path** when it doesn't.

## Scope (important — narrowed)

**In scope:** the **in-app, foreground AI daily summary + suggestion** — the `claudeInsight` shown on
`app/(tabs)/insights/daily.tsx` (`claudeInsight ?? todayInsight`, daily.tsx:182) and the home insight card that
links to it. Currently served by `GET /insights/ai` (OpenAI, premium). Generation happens **live when the screen /
card loads**, while the app is foregrounded.

**Explicitly out of scope (stays OpenAI, untouched):**
- The **background daily-insight notification** (`utils/daily-insight-delivery.ts` → `deliverRichInsightIfReady`
  + fallback one-shot, driven off HealthKit sleep background delivery). Foundation Models can't reliably run in a
  background window, so this surface keeps the OpenAI path.
- Weekly / 30-day "hero" reports.

Because the in-scope surface is **foreground-only**, there is **no background-generation constraint** and **no
generate-and-cache** requirement — on-device generation runs on demand when the user opens the daily view.

**Routing rule (source of truth = runtime availability, not a device-model list):**
- `SystemLanguageModel.default.availability == .available` → **Apple on-device LLM** (free)
- anything else (older iPhone, non-Pro iPhone 15, iOS < 26, Apple Intelligence off, Android) → **OpenAI** (paid)

---

## 1. Current state (verified)

- AI insight is **server-side**: `GET /insights/ai` (`requirePremium`) → `generateOpenAIInsight(userId)` in
  `roundfit-backend/src/services/openai.ts`.
  - `buildPrompt(userId)` aggregates the last 7 days of user data **on the backend** (openai.ts:194).
  - Calls OpenAI `gpt-4o` (openai.ts:291), enforces a 3/day limit (429), persists the insight to Supabase.
  - Weekly equivalent: `/weekly-ai` → `generateWeeklyOpenAIInsight`.
- Client just fetches the result: `context/insights-context.tsx` → `fetchClaudeInsight()` hits `/insights/ai`,
  stores `claudeInsight`. `InsightType = 'rules' | 'claude'`.
- **Implication:** the prompt + data aggregation live server-side. The client cannot generate on-device without
  that context. This is the central design constraint.
- Existing local Expo native module to copy: `modules/workout-live-activity/` (has `expo-module.config.json`,
  `.podspec`, Swift file, `src/index.ts`). iOS deployment target is **15.1** → the iOS 26 API must be behind
  `@available` / `canImport` guards so the app still builds and runs on older iOS.

---

## 2. Chosen architecture — "backend builds prompt, client generates on-device"

Keep prompt/aggregation logic in **one place** (server). Split the current server flow so the expensive OpenAI
call becomes optional:

```
                         ┌─ Apple LLM available? ──────────────────────────────┐
 client needs insight ──▶│  yes → GET /insights/ai/context (prompt only, no LLM)│
                         │        → run Foundation Models on-device (free)      │
                         │        → POST /insights/ai/persist (save result)     │
                         │  no  → GET /insights/ai (unchanged OpenAI path, paid)│
                         └─────────────────────────────────────────────────────┘
```

Why this shape:
- Reuses existing `buildPrompt` — no duplicated aggregation, no client/server drift.
- `/context` does **DB aggregation only** (cheap) — the OpenAI token cost is what we eliminate on eligible devices.
- Persisting on-device results keeps history, ratings, dismissal, and analytics consistent across both paths.

> Rejected alternative: build the prompt client-side from local contexts (food/workout/sleep/readiness). More
> code, risks divergence from the server prompt, and misses data not loaded on the client. Not worth it.

---

## 3. Workstreams

### A. Expo native module — `modules/apple-llm` (Swift)
Copy the `workout-live-activity` module layout.
- **API surface (JS):**
  - `isAvailable(): Promise<{ available: boolean; reason?: 'deviceNotEligible' | 'appleIntelligenceNotEnabled' | 'modelNotReady' | 'unsupportedOS' }>`
  - `generate(systemPrompt: string, userPrompt: string): Promise<{ text: string }>` (or a `@Generable`-typed variant, see below)
  - optional: `stream(...)` with an event emitter for token streaming; `prewarm()`.
- **Swift implementation:**
  - `import FoundationModels` inside `#if canImport(FoundationModels)`; wrap all model code in `@available(iOS 26.0, *)`.
  - `isAvailable` → map `SystemLanguageModel.default.availability` to the JS shape. On older iOS / non-canImport, return `available: false, reason: 'unsupportedOS'`.
  - `generate` → `LanguageModelSession(instructions:)` + `session.respond(to:)`.
  - **Guided generation (recommended):** define a `@Generable` struct mirroring the insight shape
    (`headline`, `body`, maybe `tag`) so we get structured output instead of parsing free text. Return it as JSON to JS.
- **Build config:** requires building against the **iOS 26 SDK** (Xcode 26). Deployment target stays 15.1; API is runtime-gated. Needs a **dev/EAS build** (not Expo Go).

### B. Backend — split the OpenAI flow (`insights.controller.ts` + `openai.ts`)
- **New:** `GET /insights/ai/context` (`requirePremium`) → returns `{ systemPrompt, userPrompt }` from the existing
  `buildPrompt(userId)` + the system-prompt constant. **No OpenAI call.** Also enforces/represents the daily limit
  state (so on-device can respect or ignore it — see Decision D2).
- **New:** `POST /insights/ai/persist` (`requirePremium`) → body `{ headline, body, generated_by: 'apple_fm', model }`.
  Validates, writes the same Supabase row `generateOpenAIInsight` writes, returns the saved `Insight`.
- **Refactor:** extract the persistence block out of `generateOpenAIInsight` into a shared `saveInsight(...)` used by
  both the OpenAI path and the new persist endpoint. Leave `GET /insights/ai` behaving exactly as today.
- Tag `context.generated_by` = `'apple_fm'` vs `'openai'` for cost tracking (mirrors the existing `generated_by`).
- (Weekly: same treatment later — phase 2 of this plan, once daily is proven.)

### C. Frontend — routing in `context/insights-context.tsx`
- Add a small hook `useAppleLLM()` (or `utils/apple-llm.ts`) wrapping the native module; cache `isAvailable`
  per app session, re-check on foreground (Apple Intelligence can be toggled). On Android the module is absent →
  `requireOptionalNativeModule` returns null → `available: false`.
- In `fetchClaudeInsight()` (rename to `fetchAIInsight()`):
  1. `if (available)` → `GET /insights/ai/context` → `AppleLLM.generate(systemPrompt, userPrompt)` →
     `POST /insights/ai/persist` → set `claudeInsight` from the saved row.
  2. `else` → existing `GET /insights/ai` (unchanged).
- Extend `InsightType` to `'rules' | 'openai' | 'apple'` (keep `'claude'` alias for back-compat if any rows use it).
- Error handling: if on-device `generate` throws (e.g. `modelNotReady`), fall back to `GET /insights/ai` so the
  user still gets an insight.

### D. Persistence / limits / analytics
- On-device insights still POST to `/persist` → history, dismiss, and rating keep working unchanged.
- Track counts by `generated_by` to measure actual OpenAI-call reduction (the whole point).

---

## 4. Decisions needed (call these out before building)

- **D1 — Tiering → DECIDED: everyone routes by device.** Any user (free or premium) on a capable device uses the
  Apple on-device LLM; everyone else uses OpenAI. Max cost cut. **Accepted tradeoff:** premium users on capable
  devices get on-device (~3B) quality rather than gpt-4o. Mitigations to keep in scope:
  - Keep the **weekly / 30-day "hero" reports on gpt-4o** even on capable devices (see §7 phase 4) so the highest-value
    output isn't degraded — revisit once we can compare on-device vs cloud quality on real insights.
  - Log `generated_by` so we can measure quality complaints / ratings by path and reverse a specific surface if needed.
- **D2 — Daily limit.** On-device generation is free — recommend **not** metering the on-device path (drop the 3/day
  cap when `generated_by = apple_fm`); keep the cap only on the OpenAI path. Confirm during backend work.
- **D3 — Cloud model.** Fallback stays OpenAI `gpt-4o` per your instruction. Note your project convention defaults
  to Claude, which is also cheaper per token than gpt-4o — a possible separate cost win on the fallback path.
- **D4 — iOS 26 toolchain → RESOLVED: EAS image on Xcode 26.** No blocker; native-module work can start immediately.

---

## 5. Fallback matrix

| Device / state | Path |
|---|---|
| iPhone 15 Pro+/16, iOS 26+, Apple Intelligence on | Apple on-device |
| Same hardware, Apple Intelligence off / model downloading | OpenAI (retry on-device later) |
| iPhone 15 / 15 Plus (non-Pro), older iPhones | OpenAI |
| iOS < 26 (any device) | OpenAI |
| Android | OpenAI |
| On-device generate() throws | OpenAI (graceful fallback) |

---

## 6. Testing
- Native: unit-check `isAvailable` mapping for each availability reason; `generate` returns structured output.
- Simulator/device: iOS 26 capable device (on-device path) **and** an older device / Android (OpenAI path).
- Frontend: mock `AppleLLM.isAvailable` true/false → assert correct endpoint is called and both persist identically.
- Cost: dashboard on `generated_by` counts to confirm OpenAI calls drop for eligible users.

---

## 7. Suggested phasing
1. **Backend split** (`/context` + `/persist`, refactor `saveInsight`) — safe, no behavior change to existing path.
2. **Native module** `modules/apple-llm` with `isAvailable` + `generate` (guided generation).
3. **Frontend routing** in `insights-context` with graceful fallback.
4. Measure OpenAI-call reduction; then extend to **weekly** insights.

---

## 8. Open questions for you
- D2: confirm on-device path is **unmetered** (drop the 3/day cap for `apple_fm`).
- Do you want streaming UX for the on-device insight, or is a single response fine for v1?
- Keep weekly/30-day reports on gpt-4o even on capable devices (recommended), or route those on-device too?

**Resolved:** D1 = everyone routes by device · D4 = EAS on Xcode 26 (no blocker).
