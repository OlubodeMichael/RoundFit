# Food Photo Analysis: Consistency Architecture

**Status:** proposed, not started
**Repos:** `roundfit` (Expo app), `roundfit-backend` (Express API)
**Audited against code:** 2026-09-08

---

## 0. The goal, stated precisely

> Photograph the same food on Monday and again on Thursday, from a different angle, in
> different light. Get the same calories.

This is **not** the same problem as "submit the same image file twice". That one is solved
by a content hash and is nearly worthless here, because a user photographing their usual
lunch again produces a genuinely different image every time. Every pixel differs.

So the architecture cannot be built on image similarity. It has to be built on making the
**pipeline downstream of perception** produce identical output from *approximately* equal
perception, and then recognising repeat meals by **what we detected**, not by how the photo
looked.

### Where the variance actually comes from

Two photos of the same plate. The number moves for six separate reasons:

| | Source | Magnitude today | Reducible? |
|---|---|---|---|
| V1 | **Model sampling.** `temperature` unset, so OpenAI defaults to `1.0`. Even a byte-identical image is sampled twice. | Large | **Eliminated** (temperature 0, seed) |
| V2 | **Identity drift.** "grilled chicken" one day, "chicken breast, grilled" the next. Different name, different nutrition, same food. | Large | **Eliminated** (canonical resolution) |
| V3 | **Arithmetic drift.** The model does the multiplication in its head, differently each time. | Medium | **Eliminated** (deterministic calculator) |
| V4 | **Lookup drift.** USDA search is a *ranked* query; rankings move as the index updates. | Medium | **Eliminated** (alias table, pinned `foods` rows) |
| V5 | **Portion jitter.** 143g from above, 152g from the side. Same plate, honest disagreement. | Medium | **Collapsed** (portion quantisation, section 4.4) |
| V6 | **Genuine perception difference.** The second angle hides a tortilla, or reads a sheen as oil. | Small but real | **Irreducible.** Handle with meal recognition and user confirmation (4.5, 4.6) |

V1 through V4 are *artificial* variance: the same perception producing different numbers.
They are pure engineering defects and they are most of the problem. V5 is real disagreement
that can be quantised away. V6 is physics, and the honest answer is to let the user confirm.

**The design principle that follows:** two photos that lead to the same *understanding* of
the meal must produce byte-identical numbers, by construction, not by luck.

---

## 1. Current state (audited)

### The path that actually runs

```
app/(tabs)/log/food/index.tsx:397   takePictureAsync({ quality: 0.8, skipProcessing: true, base64: true })
   -> components/log/PhotoAnalysisModal.tsx:248   previewPhoto(base64Image)     // raw, full-resolution
      -> POST /food/photo/preview
         -> food.controller.ts:92    previewFoodByPhoto
            -> openai.ts:117         scanFoodPhoto            // gpt-4o, default temperature
   -> user reviews / edits
   -> PhotoAnalysisModal.tsx:270     addMeal(...)             // POST /food/log, logged_via 'manual'
```

A second, parallel call resizes the same photo to 1080px and uploads it for display
(`PhotoAnalysisModal.tsx:234-243`). Every scan encodes the image twice, at two different
resolutions, and sends the **larger** one to the model.

### Defects

