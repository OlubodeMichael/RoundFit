# Backend MVP: Data export

Single endpoint the mobile app calls: **`POST /auth/export`**.

## Auth

Same Bearer JWT middleware as `GET /auth/me`.

## Rate limit

- **1 export per user per 24 hours**
- On limit: `429` + `{ "error": "export_rate_limited" }`

Optional audit table:

```sql
create table export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'completed',
  size_bytes int,
  created_at timestamptz not null default now()
);
create index export_requests_user_created on export_requests (user_id, created_at desc);
```

## Handler

1. Resolve `userId` from JWT
2. If account deletion in progress → `409` + `{ "error": "account_deleting" }`
3. If last export &lt; 24h ago → `429`
4. Run parallel queries (no row limits) for all tables below
5. Insert `export_requests` row with `size_bytes`
6. Return `200` + JSON body

## Tables to query (`user_id = $userId`)

| Key | Table |
|-----|--------|
| `user.profile` | `profiles` (+ email from `auth.users`) |
| `food_logs` | `food_logs` |
| `workouts` | `workouts` with nested `workout_sets` |
| `health_data` | `health_data` |
| `recovery_logs` | `recovery_logs` |
| `readiness_scores` | `readiness_scores` |
| `daily_summaries` | `daily_summaries` |
| `weight_entries` | `weight_entries` |
| `check_ins` | `check_ins` |
| `insights` | `insights` |
| `cycle.history` | `cycle_logs` |
| `engine.patterns` | `detected_patterns` (if table exists) |

**Do not export:** passwords, refresh tokens, other users’ rows, internal admin fields.

## Response `200`

```json
{
  "data": {
    "export_version": "1.0",
    "generated_at": "2026-05-18T12:00:00.000Z",
    "app": "RoundFit",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "profile": {}
    },
    "food_logs": [],
    "workouts": [],
    "health_data": [],
    "recovery_logs": [],
    "readiness_scores": [],
    "daily_summaries": [],
    "weight_entries": [],
    "check_ins": [],
    "insights": [],
    "cycle": { "default_cycle_length": 28, "history": [] },
    "engine": { "patterns": [] },
    "metadata": {
      "date_range": { "earliest": null, "latest": null },
      "row_counts": { "food_logs": 0, "workouts": 0 }
    }
  }
}
```

`metadata.row_counts` should list every array key. `date_range` = min/max `date` across dated tables.

## Errors

| Status | `error` | When |
|--------|---------|------|
| 401 | — | Missing/invalid token |
| 409 | `account_deleting` | Delete in progress |
| 429 | `export_rate_limited` | Too soon since last export |
| 500 | `export_failed` | Unexpected failure |

## Reference implementation sketch (Node)

```ts
export async function postAuthExport(req, res) {
  const userId = req.user.id;
  await assertNotDeleting(userId);
  await assertExportRateLimit(userId);

  const payload = await buildUserExport(userId);
  const json = JSON.stringify(payload);
  await recordExport(userId, json.length);

  return res.status(200).json({ data: payload });
}
```

Use service role / server client for queries (not user-scoped anon key).
