import * as SecureStore from 'expo-secure-store';

const API_BASE    = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';
const TOKEN_KEY   = 'access_token';
const REFRESH_KEY = 'refresh_token';
const TIMEOUT_MS  = 10_000;

// ── Refresh mutex ──────────────────────────────────────────────────────────
// A single in-flight promise shared across all callers.
// When concurrent requests all hit 401 at the same time, only one refresh
// runs; the rest await the same promise and use its result.

let pendingRefresh: Promise<string | null> | null = null;

async function executeRefresh(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(REFRESH_KEY).catch(() => null);
  if (!stored) return null;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: stored }),
    });
  } catch {
    return null;
  }

  if (!res.ok) {
    // Refresh token is dead — clear storage so next mount treats as signed out
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
    return null;
  }

  const { access_token, refresh_token } = await res.json().catch(() => ({} as Record<string, string>));
  if (!access_token) return null;

  await SecureStore.setItemAsync(TOKEN_KEY, access_token);
  if (typeof refresh_token === 'string') {
    await SecureStore.setItemAsync(REFRESH_KEY, refresh_token);
  }
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

  const buildHeaders = (overrideToken?: string): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
    ...((overrideToken ?? token) ? { Authorization: `Bearer ${overrideToken ?? token}` } : {}),
  });

  const doFetch = (hdrs: Record<string, string>, signal: AbortSignal) =>
    fetch(`${API_BASE}${path}`, { ...options, headers: hdrs, signal });

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await doFetch(buildHeaders(), controller.signal);

    if (res.status !== 401) {
      const body = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, body };
    }

    // ── 401: attempt token refresh ─────────────────────────────────────────
    const newToken = await getOrCreateRefresh();
    if (!newToken) {
      // Refresh failed — surface the 401 so callers can react
      return { ok: false, status: 401, body: {} };
    }

    // Retry original request with fresh token (own timeout budget)
    const retryController = new AbortController();
    const retryTimer      = setTimeout(() => retryController.abort(), TIMEOUT_MS);
    try {
      const retryRes  = await doFetch(buildHeaders(newToken), retryController.signal);
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
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {}),
  ]);
}

// ── Proactive refresh ──────────────────────────────────────────────────────
// Decode the JWT payload without a library — just base64 the middle segment.
function tokenExpiresAt(jwt: string): number | null {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Call this when the app comes to the foreground.
 * If the stored access token is missing or expires within `bufferSecs` (default 5 min),
 * it triggers a refresh before any API call goes out.
 * Returns true if the session is still valid after the check, false if it is dead.
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
