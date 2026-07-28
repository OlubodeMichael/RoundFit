import { supabase } from "@/lib/supabase";
import type { DeleteAccountInput } from "@/types/account-deletion";
import {
    apiFetch,
    clearTokens,
    getStoredAccessToken,
    hasStoredAccessToken,
    proactiveRefreshIfNeeded,
    proactiveRefreshStateIfNeeded,
    storeTokens,
} from "@/utils/api";
import { TTL_FOREGROUND_SKIP_MS } from "@/utils/daily-summary-cache";
import {
  getIosBundleIdentifier,
  isAppleAudienceError,
  OAUTH_REDIRECT_URL,
  parseOAuthCallbackUrl,
} from "@/utils/oauth";
import { notifyTodayTargetsChanged } from "@/utils/today-sync";
import {
  clearCachedAuthUser,
  readCachedAuthUser,
  writeCachedAuthUser,
} from "@/utils/auth-user-cache";
import { prefetchAvatarImage } from "@/utils/avatar-image-cache";
import { createAppleSignInNonce } from "@/utils/apple-sign-in-nonce";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";

WebBrowser.maybeCompleteAuthSession();

// ── Config ─────────────────────────────────────────────────────────────────

/** How long sign-in / sign-up error banners stay visible before auto-clearing. */
const AUTH_ERROR_DISPLAY_MS = 4_000;

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Canonical UI / app-state goal.
 * What every screen, store, and prop in the app speaks.
 */
export type UserGoal =
  | "lose_weight"
  | "build_muscle"
  | "boost_energy"
  | "maintain";

/**
 * What the RoundFit API stores and expects on the wire.
 * NEVER place a UserGoal value directly into a request body — translate via
 * `toApiGoal` first.
 */
export type ApiGoal = "lose" | "maintain" | "gain" | "energy";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  age: number;
  sex: "male" | "female";
  heightCm: number;
  weightKg: number;
  /**
   * How active the user is on a weekly basis.
   * Drives the activity multiplier used in TDEE calculation.
   */
  activityLevel:
    | "sedentary"
    | "lightly_active"
    | "moderately_active"
    | "very_active";
  /**
   * The user's primary fitness goal.
   * `maintain` is the neutral baseline; all others shift the calorie budget.
   */
  goal: UserGoal;
  unit: "metric" | "imperial";
  avatarUrl?: string | null;
  tdee?: number;
  calorieBudget?: number;
  proteinTarget?: number;
  stepsTarget?: number;
  sleepTarget?: number;
  waterGoalMl?: number;
  currentStreak?: number;
  createdAt: string;
}

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "needs-profile";

/** True when auth is settled and a user profile is loaded (safe for user-scoped fetches). */
export function hasActiveUserSession(
  status: AuthStatus,
  user: UserProfile | null,
): user is UserProfile {
  return status === "authenticated" && typeof user?.id === "string" && user.id.length > 0;
}

export type AuthError =
  | "EMAIL_IN_USE"
  | "INVALID_CREDENTIALS"
  | "API_KEY_INVALID"
  | "WEAK_PASSWORD"
  | "INVALID_EMAIL"
  | "OAUTH_FAILED"
  | "UNKNOWN";

interface AuthContextValue {
  user: UserProfile | null;
  status: AuthStatus;
  isAuth: boolean;
  /** True while signIn / signUp / updateProfile is in-flight. */
  isLoading: boolean;
  error: AuthError | null;

  /** Registers a new account and signs in. */
  signUp: (
    email: string,
    password: string,
    profile: Omit<
      UserProfile,
      "id" | "email" | "createdAt" | "tdee" | "calorieBudget"
    >,
  ) => Promise<boolean>;

  /** Signs in with email + password. Resolves to `true` on confirmed success
   *  (token stored AND profile loaded), `false` otherwise. */
  signIn: (email: string, password: string) => Promise<boolean>;

  /** Signs out server-side (invalidates Supabase session) and resets local state. */
  signOut: () => Promise<void>;

  /** Sends a partial profile update to the server. TDEE recalculates automatically. */
  updateProfile: (
    patch: Partial<Omit<UserProfile, "id" | "email" | "createdAt">>,
  ) => Promise<boolean>;

  /** Re-fetches the current user from GET /auth/me and updates local state. */
  refreshUser: () => Promise<void>;

  /**
   * Force-checks `/auth/me` and exits `needs-profile` when a profile already exists.
   * Use on complete-profile when session tokens are valid but routing is stale.
   */
  recoverExistingProfile: () => Promise<boolean>;

  /** Signs in via Google or Apple OAuth (opens a browser session). */
  signInWithOAuth: (provider: "google" | "apple") => Promise<void>;

  /**
   * True when an OAuth sign-in succeeded but no RoundFit profile exists yet.
   * The user is in the `needs-profile` flow (onboarding → sign-up screen).
   */
  profileSetupPending: boolean;

  /**
   * Creates a RoundFit profile for an OAuth user who just completed onboarding.
   * Calls POST /auth/oauth-setup with the collected profile data, then fetches
   * the full profile and transitions to `authenticated`.
   */
  setupOAuthProfile: (
    profile: Omit<
      UserProfile,
      "id" | "email" | "createdAt" | "tdee" | "calorieBudget"
    >,
  ) => Promise<boolean>;

