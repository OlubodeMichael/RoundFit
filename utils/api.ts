import * as SecureStore from 'expo-secure-store';

const API_BASE    = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';
const TOKEN_KEY   = 'access_token';
const REFRESH_KEY = 'refresh_token';
const SUB_KEY     = 'token_sub';       // plain-string owner of the stored session
const TIMEOUT_MS  = 10_000;

// ── JWT helpers ────────────────────────────────────────────────────────────
// Decode a JWT payload without an external library.
// Handles base64url encoding (uses - and _ instead of + and /) and missing
// padding — both common failure points in React Native's Hermes runtime.
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    // base64url strips padding — add it back so atob doesn't throw
    while (b64.length % 4 !== 0) b64 += '=';
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

function tokenExpiresAt(jwt: string): number | null {
  const payload = decodeJwtPayload(jwt);
  return typeof payload?.exp === 'number' ? payload.exp : null;
}

function tokenSub(jwt: string): string | null {
  const payload = decodeJwtPayload(jwt);
  return typeof payload?.sub === 'string' ? payload.sub : null;
}

// ── Refresh mutex ──────────────────────────────────────────────────────────
// A single in-flight promise shared across all callers.
// When concurrent requests all hit 401 at the same time, only one refresh
// runs; the rest await the same promise and use its result.

let pendingRefresh: Promise<string | null> | null = null;

async function executeRefresh(): Promise<string | null> {
  const [storedRefresh, storedSub] = await Promise.all([
    SecureStore.getItemAsync(REFRESH_KEY).catch(() => null),
    SecureStore.getItemAsync(SUB_KEY).catch(() => null),
  ]);
  if (!storedRefresh) return null;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: storedRefresh }),
    });
  } catch {
    return null;
  }

  if (!res.ok) {
    await clearTokens();
    return null;
  }

  const json = await res.json().catch(() => ({} as Record<string, string>));
  const { access_token, refresh_token } = json;
  if (!access_token) {
    console.error('[api] refresh response missing access_token:', Object.keys(json));
    return null;
  }

  // Guard: compare the refreshed token's owner against the sub we stored at
  // login time (a plain string — no JWT decoding of the old token needed).
  // If they differ the stored tokens are from two different accounts; clear
  // everything and force a fresh sign-in.
  const newSub = tokenSub(access_token);
  if (storedSub && newSub && storedSub !== newSub) {
    console.error(`[api] refresh mismatch: stored sub=${storedSub} refreshed sub=${newSub} — clearing tokens`);
    await clearTokens();
    return null;
  }

  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, access_token),
    typeof refresh_token === 'string'
      ? SecureStore.setItemAsync(REFRESH_KEY, refresh_token)
      : Promise.resolve(),
    newSub
      ? SecureStore.setItemAsync(SUB_KEY, newSub)
      : Promise.resolve(),
  ]);
  console.log('[api] refresh succeeded, new token stored');
  return access_token;
}

function getOrCreateRefresh(): Promise<string | null> {
  if (!pendingRefresh) {
    pendingRefresh = executeRefresh().finally(() => { pendingRefresh = null; });
  }
  return pendingRefresh;
}

// ── Shared fetch ───────────────────────────────────────────────────────────

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);

  const makeHeaders = (t: string | null): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  });

  const doFetch = (hdrs: Record<string, string>, signal: AbortSignal) =>
    fetch(`${API_BASE}${path}`, { ...options, headers: hdrs, signal });

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await doFetch(makeHeaders(token), controller.signal);

    if (res.status !== 401) {
      const body = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, body };
    }

    // ── 401: attempt token refresh ─────────────────────────────────────────
    const newToken = await getOrCreateRefresh();
    if (!newToken) {
      console.warn('[api] refresh returned null for', path);
      return { ok: false, status: 401, body: {} };
    }

    // Use the token directly from refresh — don't re-read SecureStore
    const retryController = new AbortController();
    const retryTimer      = setTimeout(() => retryController.abort(), TIMEOUT_MS);
    try {
      const retryRes  = await doFetch(makeHeaders(newToken), retryController.signal);
      const retryBody = await retryRes.json().catch(() => ({}));
      return { ok: retryRes.ok, status: retryRes.status, body: retryBody };
    } finally {
      clearTimeout(retryTimer);
    }
  } finally {
    clearTimeout(timer);
  }
}

// ── Token helpers (used by AuthProvider) ──────────────────────────────────

export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
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
export async function proactiveRefreshIfNeeded(bufferSecs = 300): Promise<boolean> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);

  const needsRefresh = !token || (() => {
    const exp = tokenExpiresAt(token);
    return exp === null || Date.now() / 1000 >= exp - bufferSecs;
  })();

  if (!needsRefresh) return true;

  const newToken = await getOrCreateRefresh();
  return newToken !== null;
}