| # | Where | Defect | Variance source |
|---|---|---|---|
| 1 | `openai.ts:119-121` | No `temperature`, no `seed`, no `response_format`. Sampling at `t=1.0`. | **V1** |
| 2 | `openai.ts` prompt | Model is asked for calories and macros per component and for totals. It is doing the arithmetic and the nutrition lookup from memory. | **V2, V3, V4** |
| 3 | `food.controller.ts:104-111` | `previewFoodByPhoto` returns only `meal_name` + 4 totals. Discards `components[]`, `confidence`, `confidence_reason`, `range`, `no_reference`, `warnings`, all already typed on `FoodScanResult`. | blocks 4.6 |
| 4 | `index.tsx:397` | `skipProcessing: true`, so EXIF orientation is never applied. A portrait photo can reach the model rotated 90 degrees, and the answer changes with orientation. | **V5, V6** |
| 5 | `index.tsx:397` | Full-resolution base64 to the model (5-7MB against `index.ts:52`'s `10mb` limit) while a separate 1080px encode goes to storage. Slow, costly, near a 413. | |
| 6 | `context/food-context.tsx:553-594` | `analyzePhoto` is **dead code**, nothing imports it. Its cache-hit branch is also broken: it pushes a cached `MealItem` into local state, applies an optimistic total, never writes to the server, and reuses the *previous log's row id*. The following `syncToday()` reverts it and the meal vanishes. | |
| 7 | `utils/photo-cache.ts:8-14` | `hashBase64` is djb2 over only the **first 3000 characters** of base64, which for one camera is largely JPEG header and EXIF. Collision-prone in exactly its own population. | |
| 8 | `openai.ts:183` | `console.log('[FoodScan] Raw response:', content)` writes full meal contents and nutrition to application logs on every scan. | |
| 9 | `routes/food.ts:29-30` | `/photo/preview` and `/photo` are authenticated but have no per-user rate limit, only the global `apiRateLimiter`. They are the only routes that cost money per call. | |
| 10 | nothing stores it | No analysis is persisted. Only the final `food_logs` row (name + 4 numbers). **Repeat-meal variance is currently unmeasurable, and repeat-meal recognition is impossible.** | blocks 4.5 |

Defect 10 is the structural one. Recognising "this is your usual lunch" requires having
kept a structured record of your usual lunch. Today nothing is kept.

### Assets already in the repo

| Asset | Where | Use here |
|---|---|---|
| USDA FoodData Central client | `src/services/usda.ts` | Canonical per-100g nutrition. Live, keyed by `USDA_FDC_API_KEY`. |
| `NormalisedFood` with `portions[]` and `verified` | `src/types/food.types.ts:38` | Canonical record. `portions` carries USDA household serving text, which seeds the portion ladder (4.4). |
| `foods` table, `pinFood` / `getPinnedFood` | `src/services/foodRepository.ts:75-99` | Pins a food's macros so they cannot move under a stored analysis. Kills V4. |
| `normalizeName`, `tokenize`, `stemToken`, `rankFoods` | `src/services/foodRanking.ts:14-167` | The canonicalisation substrate for V2. Already written and tested. |
| `getRecentFoods` | `src/services/foodRepository.ts:126` | The user's actual eating history, which is the raw material for meal recognition. |
| Redis cache-aside, TTL, negative caching, fails open | `src/lib/cache/` | Name-resolution caching. |
| Zod | backend dep | Structured-response validation, no new dependency. |

### What is not available

- **No image-processing library** on the backend. No `sharp`, no `jimp`.
- **No pgvector**, no vector store.
- **No labelled photo set**, and none buildable until defect 10 is fixed.

None of these are needed by this design. That is deliberate.

---

## 2. Approaches considered and rejected

| Rejected | Why |
|---|---|
| **Image embeddings + nearest neighbour** | Aimed at the right goal, wrong signal. Needs pgvector, a per-image cost, and a labelled set that cannot exist yet. Worse, its failure mode is the exact case that matters most: a half-eaten plate is *visually* near-identical to a full one and would silently reuse the full-plate calories. Meal-level fingerprinting (4.5) hits the same target with a signal that gets *this* case right for free. |
| **Perceptual hashing** | Catches re-encoded or re-cropped copies of one photo. That is not the stated goal. It also needs a native JPEG-decode dependency on a Railway Node service to solve a case the client can avoid creating (4.1). |
| **Content hash as the primary mechanism** | Solves "same file twice", which is not the goal. Kept, but demoted to a cheap latency and cost win (4.7). |
| **Cross-user cache** | Two users' identical-looking plates are not the same portion. Also a privacy problem. User-scoped only, everywhere. |
| **Fine-tuning a portion model** | No labelled data, no evaluation set, and it would not remove V2 through V4, which are the larger share. |

---

## 3. The mechanism, in one paragraph

Make the model **see** and stop letting it **count**. It returns detected foods with a
portion *size class*, not calories. Each food resolves to a canonical id through a chain
that always returns the same id for the same food. The portion snaps to a coarse ladder,
so 143g and 152g both become 150g. A pure calculator turns (canonical id, snapped grams)
into calories. Those two facts, sorted, hash into a **meal fingerprint**. Two photos of the
same meal produce the same fingerprint and therefore, by construction, byte-identical
numbers. A half-eaten plate produces a different portion bucket, a different fingerprint,
and correctly gets a fresh answer.

---

## 4. Architecture

### 4.1 Normalise the input once, on the client

Today the client encodes twice and sends the larger, unrotated copy to the model.

```
capture with skipProcessing: false        // EXIF orientation applied
  -> manipulateAsync: resize width 1024, JPEG, compress 0.7
  -> ONE base64
      |-- POST /food/photo/preview   (analysis)
      |-- POST /food/upload-image    (display copy)
      \-- sha256 over the full base64
```

Orientation and resolution stop being free variables in the model's input. That is a direct
V5/V6 reduction, not just a cost fix: a rotated plate genuinely reads differently. Fixes
defects 4 and 5, removes a duplicate encode, halves bytes on the wire.

`skipProcessing: false` costs a few hundred milliseconds at capture. Take it.

### 4.2 The model returns observations, never numbers

Keep the existing `SYSTEM_PROMPT` (`openai.ts:39-84`). It is genuinely good: it has an
anchor-object step, a cooking-method step, a density step, and an explicit empty-plate rule.
Change only what it emits.

Per detected component:

- `name`, free text
- `portion_class`: one of `xs | s | m | l | xl`, **relative to a standard serving of that
  food**
- `estimated_grams` plus a `grams_low` / `grams_high` band, as a cross-check only
- `cooking_method`
- `confidence`

It no longer returns calories, macros, or totals for anything.

The `portion_class` is the important addition. A vision model is markedly more stable at
"this is a medium portion of rice" than at "this is 147 grams of rice", because the former
is a comparison against a familiar reference and the latter is false precision. The class
is the primary portion signal; `estimated_grams` is used only to detect disagreement
(section 4.4).

Call-site changes in `scanFoodPhoto`: `temperature: 0`, a fixed `seed`, `response_format`
as a JSON schema so shape violations surface as API errors rather than `parseModelJson`
returning `null` and the user seeing "Could not identify food", and a `PROMPT_VERSION`
constant stored with every result.

Be honest in the docs: `temperature: 0` plus a seed is *near*-determinism, not a guarantee,
and provider-side model updates still move answers. That is what the version tuple in 4.5
is for.

### 4.3 Canonical identity, so the same food is always the same food (kills V2, V4)

Resolution chain, first hit wins:

1. **`food_aliases`** table: `normalizeName(detected)` -> `fdc_id`. Hand-seeded from the top
   detections once telemetry exists. Deterministic, and the escape hatch when USDA ranks
   badly.
2. **The user's own recent canonical foods.** If they have logged a resolved "chicken
   thigh, grilled" before, prefer that exact `fdc_id`. This is what makes *your* chicken
   stay the same chicken. Uses `getRecentFoods`.
3. **Pinned `foods` row** by id, so a resolved food's macros never move under a stored
   analysis.
4. **Redis-cached USDA search** on the normalised name, long TTL, re-ranked by the existing
   `rankFoods`.
5. **Miss, or a low-confidence match: do not substitute.** Ask the model for that one
   component's macros, mark it `source: 'model_estimate'`, and show it in the breakdown.

Rule 5 is not a detail. USDA's generic "chicken, broiler, raw" against a visibly fried piece
is *worse* than the model's own estimate. A deterministic pipeline that confidently returns
a wrong canonical match is a regression. Every component carries its `source`, the user can
see it, and the resolution mix is a tracked metric (section 7).

Tiers 1 and 2 are what actually deliver the goal for a returning user. Tier 4 is the
cold-start path.

### 4.4 Portion quantisation, so honest disagreement collapses (kills V5)

Continuous gram estimates never repeat. Quantise them.

**The ladder.** Per canonical food, a standard serving in grams (from USDA `portions`, else
a class default). `portion_class` maps to a multiplier: `xs 0.5, s 0.75, m 1.0, l 1.5,
xl 2.0`. Grams are then snapped to a ratio ladder of roughly 15 percent steps
(`... 90, 110, 130, 150, 175, 200, 230, 260, 300 ...`). Constant *relative* precision, which
matches how portion error actually behaves.

**Cross-check.** If `estimated_grams` lands more than two rungs from the class-derived
value, the model is disagreeing with itself. Widen the calorie range and drop `confidence`
one level rather than silently picking one.

**Hysteresis, and this is the rung that carries the goal.** Snapping alone flaps at bucket
boundaries: 143g and 152g can straddle one and you are back to two different answers. So:
when the same user has a recent analysis with the **same canonical food set** and this
component lands in an *adjacent* bucket, snap to the **previous** bucket. Portions stay
sticky across repeat photos of a genuinely unchanged meal, while a real two-bucket jump
(half a plate, a double serving) still moves.

**State it plainly in the UI.** Showing 147 kcal implies a precision that does not exist.
Quantised numbers are more honest, not less.

### 4.5 Meal fingerprint: recognise the meal, not the picture

This replaces image similarity entirely.

```
fingerprint = sha256(
  sorted( canonical_food_id + ":" + snapped_grams  for each component )
  + model + prompt_version + calc_version
)
```

Derived from **what we understood**, not from pixels. Consequences:

- Two photos of the same meal that resolve the same way produce the same fingerprint, so
  the same numbers, byte for byte. That is the goal, met by construction.
- A **half-eaten plate** lands in a lower portion bucket, so a different fingerprint, so a
  fresh answer. The failure mode that sinks image embeddings is handled correctly and for
  free.
- **A new side or sauce** adds a component, changes the fingerprint, forces a fresh answer.
- The version tuple is baked in, so invalidation is a constant bump.
- It is **explainable**. "We recognised this as your usual chicken and rice" is a sentence
  you can show a user. "Cosine similarity 0.94" is not.

On a fingerprint hit against a **user-confirmed** prior analysis, reuse that prior's totals,
including the user's own corrections. This is the payoff: consistency and accuracy improve
together, because the number being repeated is one the user already approved.

Scoped per user, always. Two people's fingerprints never meet.

### 4.6 Review before save, always

Reuse produces a **preview to review**, never a silent write. This is the containment for
V6, the irreducible part, and it is also what stops defect 6's class of bug from returning.

`PhotoAnalysisModal` today renders four numbers. The model has always returned more, and
`previewFoodByPhoto` throws it away (defect 3). Widen `PhotoPreview` and show:

- each component with its portion class, snapped grams, and calories
- per-component add, remove, edit; totals recompute through the **same** pure calculator
- a calorie range when confidence is not `high`, when `no_reference` is true, or when 4.4's
  cross-check disagreed
- plain estimate language
- a quiet marker on any `model_estimate` row
- on a fingerprint hit, "this looks like your [meal name] from Tuesday", fully editable

There is exactly one arithmetic path, so there is nothing to drift.

### 4.7 Content hash, demoted

sha256 over the full normalised base64, keyed with the version tuple, user-scoped, in Redis
for 7 days. It catches a genuine double-submit and a retry after a network error. It is a
latency and cost win, not the consistency mechanism. It replaces `hashBase64` (defect 7).

`analyzePhoto` and its broken cache-hit branch are deleted (defect 6), not extended.

### 4.8 Persist every analysis

New table `food_photo_analyses`. Without it there is no fingerprint history, so no
recognition, and no way to measure the goal.

- `id`, `user_id`, `created_at`, `expires_at`
- `image_sha256`, `image_url` (nullable, capability URL as today)
- `meal_fingerprint` (indexed with `user_id`)
- `observations` jsonb, model output verbatim
- `components` jsonb: `fdc_id` or null, `portion_class`, `snapped_grams`, macros, `source`
- `totals` jsonb, `calorie_range` jsonb, `confidence`, `no_reference`, `warnings`
- `model`, `prompt_version`, `calc_version`
- `disposition`: `fresh` | `hash_hit` | `fingerprint_hit`
- `source_analysis_id`, `food_log_id` (both nullable)
- `user_edited` boolean, `final_totals` jsonb

Rules: **RLS on and user-scoped**, in the pattern of `users_rls.sql`, not merely scoped in
application code. Deleting a `food_log` nulls `food_log_id` and keeps the analysis until
`expires_at`, so the fingerprint history survives. Deleting an **account** deletes the
analyses and the storage objects. Account cascade is the one most easily forgotten.

`user_edited` and `final_totals` are what make "are we right" answerable, and they are what
tier 2 recognition reuses.

---

## 5. End to end

```
CLIENT
  capture (EXIF applied) -> normalise 1024/0.7 -> base64 -> sha256

BACKEND  POST /food/photo/preview { base64, sha256 }
  1. redis hash hit on (user, sha256, versions)?      -> preview, 'hash_hit'
  2. scanFoodPhoto (temperature 0, seed, json schema) -> observations[]
  3. resolve each name    (alias -> user's recents -> pinned -> cached USDA -> model)
  4. quantise each portion (class x standard serving -> ladder -> hysteresis)
  5. meal_fingerprint = sha256(sorted canonical ids + snapped grams + versions)
  6. fingerprint hit for this user on a CONFIRMED prior?
        yes -> reuse that prior's totals            -> preview, 'fingerprint_hit'
        no  -> nutritionCalculator: grams x per-100g, sum, round, range  -> 'fresh'
  7. write food_photo_analyses; cache; return

CLIENT
  review screen: components, portions, ranges, confidence, per-item edit
  -> addMeal(final) -> POST /food/log
  -> PATCH analysis: food_log_id, user_edited, final_totals
```

Steps 3 through 5 are the whole design. Step 6 is what makes the second photo of Tuesday's
lunch return Tuesday's number.

---

## 6. Build order

Each step ships independently and is useful alone.

### Step 0: Stop the bleeding (hours)
- `temperature: 0` and a fixed `seed` in `scanFoodPhoto`. **This alone removes V1**, the
  largest single source, including for identical images.
- Redact `openai.ts:183` to a length and a parse result, never contents.
- Per-user rate limit on `/food/photo` and `/food/photo/preview`.
- Delete `analyzePhoto` and its broken cache-hit branch.

### Step 1: Normalise input, surface what exists (1-2 days)
- Client: one normalise, `skipProcessing: false`, one base64 for both calls.
- Backend: stop discarding `components`, `confidence`, `range`, `warnings`.
- Client: render the component list, the range, and the estimate language.

### Step 2: Persist and measure (1-2 days)
- `food_photo_analyses` migration with RLS and the deletion rules.
- Write on every analysis, patch on save.
- Ship section 7's telemetry, in particular the **same-meal variance** baseline.
- **Everything after this is decided against a measured number rather than a guess.**

### Step 3: Canonical identity and deterministic arithmetic (3-5 days)
Kills V2, V3, V4. The largest remaining share.
- JSON-schema output with `portion_class`, `PROMPT_VERSION`.
- `nutritionCalculator.ts`: pure, no network, unit-tested.
- Resolution chain with the `model_estimate` fallback; `food_aliases` table.
- Recompute through the calculator on every user edit.

### Step 4: Portion quantisation (2-3 days)
Kills V5.
- Standard servings from USDA `portions`, class multipliers, the ratio ladder.
- The `estimated_grams` cross-check and its effect on confidence.
- Hysteresis against the user's recent analyses.

### Step 5: Meal fingerprint recognition (2-3 days)
Handles the repeat-meal case directly.
- Compute and index the fingerprint.
- Reuse only against a **user-confirmed** prior.
- "This looks like your [meal] from [day]" in the review screen, fully editable.

### Step 6: Content hash reuse (half a day)
Cost and latency only. Deliberately last.

**Given the open App Store submission blockers, launch scope is steps 0 through 2.** Step 0
is hours of work and removes the largest single variance source; it should ship regardless.
Steps 3 through 5 are the real feature and belong in the next release.

---

## 7. Metrics

The primary metric follows the goal statement, not the implementation.

1. **Same-meal variance.** For analyses sharing a `meal_fingerprint` prefix (same canonical
   food set, any portion bucket) within a user, the spread of calorie totals across
   *separate photos*. **This is the number the goal is written in.** Baseline it at step 2,
   before any of steps 3 through 5, so the improvement is attributable.
2. **Same-photo variance on a forced cache miss.** Isolates residual V1 and V3. Should be
   zero after step 3.
3. **Edit rate and mean signed calorie delta.** `final_totals` minus `totals`. A perfectly
   consistent number that users always drag downward is a consistently wrong number, and
   this is the only metric that catches it.
4. **Resolution mix**: alias / recents / pinned / USDA / `model_estimate`. A high fallback
   rate means step 3 bought version-pinning and little else.
5. **Fingerprint hit rate**, and **false-reuse rate** measured as the edit rate *on
   fingerprint hits* versus fresh. If reuse is wrong, users correct it more often, and this
   catches it without a labelled set.

Supporting: p50/p95 latency by disposition, cost per analysis, schema-validation failures,
`zero_calories` rate. Content-hash hit rate is reported as a **cost** metric only.

---

## 8. Testing

**Unit, backend**
- calculator: grams to macros, rounding, range propagation, empty and single component
- ladder: snapping, boundary behaviour, hysteresis with and without a recent neighbour
- resolution chain: every tier, and the `model_estimate` fallback
- fingerprint: stable under component reordering, changes on a portion-bucket move, changes
  on an added component, changes on a version bump
- schema validation against malformed and partial model output

**Unit, client**
- sha256 stability across two normalisations of one source image
- totals recompute correctly after component add, remove, edit

**Integration**
- same photo twice: identical totals
- same photo twice, cache bypassed: identical totals after step 3
- **two different photos of one plate: identical totals after step 5** (the goal)
- half-eaten plate: different bucket, fresh analysis, lower calories
- added sauce: extra component, fresh analysis
- version bump invalidates every reuse path
- RLS blocks cross-user reads, tested at the database, not the query
- account deletion removes analyses and storage objects

**The repeat-photo set.** Roughly 15 meals, each photographed 3 times: different angle,
different light, different day. This is the fixture the whole plan is judged on. Build it at
step 2 and run it against every release. Cheap to make, and it is the only artefact that
directly measures the stated goal.

---

## 9. Acceptance criteria

- **Two photos of the same unchanged meal return the same calories**, on the repeat-photo
  set, at the agreed rate.
- A half-eaten plate returns lower calories, never the full-plate number.
- The same normalised photo returns identical totals within a version tuple.
- Every component carries its resolution source, and `model_estimate` is visible.
- All totals, fresh, reused, and edited, come from the one calculator.
- No meal is written without passing through the review screen.
- Every stored analysis carries model, prompt, and calculation versions.
- No analysis is readable by another user, enforced by RLS.
- Meal contents never reach application logs.
- Account deletion removes analyses and their storage objects.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| **Consistently wrong beats inconsistently right, and users notice** | Edit rate and signed calorie delta are tier-1 metrics. Consistency without an accuracy check is the main way this plan could fail quietly. |
| Quantisation flaps at a bucket boundary | Hysteresis against the user's own recent analyses (4.4). Explicitly unit-tested. |
| Fingerprint reuses a stale meal that genuinely changed | Reuse only against user-confirmed priors, always reviewable, and portion buckets are part of the key. Watch edit rate on hits versus fresh. |
| Canonical mapping is confidently wrong (generic USDA entry for a fried food) | `model_estimate` fallback, per-component `source` shown, resolution-mix metric. |
| Determinism mistaken for accuracy | Portion estimation stays the dominant error term. Ranges and estimate language in the UI. |
| Provider model change moves every answer | Version tuple in every key and row; repeat-photo set run each release. |
| Vision endpoint abuse or cost spike | Per-user rate limit at step 0, cost-per-analysis metric. |
| Scope creep back to embeddings | 4.5 hits the same target with a better failure mode and no new infrastructure. Revisit only if the repeat-photo set shows fingerprinting failing for a reason embeddings would fix. |

---

## 11. Summary

The goal is that the same food photographed twice gives the same number. Most of what
breaks that today is not perception, it is engineering: the model is sampled at temperature
1.0, it names foods differently each time, it looks up its own nutrition, and it does its
own arithmetic. Fix those four and the answer stops moving for reasons that have nothing to
do with the food. Then quantise portions, so 143g and 152g both become 150g and honest
visual disagreement stops leaking into the total. Then fingerprint the meal by what was
detected rather than by how the photo looked, so the second photo of your usual lunch
returns the number you already confirmed, while a half-eaten plate correctly does not. Image
embeddings target the same goal with a worse signal, worse failure mode, and infrastructure
this repo does not have. Start with `temperature: 0`, which is hours of work and removes the
single largest source.
