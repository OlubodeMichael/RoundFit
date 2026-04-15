import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE   = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';
const TIMEOUT_MS = 10_000;
/** How long sign-in / sign-up error banners stay visible before auto-clearing. */
const AUTH_ERROR_DISPLAY_MS = 4_000;

// ── Types ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  id:            string;
  email:         string;
  name:          string;
  age:           number;
  sex:           'male' | 'female';
  heightCm:      number;
  weightKg:      number;
  /**
   * How active the user is on a weekly basis.
   * Drives the activity multiplier used in TDEE calculation.
   */
  activityLevel: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
  /**
   * The user's primary fitness goal.
   * `maintain` is the neutral baseline; all others shift the calorie budget.
   */
  goal:          'lose_weight' | 'build_muscle' | 'boost_energy' | 'maintain';
  unit:          'metric' | 'imperial';
  avatarUrl?:    string | null;
  tdee?:         number;
  calorieBudget?: number;
  createdAt:     string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthError =
  | 'EMAIL_IN_USE'
  | 'INVALID_CREDENTIALS'
  | 'WEAK_PASSWORD'
  | 'INVALID_EMAIL'
  | 'UNKNOWN';

interface AuthContextValue {
  user:      UserProfile | null;
  status:    AuthStatus;
  isAuth:    boolean;
  /** True while signIn / signUp / updateProfile is in-flight. */
  isLoading: boolean;
  error:     AuthError | null;

  /** Registers a new account and signs in. */
  signUp: (
    email:    string,
    password: string,
    profile:  Omit<UserProfile, 'id' | 'email' | 'createdAt' | 'tdee' | 'calorieBudget'>,
  ) => Promise<void>;

  /** Signs in with email + password. */
  signIn: (email: string, password: string) => Promise<void>;

  /** Signs out server-side (clears cookie) and resets local state. */
  signOut: () => Promise<void>;

  /** Sends a partial profile update to the server. TDEE recalculates automatically. */
  updateProfile: (patch: Partial<Omit<UserProfile, 'id' | 'email' | 'createdAt'>>) => Promise<void>;

  /** Clears the last error. */
  clearError: () => void;
}

// ── API helpers ────────────────────────────────────────────────────────────

/** Maps API values (including legacy `km` / `miles`) to `metric` | `imperial`. */
export function normaliseProfileUnit(raw: string | undefined | null): UserProfile['unit'] {
  const s = (raw ?? 'metric').trim().toLowerCase();
  if (s === 'imperial' || s === 'miles') return 'imperial';
  return 'metric';
}

/** Normalises a raw goal string to the canonical API value. */
export function normaliseGoal(g: string): UserProfile['goal'] {
  if (g === 'lose_weight'  || g === 'lose')     return 'lose_weight';
  if (g === 'build_muscle' || g === 'gain')     return 'build_muscle';
  if (g === 'boost_energy')                     return 'boost_energy';
  return 'maintain';
}

/** Normalises a raw activity string to the canonical API value. */
function normaliseActivity(a: string): UserProfile['activityLevel'] {
  if (a === 'sedentary')                                   return 'sedentary';
  if (a === 'moderately_active' || a === 'moderate')       return 'moderately_active';
  if (a === 'very_active')                                 return 'very_active';
  return 'lightly_active';
}

/** Converts camelCase UserProfile fields to the API's snake_case shape. */
function toApiBody(profile: Partial<Omit<UserProfile, 'id' | 'email' | 'createdAt'>>) {
  const out: Record<string, unknown> = {};
  if (profile.name          !== undefined) out.name           = profile.name;
  if (profile.age           !== undefined) out.age            = profile.age;
  if (profile.sex           !== undefined) out.sex            = profile.sex;
  if (profile.heightCm      !== undefined) out.height_cm      = profile.heightCm;
  if (profile.weightKg      !== undefined) out.weight_kg      = profile.weightKg;
  if (profile.activityLevel !== undefined) out.activity_level = normaliseActivity(profile.activityLevel);
  if (profile.goal          !== undefined) out.goal           = normaliseGoal(profile.goal);
  if (profile.unit !== undefined) out.unit = profile.unit;
  return out;
}