  /** Permanently deletes the account and all its data. */
  deleteAccount: (input: DeleteAccountInput) => Promise<void>;

  /** Clears the last error. */
  clearError: () => void;
}

// ── API helpers ────────────────────────────────────────────────────────────

/** Maps API values (including legacy `km` / `miles`) to `metric` | `imperial`. */
export function normaliseProfileUnit(
  raw: string | undefined | null,
): UserProfile["unit"] {
  const s = (raw ?? "metric").trim().toLowerCase();
  if (s === "imperial" || s === "miles") return "imperial";
  return "metric";
}

/**
 * Accepts either a canonical UI goal (`lose_weight` / `build_muscle` /
 * `boost_energy` / `maintain`) or a raw API goal (`lose` / `gain` / `energy` /
 * `maintain`) and returns the canonical UI value. Use this anywhere a goal
 * enters the app — legacy UI strings, GET /me payloads, query params, etc.
 */
export function normaliseGoal(g: string): UserGoal {
  if (g === "lose_weight" || g === "lose") return "lose_weight";
  if (g === "build_muscle" || g === "gain") return "build_muscle";
  if (g === "boost_energy" || g === "energy") return "boost_energy";
  return "maintain";
}

/**
 * Translate a UI goal into the wire value the API stores.
 * Call this immediately before building any POST /register or PATCH /profile
 * body — never ship a `UserGoal` value straight to the backend.
 */
export function toApiGoal(g: UserGoal): ApiGoal {
  switch (g) {
    case "lose_weight":
      return "lose";
    case "build_muscle":
      return "gain";
    case "boost_energy":
      return "energy";
    case "maintain":
      return "maintain";
  }
}

/**
 * Translate an API goal (from GET /me or any response containing
 * `profile.goal`) into the canonical UI goal. Prefer `normaliseGoal` when the
 * input is `string` (it accepts both shapes); use this when the input is
 * already typed as `ApiGoal`.
 */
export function fromApiGoal(g: ApiGoal): UserGoal {
  switch (g) {
    case "lose":
      return "lose_weight";
    case "gain":
      return "build_muscle";
    case "energy":
      return "boost_energy";
    case "maintain":
      return "maintain";
  }
}

/** Normalises a raw activity string to the canonical API value. */
function normaliseActivity(a: string): UserProfile["activityLevel"] {
  if (a === "sedentary") return "sedentary";
  if (a === "moderately_active" || a === "moderate") return "moderately_active";
  if (a === "very_active") return "very_active";
  return "lightly_active";
}

/** Converts camelCase UserProfile fields to the API's snake_case shape. */
function toApiBody(
  profile: Partial<Omit<UserProfile, "id" | "email" | "createdAt">>,
) {
  const out: Record<string, unknown> = {};
  if (profile.name !== undefined) out.name = profile.name;
  if (profile.age !== undefined) out.age = profile.age;
  if (profile.sex !== undefined) out.sex = profile.sex;
  if (profile.heightCm !== undefined) out.height_cm = profile.heightCm;
  if (profile.weightKg !== undefined) out.weight_kg = profile.weightKg;
  if (profile.activityLevel !== undefined)
    out.activity_level = normaliseActivity(profile.activityLevel);
  if (profile.goal !== undefined) {
    // Translate UI → API at the one place we talk to the backend.
    // `normaliseGoal` first so legacy/raw strings are accepted defensively.
    out.goal = toApiGoal(normaliseGoal(profile.goal));
  }
  if (profile.unit !== undefined) out.unit = profile.unit;
  if (profile.avatarUrl !== undefined) out.avatar_url = profile.avatarUrl;
  if (profile.calorieBudget !== undefined) out.calorie_budget = profile.calorieBudget;
  if (profile.proteinTarget !== undefined) out.protein_target = profile.proteinTarget;
  if (profile.stepsTarget !== undefined) out.steps_target = profile.stepsTarget;
  if (profile.sleepTarget !== undefined) out.sleep_target = profile.sleepTarget;
  if (profile.waterGoalMl !== undefined) out.water_goal_ml = profile.waterGoalMl;
  return out;
}

