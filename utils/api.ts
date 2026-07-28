import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const extra = Constants.expoConfig?.extra ?? {};
const API_BASE =
  (extra.apiUrl as string | undefined) ?? "http://localhost:8000/api";
const API_KEY = (extra.apiKey as string | undefined) ?? "";
const TOKEN_KEY = "access_token";
const REFRESH_KEY = "refresh_token";
const SUB_KEY = "token_sub"; // plain-string owner of the stored session
const TIMEOUT_MS = 10_000;

if (!extra.apiUrl) {
  // Same failure mode as a missing API_KEY but previously silent: every
  // request would target the plain-HTTP localhost fallback and fail in a
  // production build. Surface it loudly at startup.
  console.warn(
    "[api] API_URL (Constants.expoConfig.extra.apiUrl) is empty — falling back " +
      `to ${API_BASE}; all API requests will fail in production builds.`,
  );
}

if (!API_KEY) {
  // A build shipped without the API key will have every request — including
  // /auth/refresh — rejected by the backend's requireApiKey middleware, which
  // looks exactly like a mass random logout. Surface it loudly at startup.
  console.warn(
    "[api] API_KEY (Constants.expoConfig.extra.apiKey) is empty — requests that " +
      "require the API key (including /auth/refresh) may be rejected and log users out.",
  );
}

// ── JWT helpers ────────────────────────────────────────────────────────────
// Decode a JWT payload without an external library.
// Handles base64url encoding (uses - and _ instead of + and /) and missing
// padding — both common failure points in React Native's Hermes runtime.
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    // base64url strips padding — add it back so atob doesn't throw
    while (b64.length % 4 !== 0) b64 += "=";
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

function tokenExpiresAt(jwt: string): number | null {
  const payload = decodeJwtPayload(jwt);
  return typeof payload?.exp === "number" ? payload.exp : null;
}

function tokenSub(jwt: string): string | null {
  const payload = decodeJwtPayload(jwt);
  return typeof payload?.sub === "string" ? payload.sub : null;
}

// ── Refresh mutex ──────────────────────────────────────────────────────────
// A single in-flight promise shared across all callers.
// When concurrent requests all hit 401 at the same time, only one refresh
// runs; the rest await the same promise and use its result.

let pendingRefresh: Promise<string | null> | null = null;
type RefreshFailureReason = "invalid" | "transient";
type RefreshOutcome = {
  token: string | null;
  reason: RefreshFailureReason | null;
};
let lastRefreshFailureReason: RefreshFailureReason | null = null;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// executeRefresh re-attempts on transient failures (network, timeout, 5xx, or
// non-definitive 4xx). An immediate retry also covers the refresh-token
// rotation grace window: if a prior refresh rotated the token but its response
// was lost, Supabase's reuse interval can still return the already-rotated
// token on a quick retry instead of forcing a logout.
const REFRESH_MAX_ATTEMPTS = 2;
const REFRESH_RETRY_DELAY_MS = 600;

/**
 * True when a failed /auth/refresh response explicitly signals that the refresh
 * token itself is dead (revoked, expired, not found, invalid_grant). We only
 * hard-logout on a definitive signal — gateways/WAFs/rate-limiters return
 * 400/403 for non-auth reasons and must NOT clear the session.
 */
function isInvalidRefreshBody(body: Record<string, unknown>): boolean {
  const raw =
    (typeof body.error === "string" && body.error) ||
    (typeof body.code === "string" && body.code) ||
    (typeof body.message === "string" && body.message) ||
    "";
  const s = raw.toLowerCase();
  if (
    s.includes("invalid_refresh_token") ||
    s.includes("refresh_token_not_found") ||
    s.includes("invalid_grant") ||
    s.includes("invalid refresh")
  ) {
    return true;
  }
  return (
    s.includes("refresh token") &&
    (s.includes("expired") || s.includes("revoked") || s.includes("not found"))
  );
}