/** Normalises a raw API profile row into our camelCase UserProfile. */
function fromApiProfile(row: Record<string, unknown>): UserProfile {
  const str = (v: unknown, fb = '') => (typeof v === 'string' ? v : fb);
  const num = (v: unknown, fb = 0)  => (typeof v === 'number' ? v : fb);
  return {
    id:            str(row.id   ?? row.user_id),
    email:         str(row.email),
    name:          str(row.name),
    age:           num(row.age),
    sex:           str(row.sex, 'male')                 as UserProfile['sex'],
    heightCm:      num(row.height_cm),
    weightKg:      num(row.weight_kg),
    activityLevel: str(row.activity_level, 'sedentary') as UserProfile['activityLevel'],
    goal:          str(row.goal, 'maintain')            as UserProfile['goal'],
    unit:          normaliseProfileUnit(str(row.unit ?? row.distance_unit, 'metric')),
    // Server has a typo: 'avater_url' — handle both spellings
    avatarUrl:     (typeof (row.avatar_url ?? row.avater_url) === 'string'
                     ? (row.avatar_url ?? row.avater_url) as string
                     : null),
    tdee:          typeof row.tdee           === 'number' ? row.tdee           : undefined,
    calorieBudget: typeof row.calorie_budget === 'number' ? row.calorie_budget : undefined,
    createdAt:     str(row.created_at, new Date().toISOString()),
  };
}

/** Maps HTTP status / response body to a typed AuthError code. */
function parseApiError(status: number, body: Record<string, unknown>): AuthError {
  const raw = typeof body.message === 'string' ? body.message
            : typeof body.error   === 'string' ? body.error
            : '';
  const msg = raw.toLowerCase();

  if (status === 409 || msg.includes('already') || msg.includes('in use')) return 'EMAIL_IN_USE';
  if (status === 401 || msg.includes('invalid') || msg.includes('credentials')) return 'INVALID_CREDENTIALS';
  if (msg.includes('weak') || msg.includes('password')) return 'WEAK_PASSWORD';
  if (msg.includes('email')) return 'INVALID_EMAIL';
  return 'UNKNOWN';
}

/**
 * Thin fetch wrapper.
 * - Sends cookies automatically via `credentials: 'include'`
 * - Enforces a 10 s timeout
 * - Transparently retries once on 401 via POST /auth/refresh (cookie-based)
 */
async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const run = (signal: AbortSignal) =>
    fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include', signal });

  try {
    const res = await run(controller.signal);

    // Cookie-based refresh: if 401, ask the server to rotate the cookie then retry
    if (res.status === 401) {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method:      'POST',
        credentials: 'include',
        signal:      controller.signal,
      });
      if (refreshRes.ok) {
        const retryRes  = await run(controller.signal);
        const retryBody = await retryRes.json().catch(() => ({}));
        return { ok: retryRes.ok, status: retryRes.status, body: retryBody };
      }
    }

    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches and normalises the current user from GET /auth/me.
 * Throws if the request fails — callers handle the error.
 */
async function fetchMe(emailFallback = ''): Promise<UserProfile> {
  const { ok, body } = await apiFetch('/auth/me');
  if (!ok) throw new Error('fetch_me_failed');

  // Response shape: { data: { user, profile } }
  const data       = (body.data ?? body) as Record<string, unknown>;
  const profileRow = (data.profile ?? data) as Record<string, unknown>;
  const authUser   = data.user as Record<string, unknown> | undefined;
  const userMeta   = authUser?.user_metadata as Record<string, unknown> | undefined;

  // Name lives in the profile row; fallback to Supabase user_metadata
  const name =
    (typeof profileRow.name     === 'string' && profileRow.name)    ||
    (typeof userMeta?.name      === 'string' && userMeta.name)      ||
    (typeof userMeta?.full_name === 'string' && userMeta.full_name) ||
    '';

  return fromApiProfile({
    ...profileRow,
    name,
    email: (authUser?.email ?? profileRow.email ?? emailFallback) as string,
    id:    (authUser?.id    ?? profileRow.id    ?? profileRow.user_id) as string,
  });
}

// ── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,      setUser]      = useState<UserProfile | null>(null);
  const [status,    setStatus]    = useState<AuthStatus>('loading');
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<AuthError | null>(null);

  // Stable ref so updateProfile's rollback always sees the latest snapshot.
  const userRef = useRef<UserProfile | null>(null);
  userRef.current = user;

  const isAuth = status === 'authenticated';

  // ── Restore session on mount ─────────────────────────────────────────────
  // Cookie present and valid → 200 → authenticated
  // Cookie missing or expired → 401 → unauthenticated
  useEffect(() => {
    (async () => {
      try {
        setUser(await fetchMe());
        setStatus('authenticated');
      } catch {
        setStatus('unauthenticated');
      }
    })();
  }, []);

  useEffect(() => {
    if (error === null) return;
    const id = setTimeout(() => setError(null), AUTH_ERROR_DISPLAY_MS);
    return () => clearTimeout(id);
  }, [error]);

  // ── Sign up ──────────────────────────────────────────────────────────────
  const signUp = useCallback(async (
    email:    string,
    password: string,
    profile:  Omit<UserProfile, 'id' | 'email' | 'createdAt' | 'tdee' | 'calorieBudget'>,
  ) => {
    setError(null);
    setIsLoading(true);

    try {
      const { ok, status: s, body } = await apiFetch('/auth/register', {
        method: 'POST',
        body:   JSON.stringify({ email, password, ...toApiBody(profile) }),
      });

      if (!ok) { setError(parseApiError(s, body)); return; }

      // Server sets the session cookie — fetch profile to populate state
      try {
        setUser(await fetchMe(email));
      } catch {
        // Cookie is set; profile fetch failed — session restore on next mount retries
      }

      setStatus('authenticated');
    } catch {
      setError('UNKNOWN');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Sign in ──────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const { ok, status: s, body } = await apiFetch('/auth/login', {
        method: 'POST',
        body:   JSON.stringify({ email, password }),
      });

      if (!ok) { setError(parseApiError(s, body)); return; }

      // Server sets the session cookie — fetch profile to populate state
      try {
        setUser(await fetchMe(email));
      } catch {
        // Cookie is set; profile fetch failed — session restore on next mount retries
      }

      setStatus('authenticated');
    } catch {
      setError('UNKNOWN');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Sign out ─────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    // Fire-and-forget — server clears the cookie; don't block the UI
    apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  // ── Update profile ───────────────────────────────────────────────────────
  const updateProfile = useCallback(async (
    patch: Partial<Omit<UserProfile, 'id' | 'email' | 'createdAt'>>,
  ) => {
    const previous = userRef.current;

    // Optimistic update
    setUser(prev => prev ? { ...prev, ...patch } : prev);

    try {
      const { ok, status: s, body } = await apiFetch('/auth/profile', {
        method: 'PATCH',
        body:   JSON.stringify(toApiBody(patch)),
      });

      if (!ok) {
        setUser(previous);                          // rollback
        if (s === 401) {
          // Refresh already failed inside apiFetch — session is dead
          setUser(null);
          setStatus('unauthenticated');
        }
        return;
      }

      if (body.profile) {
        const profileRow = body.profile as Record<string, unknown>;
        setUser(prev => prev
          ? { ...prev, ...fromApiProfile({ ...profileRow, email: prev.email, id: prev.id }) }
          : prev
        );
      }
    } catch {
      setUser(previous);                            // rollback on network error
    }
  }, []);

  // ── Clear error ──────────────────────────────────────────────────────────
  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{
      user, status, isAuth, isLoading, error,
      signUp, signIn, signOut, updateProfile, clearError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