/** Normalises a raw API profile row into our camelCase UserProfile. */
function fromApiProfile(row: Record<string, unknown>): UserProfile {
  const str = (v: unknown, fb = "") => (typeof v === "string" ? v : fb);
  const num = (v: unknown, fb = 0) => (typeof v === "number" ? v : fb);
  return {
    id: str(row.id ?? row.user_id),
    email: str(row.email),
    name: str(row.name),
    age: num(row.age),
    sex: str(row.sex, "male") as UserProfile["sex"],
    heightCm: num(row.height_cm),
    weightKg: num(row.weight_kg),
    activityLevel: str(
      row.activity_level,
      "sedentary",
    ) as UserProfile["activityLevel"],
    goal: normaliseGoal(str(row.goal, "maintain")),
    unit: normaliseProfileUnit(str(row.unit ?? row.distance_unit, "metric")),
    // Server has a typo: 'avater_url' — handle both spellings
    avatarUrl:
      typeof (row.avatar_url ?? row.avater_url) === "string"
        ? ((row.avatar_url ?? row.avater_url) as string)
        : null,
    tdee: typeof row.tdee === "number" ? row.tdee : undefined,
    calorieBudget:
      typeof row.calorie_budget === "number" ? row.calorie_budget : undefined,
    proteinTarget:
      typeof row.protein_target === "number" && row.protein_target > 0
        ? row.protein_target
        : undefined,
    stepsTarget:
      typeof row.steps_target === "number" ? row.steps_target : undefined,
    sleepTarget:
      typeof row.sleep_target === "number"
        ? row.sleep_target
        : typeof row.sleep_target === "string"
          ? Number(row.sleep_target)
          : undefined,
    waterGoalMl:
      typeof row.water_goal_ml === "number" ? row.water_goal_ml : undefined,
    currentStreak:
      typeof row.current_streak === "number" ? row.current_streak : undefined,
    createdAt: str(row.created_at, new Date().toISOString()),
  };
}

/** Maps HTTP status / response body to a typed AuthError code. */
function parseApiError(
  status: number,
  body: Record<string, unknown>,
): AuthError {
  const raw =
    typeof body.message === "string"
      ? body.message
      : typeof body.error === "string"
        ? body.error
        : "";
  const msg = raw.toLowerCase();

  // Duplicate-email: 409 (preferred) or message wording. Backend now maps
  // Supabase "already registered" to 409, but keep the message check as a
  // safety net for older builds.
  if (
    status === 409 ||
    msg.includes("already registered") ||
    msg.includes("already exists") ||
    msg.includes("email in use") ||
    msg.includes("already in use")
  ) {
    return "EMAIL_IN_USE";
  }
  // API key failures also return 401 — distinguish them so the UI does not
  // claim the password is wrong when the client is misconfigured.
  if (
    msg.includes("api key") ||
    msg.includes("invalid or missing api key")
  ) {
    return "API_KEY_INVALID";
  }
  // Invalid credentials: narrow to the actual signal — 401 from /login or
  // explicit credential wording. A generic "invalid X" no longer collapses
  // into this bucket (it used to swallow validation errors).
  if (
    status === 401 ||
    msg.includes("invalid credentials") ||
    msg.includes("invalid login") ||
    msg.includes("incorrect password") ||
    msg.includes("wrong password")
  ) {
    return "INVALID_CREDENTIALS";
  }
  if (msg.includes("weak password") || msg.includes("password is too weak"))
    return "WEAK_PASSWORD";
  if (msg.includes("invalid email") || msg.includes("email format"))
    return "INVALID_EMAIL";
  return "UNKNOWN";
}

/** True when a raw API object looks like a `users` profile row. */
function looksLikeProfileRow(row: Record<string, unknown>): boolean {
  const hasId =
    (typeof row.id === "string" && row.id.length > 0) ||
    (typeof row.user_id === "string" && row.user_id.length > 0);
  const hasBodyMetrics =
    typeof row.height_cm === "number" ||
    typeof row.weight_kg === "number" ||
    typeof row.age === "number";
  return hasId && (hasBodyMetrics || typeof row.goal === "string");
}

/** Locates a profile row across known `/auth/me` response shapes. */
function extractProfileRow(
  body: Record<string, unknown>,
): Record<string, unknown> | null {
  const data = (body.data ?? body) as Record<string, unknown>;

  const nested = data.profile;
  if (nested && typeof nested === "object") {
    return nested as Record<string, unknown>;
  }

  if (body.profile && typeof body.profile === "object") {
    return body.profile as Record<string, unknown>;
  }

  if (looksLikeProfileRow(data)) {
    return data;
  }

  return null;
}

/**
 * Parses a profile from GET /me, POST /login, or POST /register bodies.
 * Returns null only when no usable profile row exists.
 */
function profileFromAuthPayload(
  body: Record<string, unknown>,
  emailFallback = "",
): UserProfile | null {
  const profileRecord = extractProfileRow(body);
  if (!profileRecord) {
    return null;
  }

  const data = (body.data ?? body) as Record<string, unknown>;
  const authUser = data.user as Record<string, unknown> | undefined;
  const userMeta = authUser?.user_metadata as
    | Record<string, unknown>
    | undefined;

  const name =
    (typeof profileRecord.name === "string" && profileRecord.name) ||
    (typeof userMeta?.name === "string" && userMeta.name) ||
    (typeof userMeta?.full_name === "string" && userMeta.full_name) ||
    "";

  const profile = fromApiProfile({
    ...profileRecord,
    name,
    email: (authUser?.email ?? profileRecord.email ?? emailFallback) as string,
    id: (authUser?.id ?? profileRecord.id ?? profileRecord.user_id) as string,
  });

  if (hasValidProfileIdentity(profile)) {
    return profile;
  }

  return null;
}

/**
 * Fetches and normalises the current user from GET /auth/me.
 * Throws "no_profile" when the server has a session but no profile row, and
 * "fetch_me_failed" for any other failure. Callers must treat the two
 * distinctly — only "no_profile" should send the user into onboarding.
 */
