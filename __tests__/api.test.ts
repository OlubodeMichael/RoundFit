// In-memory SecureStore + stubbed Constants so utils/api.ts runs under node.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn((k: string) => Promise.resolve(store.has(k) ? store.get(k)! : null)),
    setItemAsync: jest.fn((k: string, v: string) => { store.set(k, v); return Promise.resolve(); }),
    deleteItemAsync: jest.fn((k: string) => { store.delete(k); return Promise.resolve(); }),
    AFTER_FIRST_UNLOCK: 'afterFirstUnlock',
    __store: store,
  };
});

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiUrl: 'http://test/api', apiKey: 'test-key' } } },
}));

import * as SecureStore from 'expo-secure-store';
import {
  apiFetch,
  clearTokens,
  hasStoredAccessToken,
  isStoredTokenOAuth,
  proactiveRefreshStateIfNeeded,
  publicApiFetch,
  storeTokens,
} from '@/utils/api';

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

const TOKEN_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';
const SUB_KEY = 'token_sub';

function base64url(s: string): string {
  return Buffer.from(s)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Build a decodable (unsigned) JWT with the given payload. */
function makeJwt(payload: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  return `${header}.${base64url(JSON.stringify(payload))}.sig`;
}

const FAR_FUTURE = Math.floor(Date.now() / 1000) + 3600;
const PAST = Math.floor(Date.now() / 1000) - 10;

/** Minimal Response-like object matching what api.ts reads (ok/status/json). */
function jsonRes(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

let fetchMock: jest.Mock;
beforeEach(() => {
  store.clear();
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('token helpers', () => {
  it('storeTokens persists access + refresh + decoded sub', async () => {
    await storeTokens(makeJwt({ sub: 'user-1', exp: FAR_FUTURE }), 'refresh-1');
    expect(await hasStoredAccessToken()).toBe(true);
    expect(store.get(REFRESH_KEY)).toBe('refresh-1');
    expect(store.get(SUB_KEY)).toBe('user-1');
  });

  it('clearTokens removes everything', async () => {
    await storeTokens(makeJwt({ sub: 'user-1' }), 'refresh-1');
    await clearTokens();
    expect(store.size).toBe(0);
    expect(await hasStoredAccessToken()).toBe(false);
  });

  it('isStoredTokenOAuth reflects the JWT provider', async () => {
    await SecureStore.setItemAsync(TOKEN_KEY, makeJwt({ app_metadata: { provider: 'google' } }));
    expect(await isStoredTokenOAuth()).toBe(true);

    await SecureStore.setItemAsync(TOKEN_KEY, makeJwt({ app_metadata: { provider: 'email' } }));
    expect(await isStoredTokenOAuth()).toBe(false);

    store.clear();
    expect(await isStoredTokenOAuth()).toBe(false);
  });
});

describe('publicApiFetch', () => {
  it('sends the API key but never an Authorization header', async () => {
    await SecureStore.setItemAsync(TOKEN_KEY, makeJwt({ sub: 'u' }));
    fetchMock.mockResolvedValueOnce(jsonRes(200, { ok: true }));

    await publicApiFetch('/auth/forgot-password', { method: 'POST' });

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['X-API-Key']).toBe('test-key');
    expect(headers.Authorization).toBeUndefined();
  });
});

describe('apiFetch — happy path', () => {
  it('attaches Bearer + API key and returns the parsed body', async () => {
    await SecureStore.setItemAsync(TOKEN_KEY, makeJwt({ sub: 'u', exp: FAR_FUTURE }));
    fetchMock.mockResolvedValueOnce(jsonRes(200, { hello: 'world' }));

    const res = await apiFetch('/me');

    expect(res).toEqual({ ok: true, status: 200, body: { hello: 'world' } });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('http://test/api/me');
    const headers = opts.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${store.get(TOKEN_KEY)}`);
    expect(headers['X-API-Key']).toBe('test-key');
  });
});

describe('apiFetch — 401 refresh handling', () => {
  it('refreshes on 401, retries the original request, and persists rotated tokens', async () => {
    await SecureStore.setItemAsync(TOKEN_KEY, makeJwt({ sub: 'user-1', exp: PAST }));
    await SecureStore.setItemAsync(REFRESH_KEY, 'refresh-1');
    await SecureStore.setItemAsync(SUB_KEY, 'user-1');

    const rotated = makeJwt({ sub: 'user-1', exp: FAR_FUTURE });
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(jsonRes(200, { access_token: rotated, refresh_token: 'refresh-2' }));
      }
      // First data call 401, retry 200.
      return Promise.resolve(
        fetchMock.mock.calls.filter((c) => !String(c[0]).endsWith('/auth/refresh')).length === 1
          ? jsonRes(401, {})
          : jsonRes(200, { data: 'ok' }),
      );
    });

    const res = await apiFetch('/me');

    expect(res).toEqual({ ok: true, status: 200, body: { data: 'ok' } });
    expect(store.get(TOKEN_KEY)).toBe(rotated);
    expect(store.get(REFRESH_KEY)).toBe('refresh-2');
  });

  it('clears tokens and returns 401 when the refresh token is definitively invalid', async () => {
    await SecureStore.setItemAsync(TOKEN_KEY, makeJwt({ sub: 'user-1', exp: PAST }));
    await SecureStore.setItemAsync(REFRESH_KEY, 'dead-refresh');
    await SecureStore.setItemAsync(SUB_KEY, 'user-1');

    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/auth/refresh')
          ? jsonRes(400, { error: 'invalid_grant' })
          : jsonRes(401, {}),
      ),
    );

    const res = await apiFetch('/me');
    expect(res.status).toBe(401);
    expect(store.size).toBe(0); // tokens cleared
  });

  it('keeps tokens on a transient refresh failure (5xx) and signals TRANSIENT', async () => {
    await SecureStore.setItemAsync(TOKEN_KEY, makeJwt({ sub: 'user-1', exp: PAST }));
    await SecureStore.setItemAsync(REFRESH_KEY, 'refresh-1');
    await SecureStore.setItemAsync(SUB_KEY, 'user-1');

    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.endsWith('/auth/refresh') ? jsonRes(500, {}) : jsonRes(401, {})),
    );

    const res = await apiFetch('/me');
    expect(res).toEqual({ ok: false, status: 401, body: { error: 'TRANSIENT_REFRESH_FAILURE' } });
    expect(store.get(REFRESH_KEY)).toBe('refresh-1'); // NOT cleared
  }, 10000);

  it('clears tokens when the refreshed token belongs to a different user (sub mismatch)', async () => {
    await SecureStore.setItemAsync(TOKEN_KEY, makeJwt({ sub: 'user-1', exp: PAST }));
    await SecureStore.setItemAsync(REFRESH_KEY, 'refresh-1');
    await SecureStore.setItemAsync(SUB_KEY, 'user-1');

    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/auth/refresh')
          ? jsonRes(200, { access_token: makeJwt({ sub: 'user-2', exp: FAR_FUTURE }), refresh_token: 'r2' })
          : jsonRes(401, {}),
      ),
    );

    const res = await apiFetch('/me');
    expect(res.status).toBe(401);
    expect(store.size).toBe(0);
  });

  it('dedupes concurrent 401s into a single refresh call (mutex)', async () => {
    await SecureStore.setItemAsync(TOKEN_KEY, makeJwt({ sub: 'user-1', exp: PAST }));
    await SecureStore.setItemAsync(REFRESH_KEY, 'refresh-1');
    await SecureStore.setItemAsync(SUB_KEY, 'user-1');

    const rotated = makeJwt({ sub: 'user-1', exp: FAR_FUTURE });
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(jsonRes(200, { access_token: rotated, refresh_token: 'refresh-2' }));
      }
      // Every data call before refresh completes is 401; retries succeed.
      return Promise.resolve(store.get(TOKEN_KEY) === rotated ? jsonRes(200, { ok: true }) : jsonRes(401, {}));
    });

    const [a, b] = await Promise.all([apiFetch('/a'), apiFetch('/b')]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    const refreshCalls = fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });
});

describe('proactiveRefreshStateIfNeeded', () => {
  it('returns valid without a network call when the token is comfortably fresh', async () => {
    await SecureStore.setItemAsync(TOKEN_KEY, makeJwt({ sub: 'u', exp: FAR_FUTURE }));
    expect(await proactiveRefreshStateIfNeeded()).toBe('valid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes a near-expiry token and returns valid on success', async () => {
    await SecureStore.setItemAsync(TOKEN_KEY, makeJwt({ sub: 'user-1', exp: PAST }));
    await SecureStore.setItemAsync(REFRESH_KEY, 'refresh-1');
    await SecureStore.setItemAsync(SUB_KEY, 'user-1');
    fetchMock.mockResolvedValueOnce(
      jsonRes(200, { access_token: makeJwt({ sub: 'user-1', exp: FAR_FUTURE }), refresh_token: 'r2' }),
    );

    expect(await proactiveRefreshStateIfNeeded()).toBe('valid');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns invalid when there is no refresh token to use', async () => {
    await SecureStore.setItemAsync(TOKEN_KEY, makeJwt({ sub: 'u', exp: PAST }));
    expect(await proactiveRefreshStateIfNeeded()).toBe('invalid');
  });
});

// ── Locked-keychain behaviour ──────────────────────────────────────────────
// iOS wakes the app in the background (HealthKit sleep delivery) while the
// device is locked. Reads then throw, and treating that as "no session" is what
// logged users out overnight.
describe('locked keychain', () => {
  const getItem = SecureStore.getItemAsync as jest.Mock;

  function lockKeychain() {
    getItem.mockImplementation(() => Promise.reject(new Error('User interaction is not allowed.')));
  }

  afterEach(() => {
    getItem.mockImplementation((k: string) =>
      Promise.resolve(store.has(k) ? store.get(k)! : null),
    );
  });

  it('reports transient — never invalid — so the session is not dropped', async () => {
    await storeTokens(makeJwt({ sub: 'user-1', exp: PAST }), 'refresh-1');
    lockKeychain();

    const state = await proactiveRefreshStateIfNeeded(0);

    expect(state).toBe('transient');
    expect(state).not.toBe('invalid');
  });

  it('does not claim the access token is absent', async () => {
    await storeTokens(makeJwt({ sub: 'user-1', exp: FAR_FUTURE }), 'refresh-1');
    lockKeychain();

    // "Cannot read" must not be reported as "not there" — callers log out on false.
    await expect(hasStoredAccessToken()).resolves.toBe(true);
  });

  it('still reports a genuinely absent refresh token as invalid', async () => {
    await clearTokens();

    await expect(proactiveRefreshStateIfNeeded(0)).resolves.toBe('invalid');
  });
});

describe('keychain accessibility', () => {
  it('stores tokens as AFTER_FIRST_UNLOCK so background wakes can read them', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockClear();
    await storeTokens(makeJwt({ sub: 'user-1' }), 'refresh-1');

    const calls = (SecureStore.setItemAsync as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call[2]).toEqual({ keychainAccessible: 'afterFirstUnlock' });
    }
  });
});
