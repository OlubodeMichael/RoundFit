# Food Search — Implementation Plan

**Status:** proposed, not started
**Repos:** `roundfit` (Expo app), `roundfit-backend` (Express API)
**Blocks:** LAUNCH_CHECKLIST.md line 61, MVP_TODO.md lines 19 / 39

---

## 0. Why this document exists

A previously circulated architecture proposed building food search on **Supabase Edge
Functions**, with a `foods` table mirroring USDA + Open Food Facts and a `food_search_cache`
table in front of it. That design is sound for a greenfield Supabase-only app. It is wrong
for RoundFit, which already has a full API tier with caching, auth, and write-side effects.

This document records what to discard, why, and what to build instead.

---

## 1. Current state (audited 2026-08-09)

### Backend — `roundfit-backend`

| Route | Provider | Works? |
|---|---|---|
| `GET  /api/food/search` | Edamam `auto-complete` → N× `food-database/v2/parser` | ❌ **dead** — no API keys in `.env` |
| `POST /api/food/parse` | Edamam `nutrition-details` | ❌ **dead** — same |
| `GET  /api/food/:foodId` | Edamam parser by `foodId` | ❌ **dead** — same |
| `POST /api/food/barcode`, `/barcode/preview` | Open Food Facts v0 | ✅ works, no key needed |
| `POST /api/food/photo`, `/photo/preview` | OpenAI vision (`scanFoodPhoto`) | ✅ works |
| `POST /api/food/log`, `GET /logs`, `DELETE /log/:id` | Supabase | ✅ works |
| `GET/POST/DELETE /api/food/custom` | Supabase `custom_foods` | ✅ works, **no client UI** |

Supporting code that already exists and should be kept:

- `src/lib/cache/foodCache.ts` — Redis cache-aside wrappers with TTL + negative caching
  (tombstones) for search / item / parse / barcode. This is the caching layer; it is good.
- `src/lib/cache/cacheAside.ts` — fails open when Redis is down.
- `src/middleware/conditionalGet.ts` — ETag support, already used by `GET /food/logs`.
- `src/utils/openFoodFactsServing.ts` — per-serving nutrient extraction from OFF.

Problems in the existing search path beyond the missing keys:

1. **N+1 fan-out.** `searchFood()` calls autocomplete, then fires a `parser` request *per
   result* (10 per keystroke-batch). Even with keys this burns quota catastrophically.
2. **Edamam is the wrong provider now.** Its Food Database API moved behind paid/enterprise
   tiers; there is no viable free tier for a launching consumer app.
3. **Two duplicate OFF clients.** `src/services/foodLookup.ts` (used) and
   `src/services/openfoodfacts.ts` (orphaned, never imported). Dead code.
4. **`logFoodByBarcode` bypasses the cache** — calls `lookupBarcode` directly while
   `previewFoodByBarcode` goes through `cachedLookupBarcode`.

### Client — `roundfit`

- `app/(tabs)/log/food/search.tsx` — **entirely mock**: 10-item `CATALOG` const, hardcoded
  `RECENT` string array, hardcoded "POPULAR". Never calls `apiFetch`.
- `app/(tabs)/log/food/[id].tsx` — **second mock catalog** with hand-written portion tables.
- `context/food-context.tsx` — has `addMeal`, `previewBarcode`, `previewPhoto`, `analyzePhoto`,
  `logBarcode`, `deleteMeal`, `fetchForDate`. **No search, no food detail, no custom foods,
  no recents, no favourites.**