async function fetchMe(emailFallback = ""): Promise<UserProfile> {
  const { ok, body } = await apiFetch("/auth/me");
  if (!ok) {
    throw new Error("fetch_me_failed");
  }

  const profile = profileFromAuthPayload(body, emailFallback);
  if (!profile) {
    throw new Error("no_profile");
  }
  return profile;
}

/** Profile row returned by POST /auth/oauth-setup (`{ data: { profile } }`). */
function profileFromOAuthSetupBody(
  body: Record<string, unknown>,
): UserProfile | null {
  return profileFromAuthPayload(body);
}

function isNoProfileError(err: unknown): boolean {
  return err instanceof Error && err.message === "no_profile";
}

function isFetchMeFailedError(err: unknown): boolean {
  return err instanceof Error && err.message === "fetch_me_failed";
}

async function wait(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function hasValidProfileIdentity(
  profile: UserProfile | null,
): profile is UserProfile {
  return typeof profile?.id === "string" && profile.id.length > 0;
}

// ── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [profileSetupPending, setProfileSetupPending] = useState(false);

  // Stable ref so updateProfile's rollback always sees the latest snapshot.
  const userRef = useRef<UserProfile | null>(null);
  const statusRef = useRef(status);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastMeFetchAtRef = useRef(0);
  const fetchMeInflightRef = useRef<Promise<UserProfile> | null>(null);
  userRef.current = user;
  statusRef.current = status;

  const loadUserFromServer = useCallback(
    async (emailFallback = "", force = false): Promise<UserProfile> => {
      if (
        !force &&
        userRef.current &&
        lastMeFetchAtRef.current > 0 &&
        Date.now() - lastMeFetchAtRef.current < TTL_FOREGROUND_SKIP_MS
      ) {
        return userRef.current;
      }

      if (fetchMeInflightRef.current) {
        return fetchMeInflightRef.current;
      }

      const run = fetchMe(emailFallback)
        .then((fresh) => {
          lastMeFetchAtRef.current = Date.now();
          return fresh;
        })
        .finally(() => {
          fetchMeInflightRef.current = null;
        });

      fetchMeInflightRef.current = run;
      return run;
    },
    [],
  );

  const isAuth = status === "authenticated";

  const loadUserWithRetry = useCallback(
    async (emailFallback = ""): Promise<UserProfile> => {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await loadUserFromServer(emailFallback, true);
        } catch (err) {
          lastErr = err;
          if (isNoProfileError(err)) throw err;
          if (!isFetchMeFailedError(err) || attempt === 2) throw err;
          await wait(700 * (attempt + 1));
        }
      }
      throw lastErr ?? new Error("fetch_me_failed");
    },
    [loadUserFromServer],
  );

  // Persist the profile so the next launch can restore the session from cache
  // without blocking the splash on /auth/me. Only writes valid profiles; never
  // removes on null (boot starts null before the cache is read) — logout and an
  // invalid-token refresh clear it explicitly.
  useEffect(() => {
    if (user && hasValidProfileIdentity(user)) {
      void writeCachedAuthUser(user);
    }
  }, [user]);

  // ── Restore session on mount ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Cache-first: if a stored token and a cached profile both exist, paint
      // the authenticated session immediately and revalidate in the background.
      // This avoids re-fetching /auth/me (and blocking the splash) on every
      // reload. The full validation flow below still runs and stays
      // authoritative.
      const [cachedUser, tokenPresent] = await Promise.all([
        readCachedAuthUser(),
        hasStoredAccessToken(),
      ]);
      if (cancelled) return;

      const paintedFromCache = !!(cachedUser && tokenPresent);
      if (paintedFromCache) {
        setUser(cachedUser);
        prefetchAvatarImage(cachedUser.avatarUrl);
        setProfileSetupPending(false);
        setStatus("authenticated");
      }

      // Bounded retries so a transient backend/network blip at cold start does
      // NOT bounce a user with valid tokens to the auth screen. Only a
      // definitive "invalid" refresh (or a missing token) ends in
      // unauthenticated; transient failures retry with backoff and keep tokens.
      const MAX_ATTEMPTS = 4;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        if (cancelled) return;
        if (attempt > 0) await wait(1200 * attempt);
        if (cancelled) return;

        try {
          // Proactively refresh if expired — this also runs the mismatch guard
          // (different-user tokens) before any data requests fire.
          const refreshState = await proactiveRefreshStateIfNeeded(0);
          if (cancelled) return;
          if (refreshState === "invalid") {
            // Genuinely bad token — drop any cached session we painted.
            if (paintedFromCache) await clearCachedAuthUser();
            setStatus("unauthenticated");
            return;
          }
          if (refreshState === "transient") {
            // Backend unreachable while the token may be expired. Keep tokens,
            // stay on the splash, and retry — do not log the user out.
            if (!(await hasStoredAccessToken())) {
              setStatus("unauthenticated");
              return;
            }
            // A cached session is already on screen — keep it rather than
            // bouncing a logged-in user offline.
            if (paintedFromCache) return;
            if (attempt < MAX_ATTEMPTS - 1) continue;
            setStatus("unauthenticated"); // last resort after exhausting retries
            return;
          }

          const restored = await loadUserWithRetry("");
          if (cancelled) return;
          setUser(restored);
          setProfileSetupPending(false);
          setStatus("authenticated");
          return;
        } catch (err) {
          if (cancelled) return;
          if (isNoProfileError(err)) {
            setProfileSetupPending(true);
            setStatus("needs-profile");
            return;
          }

          // fetch_me_failed or other transient error. Preserve tokens so the
          // user recovers on retry / next launch instead of being logged out.
          lastMeFetchAtRef.current = 0;
          if (!(await hasStoredAccessToken())) {
            setStatus("unauthenticated");
            return;
          }
          // Keep a cached session on screen through a transient /me failure.
          if (paintedFromCache) return;
          if (attempt < MAX_ATTEMPTS - 1) continue;
          // Exhausted transient retries — surface auth as a last resort, but
          // tokens remain so a later launch can restore the session.
          setStatus("unauthenticated");
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadUserWithRetry]);

  // ── Proactive token refresh on foreground ─────────────────────────────────
  // Refresh the access token when needed; only re-fetch /auth/me if the last
  // load is older than TTL_FOREGROUND_SKIP_MS (avoids duplicate calls on resume).
  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      async (next: AppStateStatus) => {
        const prev = appStateRef.current;
        appStateRef.current = next;

        if (!prev.match(/inactive|background/) || next !== "active") return;
        const currentStatus = statusRef.current;
        if (currentStatus !== "authenticated" && currentStatus !== "needs-profile") {
          return;
        }

        const refreshState = await proactiveRefreshStateIfNeeded();
        if (refreshState === "invalid") {
          setUser(null);
          lastMeFetchAtRef.current = 0;
          setStatus("unauthenticated");
          return;
        }

        if (Date.now() - lastMeFetchAtRef.current < TTL_FOREGROUND_SKIP_MS) {
          return;
        }

        try {
          const fresh = await loadUserFromServer(
            userRef.current?.email ?? "",
            false,
          );
          setUser(fresh);
          // If a profile now exists while we were in needs-profile, recover the
          // normal authenticated state so routing leaves complete-profile.
          if (currentStatus === "needs-profile" && hasValidProfileIdentity(fresh)) {
            setProfileSetupPending(false);
            setStatus("authenticated");
          }
        } catch (err) {
          if (isNoProfileError(err)) {
            try {
              const retried = await loadUserFromServer(
                userRef.current?.email ?? "",
                true,
              );
              setUser(retried);
              if (currentStatus === "needs-profile" && hasValidProfileIdentity(retried)) {
                setProfileSetupPending(false);
                setStatus("authenticated");
              }
            } catch (retryErr) {
              if (isNoProfileError(retryErr)) {
                setProfileSetupPending(true);
                setStatus("needs-profile");
              }
            }
          }
          // other errors: network hiccup — keep existing profile data
        }
      },
    );
    return () => sub.remove();
  }, [loadUserFromServer]);

  useEffect(() => {
    if (error === null) return;
    const id = setTimeout(() => setError(null), AUTH_ERROR_DISPLAY_MS);
    return () => clearTimeout(id);
  }, [error]);

  // Repair stale `needs-profile` when `user` was hydrated but status was not updated.
  useEffect(() => {
    if (status === "needs-profile" && hasValidProfileIdentity(user)) {
      setProfileSetupPending(false);
      setStatus("authenticated");
    }
  }, [status, user]);

  // ── Sign up ──────────────────────────────────────────────────────────────
  const signUp = useCallback(
    async (
      email: string,
      password: string,
      profile: Omit<
        UserProfile,
        "id" | "email" | "createdAt" | "tdee" | "calorieBudget"
      >,
    ): Promise<boolean> => {
      setError(null);
      setIsLoading(true);

      try {
        const {
          ok,
          status: s,
          body,
        } = await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password, ...toApiBody(profile) }),
          includeAuthToken: false,
        });

        if (!ok) {
          setError(parseApiError(s, body));
          return false;
        }

        if (
          typeof body.access_token !== "string" ||
          typeof body.refresh_token !== "string"
        ) {
          // Account may have been created but the server couldn't issue a session.
          // Surface the error so the user knows to log in manually.
          setError("UNKNOWN");
          return false;
        }

        await storeTokens(body.access_token, body.refresh_token);

        if (body.needs_profile_setup === true) {
          setProfileSetupPending(true);
          setStatus("needs-profile");
          return false;
        }

        const inlineProfile = profileFromAuthPayload(body, email);
        if (inlineProfile) {
          if (!hasValidProfileIdentity(inlineProfile)) {
            await clearTokens();
            setUser(null);
            setStatus("unauthenticated");
            setError("UNKNOWN");
            return false;
          }
          lastMeFetchAtRef.current = Date.now();
          setUser(inlineProfile);
          setStatus("authenticated");
          return true;
        }

        try {
          setUser(await loadUserFromServer(email, true));
          setStatus("authenticated");
          return true;
        } catch (err) {
          if (isNoProfileError(err)) {
            setProfileSetupPending(true);
            setStatus("needs-profile");
            return false;
          } else {
            // Keep session tokens on transient /me failures so users can recover
            // on retry instead of being forcibly logged out.
            if (!isFetchMeFailedError(err)) {
              await clearTokens();
            }
            setUser(null);
            setStatus("unauthenticated");
            setError("UNKNOWN");
            return false;
          }
        }
      } catch {
        setError("UNKNOWN");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [loadUserFromServer],
  );

  // ── Sign in ──────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    try {
      const {
        ok,
        status: s,
        body,
      } = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
        includeAuthToken: false,
      });

      if (!ok) {
        setError(parseApiError(s, body));
        return false;
      }

      // Treat missing tokens on a "successful" login as a failure — without
      // tokens we'd silently fall back to whatever's still in SecureStore
      // (potentially a different user's session).
      if (
        typeof body.access_token !== "string" ||
        typeof body.refresh_token !== "string"
      ) {
        setError("UNKNOWN");
        return false;
      }
      await storeTokens(body.access_token, body.refresh_token);

      if (body.needs_profile_setup === true) {
        setProfileSetupPending(true);
        setStatus("needs-profile");
        // needs-profile is not the "authenticated and ready" state callers
        // probably want to gate on, so report it as not-yet-success.
        return false;
      }

      const inlineProfile = profileFromAuthPayload(body, email);
      if (inlineProfile) {
        if (!hasValidProfileIdentity(inlineProfile)) {
          await clearTokens();
          setUser(null);
          setStatus("unauthenticated");
          setError("UNKNOWN");
          return false;
        }
        lastMeFetchAtRef.current = Date.now();
        setUser(inlineProfile);
        setStatus("authenticated");
        return true;
      }

      try {
        setUser(await loadUserFromServer(email, true));
        setStatus("authenticated");
        return true;
      } catch (err) {
        if (isNoProfileError(err)) {
          setProfileSetupPending(true);
          setStatus("needs-profile");
          return false;
        }
        // Keep tokens for transient /me failures; clear only on non-transient.
        if (!isFetchMeFailedError(err)) {
          await clearTokens();
        }
        setUser(null);
        setStatus("unauthenticated");
        setError("UNKNOWN");
        return false;
      }
    } catch {
      setError("UNKNOWN");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadUserFromServer]);

  // ── OAuth sign-in ─────────────────────────────────────────────────────────
  const signInWithOAuth = useCallback(async (provider: "google" | "apple") => {
    setError(null);
    setIsLoading(true);

    try {
      // Session exists but RoundFit profile missing — re-check /me before re-opening OAuth UI.
      if (
        statusRef.current === "needs-profile" &&
        (await hasStoredAccessToken())
      ) {
        // Clear pending flag while we re-check; restoring it to true on no_profile
        // causes a genuine state change that re-triggers the routing effect in _layout.tsx.
        setProfileSetupPending(false);
        try {
          setUser(await loadUserFromServer("", true));
          setStatus("authenticated");
        } catch (err) {
          if (isNoProfileError(err)) {
            setProfileSetupPending(true);
            setStatus("needs-profile");
          } else {
            console.error(
              "[auth] OAuth re-check failed:",
              err instanceof Error ? err.message : err,
            );
            setError("UNKNOWN");
          }
        }
        return;
      }

      if (provider === "apple") {
        if (Platform.OS !== "ios") {
          setError("OAUTH_FAILED");
          return;
        }

        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (!isAvailable) {
          console.error("[auth] Sign in with Apple is not available on this device");
          setError("OAUTH_FAILED");
          return;
        }

        const { rawNonce, hashedNonce } = createAppleSignInNonce();

        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
          nonce: hashedNonce,
        });

        const { identityToken } = credential;
        if (!identityToken) {
          console.error("[auth] Apple credential missing identityToken");
          setError("OAUTH_FAILED");
          return;
        }

        const { data, error: idTokenError } =
          await supabase.auth.signInWithIdToken({
            provider: "apple",
            token: identityToken,
            nonce: rawNonce,
          });

        if (idTokenError || !data.session) {
          const msg = idTokenError?.message ?? "no session returned";
          if (isAppleAudienceError(msg)) {
            const bundleId = getIosBundleIdentifier() ?? "unknown";
            console.error(
              "[auth] Apple Client ID mismatch. Add these to Supabase → Auth → Apple → Client IDs:",
              `host.exp.Exponent,com.michaelolu.roundfit (current build: ${bundleId})`,
            );
          } else {
            console.error("[auth] signInWithIdToken failed:", msg);
          }
          setError("OAUTH_FAILED");
          return;
        }

        await storeTokens(
          data.session.access_token,
          data.session.refresh_token,
        );
      } else {
        // ── Google — browser OAuth flow ───────────────────────────────────
        const redirectTo = OAUTH_REDIRECT_URL;

        const { data, error: oauthError } = await supabase.auth.signInWithOAuth(
          {
            provider: "google",
            options: { redirectTo, skipBrowserRedirect: true },
          },
        );

        if (oauthError || !data.url) {
          console.error("[auth] Google OAuth init failed:", oauthError?.message ?? "no URL");
          setError("OAUTH_FAILED");
          return;
        }

        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo,
        );

        if (result.type === "cancel" || result.type === "dismiss") {
          return;
        }

        if (result.type !== "success") {
          console.error("[auth] Google OAuth browser result:", result.type);
          setError("OAUTH_FAILED");
          return;
        }

        const callback = parseOAuthCallbackUrl(result.url);
        if (callback.error) {
          console.error(
            "[auth] Google OAuth error:",
            callback.error,
            callback.errorDescription ?? "",
          );
          setError("OAUTH_FAILED");
          return;
        }

        if (!callback.accessToken || !callback.refreshToken) {
          // Never log the URL itself — its fragment can contain a live token.
          console.error(
            "[auth] Google callback missing tokens —",
            `access_token: ${callback.accessToken ? "present" : "missing"},`,
            `refresh_token: ${callback.refreshToken ? "present" : "missing"}`,
          );
          setError("OAUTH_FAILED");
          return;
        }

        await storeTokens(callback.accessToken, callback.refreshToken);
      }

      // Fetch the user profile. OAuth tokens can take a moment to propagate on
      // the backend, so retry once with a short delay on transient failures.
      let fetchedUser = null;
      let fetchErr: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise<void>(r => setTimeout(r, 1000));
        try {
          fetchedUser = await loadUserFromServer("", true);
          fetchErr = null;
          break;
        } catch (e) {
          fetchErr = e instanceof Error ? e : new Error(String(e));
          if (fetchErr.message === "no_profile") break; // no point retrying
        }
      }

      if (fetchedUser) {
        setUser(fetchedUser);
        setProfileSetupPending(false);
        setStatus("authenticated");
      } else if (fetchErr?.message === "no_profile") {
        setProfileSetupPending(true);
        setStatus("needs-profile");
      } else {
        // Backend unreachable / 5xx after retry: don't push the user into
        // onboarding (would re-create a profile and orphan their existing
        // data on next /me success). Surface an error and keep them at the
        // auth-options screen so they can retry.
        console.error("[auth] OAuth fetchMe failed after retry:", fetchErr?.message);
        if (!isFetchMeFailedError(fetchErr)) {
          await clearTokens();
        }
        setUser(null);
        setProfileSetupPending(false);
        setStatus("unauthenticated");
        setError("OAUTH_FAILED");
      }
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === "ERR_CANCELED") return;
      console.error("[auth] OAuth error:", err instanceof Error ? err.message : err);
      setError("OAUTH_FAILED");
    } finally {
      setIsLoading(false);
    }
  }, [loadUserFromServer]);

  // ── OAuth profile setup ───────────────────────────────────────────────────
  const setupOAuthProfile = useCallback(
    async (
      profile: Omit<
        UserProfile,
        "id" | "email" | "createdAt" | "tdee" | "calorieBudget"
      >,
    ): Promise<boolean> => {
      setError(null);
      setIsLoading(true);

      try {
        const refreshState = await proactiveRefreshStateIfNeeded(0);
        if (refreshState === "invalid") {
          setError("UNKNOWN");
          return false;
        }

        const apiBody = toApiBody(profile);
        if (__DEV__) {
          // Body contains weight, age, sex, etc. — keep out of prod logs.
          console.log("[auth] oauth-setup request body:", JSON.stringify(apiBody));
        }

        const {
          ok,
          status: s,
          body,
        } = await apiFetch("/auth/oauth-setup", {
          method: "POST",
          body: JSON.stringify(apiBody),
        });

        if (!ok) {
          console.error("[auth] oauth-setup failed:", s, JSON.stringify(body));
          setError(parseApiError(s, body));
          return false;
        }

        let nextUser = profileFromOAuthSetupBody(body);
        if (!nextUser) {
          try {
            nextUser = await loadUserFromServer("", true);
          } catch (fetchErr) {
            console.error(
              "[auth] fetchMe after oauth-setup failed:",
              fetchErr instanceof Error ? fetchErr.message : fetchErr,
            );
            setError("UNKNOWN");
            return false;
          }
        }

        if (!nextUser.id) {
          console.error("[auth] oauth-setup returned profile without id");
          setError("UNKNOWN");
          return false;
        }

        setUser(nextUser);
        setProfileSetupPending(false);
        setStatus("authenticated");
        return true;
      } catch (err) {
        console.error("[auth] oauth-setup exception:", err instanceof Error ? err.message : err);
        setError("UNKNOWN");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [loadUserFromServer],
  );

  // ── Sign out ─────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    // Capture the token BEFORE clearTokens(): apiFetch reads SecureStore
    // asynchronously, so a plain fire-and-forget call races the delete below
    // and sends /auth/logout unauthenticated — the backend then can't revoke
    // the refresh token and the session stays alive server-side.
    const token = await getStoredAccessToken();
    apiFetch("/auth/logout", {
      method: "POST",
      includeAuthToken: false,
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    }).catch(() => {});
    await clearTokens();
    const { clearUserCachesOnLogout } = await import('@/utils/clear-user-caches');
    await clearUserCachesOnLogout();

    // Clear device-local flags so the next account starts clean
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AsyncStorage = require("@react-native-async-storage/async-storage").default;
      await AsyncStorage.multiRemove([
        "@roundfit/health_connected",
        "@roundfit/last_health_sync",
      ]);
    } catch { /* storage unavailable */ }

    setUser(null);
    setProfileSetupPending(false);
    lastMeFetchAtRef.current = 0;
    setStatus("unauthenticated");
  }, []);

  // ── Delete account ───────────────────────────────────────────────────────
  const deleteAccount = useCallback(async (input: DeleteAccountInput) => {
    const platform =
      Platform.OS === "ios"
        ? "ios"
        : Platform.OS === "android"
          ? "android"
          : undefined;
    const { ok, body } = await apiFetch("/auth/account", {
      method: "DELETE",
      body: JSON.stringify({
        reason: input.reason,
        details: input.details,
        platform,
        app_version: Constants.expoConfig?.version ?? undefined,
      }),
    });
    if (!ok) {
      const msg =
        typeof body.error === "string" ? body.error : "delete_account_failed";
      throw new Error(msg);
    }
    await clearTokens();
    const { clearUserCachesOnLogout } = await import('@/utils/clear-user-caches');
    await clearUserCachesOnLogout();
    setUser(null);
    setProfileSetupPending(false);
    lastMeFetchAtRef.current = 0;
    setStatus("unauthenticated");
  }, []);

  // ── Update profile ───────────────────────────────────────────────────────
  const updateProfile = useCallback(
    async (patch: Partial<Omit<UserProfile, "id" | "email" | "createdAt">>): Promise<boolean> => {
      const previous = userRef.current;

      // Optimistic update
      setUser((prev) => (prev ? { ...prev, ...patch } : prev));

      try {
        const {
          ok,
          status: s,
          body,
        } = await apiFetch("/auth/profile", {
          method: "PATCH",
          body: JSON.stringify(toApiBody(patch)),
        });

        if (!ok) {
          setUser(previous); // rollback
          if (s === 401) {
            const hasToken = await hasStoredAccessToken();
            // Only force unauthenticated if refresh handling already cleared tokens.
            if (!hasToken) {
              setUser(null);
              setStatus("unauthenticated");
            }
          }
          return false;
        }

        // Backend returns `{ data: { profile } }` — match that shape so the
        // server-recomputed tdee/calorie_budget actually land in state.
        // Fall back to legacy `body.profile` for older builds.
        const data = (body.data ?? {}) as Record<string, unknown>;
        const profileRow =
          (data.profile as Record<string, unknown> | undefined) ??
          (body.profile as Record<string, unknown> | undefined);
        if (profileRow) {
          setUser((prev) =>
            prev
              ? {
                  ...prev,
                  ...fromApiProfile({
                    ...profileRow,
                    email: prev.email,
                    id: prev.id,
                  }),
                  ...patch,
                }
              : prev,
          );
        }

        const touchesDerivedTargets = Object.keys(patch).some((key) =>
          ['calorieBudget', 'proteinTarget', 'stepsTarget', 'sleepTarget', 'goal', 'activityLevel', 'weightKg', 'heightCm', 'sex', 'age'].includes(key),
        );
        if (touchesDerivedTargets) notifyTodayTargetsChanged();
        return true;
      } catch {
        setUser(previous); // rollback on network error
        return false;
      }
    },
    [],
  );

  // ── Refresh user ─────────────────────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const fresh = await loadUserFromServer(userRef.current?.email ?? "", true);
      setUser(fresh);
      if (hasValidProfileIdentity(fresh)) {
        setProfileSetupPending(false);
        setStatus("authenticated");
      }
    } catch (err) {
      if (__DEV__) {
        console.warn(
          "[auth] refreshUser failed (keeping stale profile):",
          err instanceof Error ? err.message : err,
        );
      }
    }
  }, [loadUserFromServer]);

  const recoverExistingProfile = useCallback(async (): Promise<boolean> => {
    const hasToken = await hasStoredAccessToken();
    if (!hasToken) return false;

    try {
      const refreshState = await proactiveRefreshStateIfNeeded(0);
      if (refreshState === "invalid") return false;

      const fresh = await loadUserWithRetry(userRef.current?.email ?? "");
      setUser(fresh);
      setProfileSetupPending(false);
      setStatus("authenticated");
      return true;
    } catch (err) {
      if (isNoProfileError(err)) {
        return false;
      }
      if (__DEV__) {
        console.warn(
          "[auth] recoverExistingProfile failed:",
          err instanceof Error ? err.message : err,
        );
      }
      return false;
    }
  }, [loadUserWithRetry]);

  // ── Clear error ──────────────────────────────────────────────────────────
  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        isAuth,
        isLoading,
        error,
        signUp,
        signIn,
        signInWithOAuth,
        profileSetupPending,
        setupOAuthProfile,
        signOut,
        deleteAccount,
        updateProfile,
        refreshUser,
        recoverExistingProfile,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