async function executeRefresh(): Promise<string | null> {
  const [storedRefresh, storedSub] = await Promise.all([
    SecureStore.getItemAsync(REFRESH_KEY).catch(() => null),
    SecureStore.getItemAsync(SUB_KEY).catch(() => null),
  ]);
  if (!storedRefresh) {
    lastRefreshFailureReason = "invalid";
    return null;
  }

  for (let attempt = 0; attempt < REFRESH_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(REFRESH_RETRY_DELAY_MS);

    // Bound the refresh request with a timeout — without it a hung request
    // would stall the shared mutex (and every caller awaiting it) forever.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
        },
        body: JSON.stringify({ refresh_token: storedRefresh }),
        signal: controller.signal,
      });
    } catch {
      // Network error / timeout — transient. Retry; never clear tokens.
      lastRefreshFailureReason = "transient";
      continue;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const errBody = await res
        .json()
        .catch(() => ({}) as Record<string, unknown>);
      // Only a 401 or an explicit invalid-refresh marker is a definitive
      // "this session is dead" signal. Everything else (400/403 from a
      // gateway/WAF/rate-limiter, 5xx) is transient — retry, keep tokens.
      if (res.status === 401 || isInvalidRefreshBody(errBody)) {
        await clearTokens();
        lastRefreshFailureReason = "invalid";
        return null;
      }
      lastRefreshFailureReason = "transient";
      continue;
    }

    const json = await res.json().catch(() => ({}) as Record<string, string>);
    const { access_token, refresh_token } = json;
    if (!access_token) {
      console.error(
        "[api] refresh response missing access_token:",
        Object.keys(json),
      );
      lastRefreshFailureReason = "transient";
      continue;
    }

    // Guard: compare the refreshed token's owner against the sub we stored at
    // login time (a plain string — no JWT decoding of the old token needed).
    // If they differ the stored tokens are from two different accounts; clear
    // everything and force a fresh sign-in.
    const newSub = tokenSub(access_token);
    if (storedSub && newSub && storedSub !== newSub) {
      console.error(
        `[api] refresh mismatch: stored sub=${storedSub} refreshed sub=${newSub} — clearing tokens`,
      );
      await clearTokens();
      lastRefreshFailureReason = "invalid";
      return null;
    }

    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, access_token),
      typeof refresh_token === "string"
        ? SecureStore.setItemAsync(REFRESH_KEY, refresh_token)
        : Promise.resolve(),
      newSub ? SecureStore.setItemAsync(SUB_KEY, newSub) : Promise.resolve(),
    ]);
    console.log("[api] refresh succeeded, new token stored");
    lastRefreshFailureReason = null;
    return access_token;
  }

  // Exhausted all attempts on transient failures — keep tokens, report transient.
  return null;
}

async function getOrCreateRefresh(): Promise<RefreshOutcome> {
  if (!pendingRefresh) {
    pendingRefresh = executeRefresh().finally(() => {
      pendingRefresh = null;
    });
  }
  const token = await pendingRefresh;
  if (token) return { token, reason: null };
  return { token: null, reason: lastRefreshFailureReason ?? "transient" };
}

// ── Shared fetch ───────────────────────────────────────────────────────────

type ApiFetchOptions = RequestInit & {
  includeAuthToken?: boolean;
};