- Barcode scanning **is implemented** — `CameraView` + `onBarcodeScanned` live inside
  `app/(tabs)/log/food/index.tsx`, feeding `previewBarcode`. (MVP_TODO's "no decoder
  installed" note is stale.)
- `app/(tabs)/log/food/scan.tsx` — decorative dead screen (fake barcode bars, no camera).
  Registered in `_layout.tsx` but unreachable from any UI entry point.
- No SQLite. Offline caching is `utils/resource-cache.ts` over AsyncStorage.

### Schema — `sql.md`

`food_logs` already has `serving_size`, `serving_unit`, `edamam_id`, `barcode`, `log_date`.
But `logFoodSchema` (zod) only accepts `meal_name`/`calories`/macros/`log_date`/`meal_label`/
`image_url` — so serving data is never written. There is no `foods` table, no portions table,
no favourites, no popularity.

---

## 2. What to remove from the proposed plan

| Proposed | Verdict | Why |
|---|---|---|
| `supabase/functions/search-food`, `lookup-barcode`, `log-food`, `get-recent-foods`, `get-favorites`, `calculate-nutrition`, `create-custom-food` (Phases 3, 18) | **Drop entirely** | Creates a second backend with a second auth path. Every food write must run `upsertDailySummary` → `refreshStreak` → `fireBadgeCheck` → `buildTodayReconcile`. Duplicating that in Deno guarantees drift in streaks and badges. |
| `foods` table as a full mirror of USDA + OFF (Phase 2) | **Drop the mirror** | Re-implements a cache Redis already provides, plus corpus sync, staleness sweeps, and storage cost. Keep a *much* smaller `foods` table — see §4. |
| `pg_trgm` GIN index as the search engine (Phase 2) | **Drop as primary** | Trigram similarity has no lemmatisation and no relevance model; it ranks "chicken soup base" over "chicken breast". Useful only as a fallback over the small pinned set. |
| `food_search_cache` table, "Level 2 cache" (Phase 10) | **Drop** | Exactly what `cachedSearchFood()` in `foodCache.ts` already does, at `food:search:<hash>` with a 24h TTL. |
| `services/foodService.ts` on the client (Phase 19) | **Drop** | The app's data access pattern is context + `apiFetch` + `resource-cache`. A parallel service layer bypasses `applyTodayOptimistic` / `applyTodayReconcile` / `notifyTodayDataChanged` and reintroduces the stale-cache bug class already documented for recovery-sleep and water. |
| `food_logs.food_id references foods(id)` (Phase 8) | **Drop the FK** | The plan correctly says snapshot nutrition, then adds a FK that blocks deleting cached foods. Store `food_id` as plain namespaced text. |
| SQLite offline layer (Phase 20) | **Drop for v1** | No SQLite dependency exists. Recents/favourites ride the existing AsyncStorage `resource-cache` for free. |
| Photo logging as "Phase 16" | **Already built** | `scanFoodPhoto` + `/food/photo` shipped. Not future work. |
| Recipes / meals (Phase 15) | **Defer post-launch** | Correctly ordered last in the original; keep it there. |
| "1,000 req/hr/IP is fine with caching" | **Understated** | Railway egress is a small shared IP pool, so that quota is *one global bucket for all RoundFit users*, not per-user. Needs an explicit guard — see §7. |

Dead code to delete while doing this:

- `roundfit-backend/src/services/edamam.ts` (whole file)
- `roundfit-backend/src/services/openfoodfacts.ts` (orphan duplicate)
- `EDAMAM_*` references in `src/types/food.types.ts` (`FoodSource`), `sql.md`
  (`food_logs.edamam_id`), `API.md`
- `CATALOG` const in `app/(tabs)/log/food/search.tsx`
- `CATALOG` const in `app/(tabs)/log/food/[id].tsx`
- `app/(tabs)/log/food/scan.tsx` + its `Stack.Screen` in `app/(tabs)/log/_layout.tsx`

---

## 3. Target architecture

```
Expo app
   │  apiFetch (Bearer + refresh mutex)   ← unchanged
   ▼
Express  /api/food/*        ← auth, rate limit, ETag, summary/streak/badge writes
   │
   ├─ Redis cache-aside  (foodCache.ts)   ← hot path, 24h–30d TTLs
   │
   ├─ Postgres `foods`   (pinned only)    ← foods a user actually logged + custom foods
   │
   └─ Providers
        ├─ USDA FoodData Central  → generic foods, ingredients, branded search
        └─ Open Food Facts        → barcode, packaged goods, product images
```

The app never learns which provider answered. `source` is a display detail only.

### Provider split

| Need | Provider | Notes |
|---|---|---|
| Generic foods, ingredients, cooked dishes | USDA FDC `/v1/foods/search`, **no `dataType` filter** | Public domain. Free API key. |
| Branded / packaged by name | same single request | ~1.9M items, US-centric. |
| Barcode | Open Food Facts (already wired) → fallback USDA Branded by `gtinUpc` | OFF has better non-US coverage and product images. |
| Natural-language text ("3 eggs and toast") | OpenAI (already a dependency) for **parsing only** | LLM extracts `{food, quantity, unit}`. Nutrition comes from USDA/OFF. Never let the model invent calories. Same principle as the coach: the model phrases, the data decides. |

Get the key at `https://fdc.nal.usda.gov/api-key-signup`. It lives in Railway env as
`USDA_FDC_API_KEY` — never in the app bundle.

### Normalised food model

One shape, returned by every food endpoint. Per-100g is the source of truth; portions are
multipliers onto it.

```ts
// roundfit-backend/src/types/food.types.ts
export type FoodSource = 'usda' | 'openfoodfacts' | 'custom'

export interface FoodPortion {
  label: string       // "1 medium", "1 cup, chopped", "100 g"
  grams: number       // canonical weight
  isDefault?: boolean
}

export interface NormalisedFood {
  id: string          // namespaced: "usda:171077" | "off:0016000275287" | "custom:<uuid>"
  name: string
  brand?: string
  source: FoodSource
  barcode?: string
  imageUrl?: string

  // per-100g — the only nutrition truth
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  fibrePer100g?: number
  sugarPer100g?: number
  sodiumPer100g?: number   // mg

  portions: FoodPortion[]  // always includes "100 g"
  verified: boolean        // true for USDA Foundation/SR Legacy
}
```

The namespaced `id` is what makes `GET /api/food/:foodId` work without a lookup table — the
prefix selects the adapter.

---

## 4. Schema changes

Applied as `roundfit-backend/supabase/migrations/food_search.sql`, mirrored into `sql.md`.

### `foods` — pinned cache, *not* a corpus mirror

A row is written only when a food is (a) logged by a user, or (b) user-created. This keeps
food-detail pages and recents working after a Redis eviction, and keeps the table in the
thousands of rows rather than millions.

```sql
create table foods (
  id            text primary key,        -- "usda:171077" | "off:…" | "custom:<uuid>"
  source        text not null,           -- 'usda' | 'openfoodfacts' | 'custom'
  owner_user_id uuid references users(id) on delete cascade,  -- null = shared/public
  name          text not null,
  normalized_name text not null,
  brand         text,
  barcode       text,
  image_url     text,

  calories_100g numeric not null,
  protein_100g  numeric,
  carbs_100g    numeric,
  fat_100g      numeric,
  fibre_100g    numeric,
  sugar_100g    numeric,
  sodium_100g   numeric,

  portions      jsonb not null default '[]'::jsonb,   -- FoodPortion[]
  verified      boolean not null default false,

  cached_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index foods_normalized_name_idx on foods (normalized_name);
create index foods_barcode_idx         on foods (barcode) where barcode is not null;
create index foods_owner_idx           on foods (owner_user_id) where owner_user_id is not null;

alter table foods enable row level security;
create policy "read shared or own foods" on foods
  for select using (owner_user_id is null or auth.uid() = owner_user_id);
create policy "write own foods" on foods
  for all using (auth.uid() = owner_user_id);
```

Portions as `jsonb` rather than a `food_portions` table: they always load with the food, are
never queried independently, and come from the provider (USDA `foodPortions[]`, OFF
`serving_quantity`) rather than being hand-authored.

### `food_logs` additions

```sql
alter table food_logs add column if not exists food_id text;
alter table food_logs add column if not exists grams   numeric;
alter table food_logs drop column if exists edamam_id;
create index if not exists food_logs_user_food_idx on food_logs (user_id, food_id);
```

No FK to `foods`. Macros on the log row stay a **snapshot** — if USDA revises a value,
yesterday's diary must not move.

### `favorite_foods`

```sql
create table favorite_foods (
  user_id    uuid not null references users(id) on delete cascade,
  food_id    text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);
alter table favorite_foods enable row level security;
create policy "user owns favorites" on favorite_foods
  for all using (auth.uid() = user_id);
```

Note: the backend runs on the service-role key and bypasses RLS (see SECURITY_REVIEW.md), so
these policies are defence-in-depth. **Every query in the new controllers must scope by
`user_id` explicitly.**

No `food_popularity` table for v1 — global popularity needs traffic that doesn't exist yet.
Personal recency from `food_logs` delivers most of the perceived benefit (§6).

---

## 5. Backend implementation

### New / rewritten files

```
src/services/usda.ts              NEW  — FDC search + detail, → NormalisedFood
src/services/openFoodFacts.ts     REWRITE of foodLookup.ts → NormalisedFood, per-100g
src/services/foodRanking.ts       NEW  — deterministic merge + score, pure function
src/services/foodRepository.ts    NEW  — pin/read `foods`, recents, favourites
src/services/foodTextParse.ts     NEW  — OpenAI → [{food, quantity, unit}], no nutrition
src/lib/cache/foodCache.ts        EDIT — point at usda/off instead of edamam
src/controllers/food.controller.ts EDIT — see routes below
src/services/edamam.ts            DELETE
src/services/foodLookup.ts        DELETE (superseded by openFoodFacts.ts)
src/services/openfoodfacts.ts     DELETE (orphan)
```

### Routes

| Method | Path | Change |
|---|---|---|
| `GET` | `/api/food/search?q=&limit=` | Rewritten: USDA generic + branded, one request each, merged + ranked, Redis-cached |
| `GET` | `/api/food/:foodId` | Rewritten: adapter chosen by id prefix; falls back to `foods` table |
| `POST` | `/api/food/parse` | Rewritten: OpenAI parse → per-item search → normalised foods |
| `POST` | `/api/food/log` | Extended: accepts `food_id` + `grams`; server recomputes macros from the cached food and snapshots them |
| `GET` | `/api/food/recent` | **NEW** — distinct recently logged foods for the user |
| `GET` | `/api/food/favorites` | **NEW** |
| `POST` | `/api/food/favorites` | **NEW** — `{ food_id }` |
| `DELETE` | `/api/food/favorites/:foodId` | **NEW** |
| `POST` | `/api/food/barcode` | Fixed: route through `cachedLookupBarcode`, pin to `foods`, add USDA branded fallback |

`GET /api/food/:foodId` is declared **after** the literal routes in `routes/food.ts` — it
already is, and `recent`/`favorites` must be registered above it or they'll be swallowed by
the wildcard.

### Logging by food id (tamper-resistant)

`POST /api/food/log` keeps its current free-form shape for manual entry, and gains a second
accepted shape:

```jsonc
{ "food_id": "usda:171077", "grams": 175, "meal_label": "lunch", "log_date": "2026-08-09" }
```

The server resolves the food (Redis → `foods` → provider), computes
`macro = per100g × grams / 100`, writes the snapshot, and pins the food into `foods`. The
client never sends calories on this path, so a modified client can't poison summaries,
streaks, or badges.

### Ranking — `foodRanking.ts`

A pure, unit-tested function over the result page. Weights below are the ones that survived
testing against the live catalogue (see "Provider quirks"):

```
+50  name equals query          (compared on stems, so "banana" == "Bananas")
+30  name starts with query
+35  USDA Foundation or SR Legacy               (lab-analysed)
+20  unbranded                                  (covers Survey/FNDDS, which is generic
                                                 but not lab-analysed, so not "verified")
+15  every query stem appears in the name
 +5  has an image
-15  name > 60 chars AND branded
-25  branded while query is 1–2 generic tokens
+25  branded while query matches its brand
```

Tokens are compared as crude singular stems. USDA names generic foods in the plural
("Bananas, raw") while people search singular, so without stemming the plain food loses the
token-match bonus to a processed one ("Banana, dehydrated").

Generic-vs-branded intent is decided once, before scoring — a query of ≤2 tokens matching no
result's brand is generic — and branded results are then capped at 40% of the page.

### Provider quirks (learned against the live API, not documented by USDA)

1. **Never send `dataType`.** Filtering by dataType makes `/foods/search` return sporadic
   400s — measured at 50–75% of requests, independent of query text, parameter encoding
   (`+` vs `%20`), or retrying. Without the filter, success was 100% across repeated runs.
   One unfiltered `pageSize=50` request also returns a good natural mix (a "banana" page is
   ~48 generic / 2 branded; "cheerios" is 43 branded), so intent separation is preserved.
   This halves quota use versus one request per catalogue.
2. **Percent-encode parentheses** if `dataType` is ever reintroduced: `Survey (FNDDS)` is
   left raw by `URLSearchParams` and rejected by the API's nginx tier.
3. **The API has real outages.** During development it returned 502 across most queries for
   several minutes, then recovered. One bounded retry covers brief blips; sustained outages
   are what the degraded-mode fallback in §7 is for.
4. **Nutrient *numbers*, not ids.** `nutrientId` is not stable across dataset revisions;
   `nutrientNumber` ("208" energy, "203" protein) is. Search and detail responses also use
   different nutrient shapes (`{nutrientNumber, value}` vs `{nutrient: {number}, amount}`).

### Caching

Keep `cacheAside`. Retune TTLs in `foodCache.ts`:

| Key | TTL | Negative TTL |
|---|---|---|
| `food:search:<hash(q)>` | 7 days | 1 h |
| `food:item:<foodId>` | 30 days | 1 h |
| `food:barcode:<code>` | 30 days | 24 h |
| `food:parse:<hash(text)>` | 24 h | 1 h |

Food data isn't time-sensitive; the current 24h search TTL is far shorter than it needs to be
and costs quota for nothing.

---

## 6. Client implementation

### `context/food-context.tsx` — extend, don't replace

```ts
searchFoods(query: string): Promise<FoodSearchResult[]>   // debounced by caller
getFood(foodId: string): Promise<FoodDetail | null>
logFood(foodId: string, grams: number, label: MealLabel): Promise<void>
getRecentFoods(): Promise<FoodSearchResult[]>
getFavorites(): Promise<FoodSearchResult[]>
toggleFavorite(foodId: string): Promise<void>
```

`logFood` must follow the existing `addMeal` contract exactly: optimistic insert →
`applyTodayOptimistic` → POST → `applyTodayReconcile(body.today)` → `notifyTodayDataChanged`
→ rollback on failure. Recents and favourites go through `fetchWithResourceCache` with a
short TTL so the pre-search screen paints instantly.

### `app/(tabs)/log/food/search.tsx`

- Delete `CATALOG` and `RECENT`.
- Debounce input **350 ms**, minimum query length **2**, abort the in-flight request on the
  next keystroke.
- Empty state (no query): **Recent** (from `/food/recent`) → **Favourites** → **My foods**
  (`/food/custom`). Drop "Popular" until there's real popularity data; showing a fixed list
  labelled POPULAR is a lie the user will notice.
- Result row shows name, brand, and kcal at the food's default portion.
- Keep the existing "Nothing found → Add manually" empty state; it's the right fallback.
- Keep the `food_searched` PostHog capture, and add `result_count` + `source_mix`.

### `app/(tabs)/log/food/[id].tsx`

- Delete `CATALOG`; fetch via `getFood(id)`.
- Portion picker driven by `food.portions`; quantity stepper multiplies grams.
- Live macro readout recomputed from per-100g on every change.
- Log button calls `logFood(foodId, grams, label)` — no macros in the request body.
- Show a provider attribution line (see §8).

### Custom foods

`/food/custom` has worked server-side the whole time with no UI. Add a "Create food" entry
from the search empty state, writing `source: 'custom'`. This is also the escape hatch for
foods neither provider carries (the Jollof-rice case).

---

## 7. Rate limits, cost, failure

### Cost: $0 in added spend

This is the cheapest viable design, and deliberately so.

| Component | Cost | Note |
|---|---|---|
| USDA FoodData Central | **$0** | Free API key, public domain / CC0 |
| Open Food Facts | **$0** | No key required, ODbL (see §8) |
| Redis cache | **$0 added** | Already provisioned (`REDIS_URL` set), already fronts the hot GETs |
| Express routes | **$0 added** | Already deployed on Railway |
| `foods` table | negligible | Pinned rows only — thousands, not millions |
| OpenAI (text parse, step 16) | ~$0 | Post-launch, parse-only, already a dependency |

Rejected paid options: **Nutritionix** (partner-gated), **Edamam** (Food Database API now
paid/enterprise — this is why the current search is dead). Neither is needed.

Note that mirroring a food corpus into Postgres is *not* the cheaper cache: Supabase bills on
database size, and Redis is already paid for. Cache in Redis, pin only what users log.

### Rate limits

USDA FDC allows **1,000 requests/hour/IP** by default. Railway egresses through a small
shared IP pool, so treat that as **one global bucket for the entire user base**, not per-user.

Mitigations, in order of effect:

1. **Redis cache** — after warm-up, the long tail of repeat queries never reaches USDA.
2. **One provider request per search** — the Edamam N+1 fan-out is what would actually have
   burned the quota; the USDA `/foods/search` endpoint returns full nutrients inline, and
   dropping the `dataType` filter (see "Provider quirks") keeps it at a single request.
3. **Client debounce 350 ms + min length 2** — cuts per-session request count by roughly an
   order of magnitude versus per-keystroke.
4. **Redis token bucket** (`food:quota:usda:<hour>`) at 800/h, below the real ceiling. On
   exhaustion, serve from `foods` + `custom_foods` via `normalized_name ILIKE` and return
   `200` with a `degraded: true` flag rather than a 5xx — the app shows results, just fewer.
5. **Existing `respondProviderError`** already maps 429/5xx correctly; keep it.

If the app outgrows the free tier the swap is a single adapter file behind an unchanged
`NormalisedFood`, which is the whole point of the normalisation layer.

---

## 8. Licensing (not covered by the original plan)

- **USDA FDC** — public domain / CC0. No attribution obligation.
- **Open Food Facts** — data is **ODbL**; product images are typically CC-BY-SA. This
  requires attribution and imposes share-alike on any *derived database* that gets
  distributed. RoundFit uses OFF data internally and displays per-food values, so the
  practical requirement is attribution.

Action: show "Nutrition data: Open Food Facts (ODbL)" on the food detail screen for
`source === 'openfoodfacts'`, and add both sources to the legal/attributions page already
required by LAUNCH_CHECKLIST.md. Do not bulk-export OFF data into a public RoundFit dataset
without revisiting this.

---

## 9. Build order

Each step ships independently and leaves the app working.

| # | Step | Where | Status |
|---|---|---|---|
| 1 | `NormalisedFood` type + USDA adapter + unit tests | backend | ✅ **done** |
| 2 | Rewrite OFF adapter to per-100g + `NormalisedFood`; delete the orphan duplicate | backend | ✅ **done** |
| 3 | `foodRanking.ts` + tests | backend | ✅ **done** |
| 4 | Rewrite `GET /food/search`, `GET /food/:foodId`; delete Edamam; retune TTLs | backend | ✅ **done** |
| 5 | `foods` migration + `foodRepository` pin-on-log | backend | ✅ **done** (migration applied) |
| 6 | `POST /food/log-by-id` recomputes and snapshots server-side | backend | ✅ **done** |
| 7 | Context methods: `searchFoods`, `getFood`, `getRecentFoods`, `logFoodById` | app | ✅ **done** |
| 8 | Wire `search.tsx` to real search; delete mock `CATALOG` | app | ✅ **done** |
| 9 | Wire `[id].tsx` to real detail + portions; delete mock `CATALOG` | app | ✅ **done** |
| 10 | `GET /food/recent` + recents in the search empty state | both | ✅ **done** |
| 11 | Route barcode log through cache + pin; USDA branded fallback | backend | ✅ **done** |
| 12 | Delete `scan.tsx`, its route, and stale MVP_TODO/LAUNCH_CHECKLIST lines | app | ✅ **done** |
| 13 | USDA quota token bucket + degraded-mode local search | backend | ⚠️ fallback done, token bucket pending |
| 14 | Favourites (table + endpoints + UI) | both | ❌ post-launch |
| 15 | Custom-food creation UI over the existing `/food/custom` | app | ❌ post-launch |
| 16 | Rewrite `/food/parse` on OpenAI + USDA lookup | backend | ❌ post-launch |
| 17 | Recipes / saved meals | both | ❌ later |

**Launch-viable at step 10 — reached.** Steps 1–12 are complete and close LAUNCH_CHECKLIST.md
line 61.

**Remaining before this is live:** deploy the backend and set `USDA_FDC_API_KEY` (and
optionally `OFF_USER_AGENT`) in the Railway environment. Until then the app's search screen
will return empty results against the old deployed backend.

---

## 10. Tests

The repo has a ts-jest harness isolated from the Expo build (`__tests__/`, `npm test`).
Add pure-function tests — no network:

- `usda.normalise()` — Foundation, SR Legacy, and Branded fixtures; missing-nutrient and
  zero-calorie cases; `foodPortions[]` → `FoodPortion[]`.
- `openFoodFacts.normalise()` — per-serving vs per-100g fields, missing `nutriments`,
  `energy-kj`-only products.
- `foodRanking.rank()` — `"chicken"` puts generic chicken breast above branded chicken
  nuggets; `"cheerios"` puts the branded product first; brand-token detection.
- `gramsToMacros()` — 175 g of a 165 kcal/100 g food → 289 kcal.
- Recents dedupe by `food_id`, ordered by most recent `log_date`.

Note the documented UTC pitfall: recents must key off `log_date` (client local day), never
`logged_at.toISOString()`.

---

## 11. Open questions

1. **USDA Branded coverage outside the US.** FDC Branded is US-label-driven. If RoundFit has
   meaningful non-US usage, OFF should be promoted to co-primary for branded *name* search,
   not just barcode. Decide from PostHog geo before step 4.
2. **Serving defaults.** USDA Foundation foods often ship many portions ("1 cup, diced",
   "1 cup, halves"). Cap the picker at ~6 portions plus "custom grams", ordered by how close
   the gram weight is to a typical serving. Needs a judgement call on the ordering heuristic.
3. **Photo logging convergence.** `scanFoodPhoto` currently returns invented totals directly.
   Routing its identified items through this food layer (identify → search → user confirms →
   nutrition from DB) is a meaningful accuracy win, but it changes a shipped flow — a separate
   decision, not part of this plan.