export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const { includeAuthToken = true, ...requestOptions } = options;
  const token = includeAuthToken
    ? await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null)
    : null;

  const makeHeaders = (t: string | null): Record<string, string> => ({
    "Content-Type": "application/json",
    ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
    ...(requestOptions.headers as Record<string, string>),
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  });

  const doFetch = (hdrs: Record<string, string>, signal: AbortSignal) =>
    fetch(`${API_BASE}${path}`, { ...requestOptions, headers: hdrs, signal });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await doFetch(makeHeaders(token), controller.signal);

    if (res.status !== 401) {
      const body = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, body };
    }

    const unauthorizedBody = await res.json().catch(() => ({}));

    // Login/register/etc. intentionally skip auth. A 401 here is the real
    // API error (bad credentials, bad API key) — do not swallow the body or
    // attempt a refresh.
    if (!includeAuthToken) {
      return { ok: false, status: 401, body: unauthorizedBody };
    }

    // ── 401: attempt token refresh ─────────────────────────────────────────
    const refresh = await getOrCreateRefresh();
    if (!refresh.token) {
      console.warn("[api] refresh returned null for", path);
      const body =
        refresh.reason === "transient"
          ? { error: "TRANSIENT_REFRESH_FAILURE" }
          : unauthorizedBody;
      return { ok: false, status: 401, body };
    }

    // Use the token directly from refresh — don't re-read SecureStore
    const retryController = new AbortController();
    const retryTimer = setTimeout(() => retryController.abort(), TIMEOUT_MS);
    try {
      const retryRes = await doFetch(
        makeHeaders(refresh.token),
        retryController.signal,
      );
      const retryBody = await retryRes.json().catch(() => ({}));
      return { ok: retryRes.ok, status: retryRes.status, body: retryBody };
    } finally {
      clearTimeout(retryTimer);
    }
  } finally {
    clearTimeout(timer);
  }
}

// ── Public (no-token) fetch ─────────────────────────────────────────────
// For endpoints that must NOT carry the Bearer token but still need the
// X-API-Key header (forgot-password / reset-password): the user has no
// session yet, but the backend's requireApiKey middleware rejects requests
// without the key.
export async function publicApiFetch(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
    ...(options.headers as Record<string, string>),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

// ── Token helpers (used by AuthProvider) ──────────────────────────────────

/** Returns true if an access token is currently stored in SecureStore. */
export async function hasStoredAccessToken(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  return Boolean(token);
}

/**
 * Reads the stored access token. Used by signOut to capture the token BEFORE
 * clearTokens() runs — a fire-and-forget apiFetch would read SecureStore after
 * the delete and send /auth/logout unauthenticated, leaving the refresh token
 * alive server-side.
 */
export async function getStoredAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
}

/**
 * Returns true if the stored access token belongs to an OAuth provider
 * (Google, Apple, etc.) rather than email/password.
 * Reads app_metadata.provider from the JWT payload — Supabase always sets this.
 */
export async function isStoredTokenOAuth(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  const meta = payload?.app_metadata as Record<string, unknown> | undefined;
  const provider = typeof meta?.provider === "string" ? meta.provider : "";
  if (provider && provider !== "email") return true;
  const providers = meta?.providers;
  if (Array.isArray(providers)) {
    return providers.some((p) => typeof p === "string" && p !== "email");
  }
  return false;
}

export async function storeTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const sub = tokenSub(accessToken);
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, refreshToken),
    sub
      ? SecureStore.setItemAsync(SUB_KEY, sub)
      : SecureStore.deleteItemAsync(SUB_KEY).catch(() => {}),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(SUB_KEY).catch(() => {}),
  ]);
}

// ── Proactive refresh ──────────────────────────────────────────────────────

/**
 * Call this when the app comes to the foreground (or on mount).
 * If the stored access token is missing or expires within `bufferSecs`
 * (default 5 min), it triggers a refresh before any API call goes out.
 * Returns true if the session is still valid, false if it is dead.
 */
export async function proactiveRefreshIfNeeded(
  bufferSecs = 300,
): Promise<boolean> {
  const state = await proactiveRefreshStateIfNeeded(bufferSecs);
  return state === "valid";
}

export async function proactiveRefreshStateIfNeeded(
  bufferSecs = 300,
): Promise<"valid" | "invalid" | "transient"> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);

  const needsRefresh =
    !token ||
    (() => {
      const exp = tokenExpiresAt(token);
      return exp === null || Date.now() / 1000 >= exp - bufferSecs;
    })();

  if (!needsRefresh) return "valid";

  const refresh = await getOrCreateRefresh();
  if (refresh.token) return "valid";
  return refresh.reason === "invalid" ? "invalid" : "transient";
}
