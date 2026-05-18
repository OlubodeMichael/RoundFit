import { supabase } from "@/lib/supabase";
import type { DeleteAccountInput } from "@/types/account-deletion";
import {
    apiFetch,
    clearTokens,
    proactiveRefreshIfNeeded,
    storeTokens,
} from "@/utils/api";
import Constants from "expo-constants";
import * as AppleAuthentication from "expo-apple-authentication";
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
  stepsTarget?: number;
  currentStreak?: number;
  createdAt: string;
}

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "needs-profile";

export type AuthError =
  | "EMAIL_IN_USE"
  | "INVALID_CREDENTIALS"
  | "WEAK_PASSWORD"
  | "INVALID_EMAIL"
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
  ) => Promise<void>;

  /** Signs in with email + password. */
  signIn: (email: string, password: string) => Promise<void>;

  /** Signs out server-side (clears cookie) and resets local state. */
  signOut: () => Promise<void>;

  /** Sends a partial profile update to the server. TDEE recalculates automatically. */
  updateProfile: (
    patch: Partial<Omit<UserProfile, "id" | "email" | "createdAt">>,
  ) => Promise<void>;

  /** Re-fetches the current user from GET /auth/me and updates local state. */
  refreshUser: () => Promise<void>;

  /** Signs in via Google or Apple OAuth (opens a browser session). */
  signInWithOAuth: (provider: "google" | "apple") => Promise<void>;

  /**
   * True when an OAuth sign-in succeeded but no RoundFit profile exists yet.
   * The user is in the `needs-profile` flow (onboarding → sign-up screen).
   */
  oauthProfilePending: boolean;

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
  ) => Promise<void>;

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
  if (profile.stepsTarget !== undefined) out.steps_target = profile.stepsTarget;
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
    stepsTarget:
      typeof row.steps_target === "number" ? row.steps_target : undefined,
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

  if (status === 409 || msg.includes("already") || msg.includes("in use"))
    return "EMAIL_IN_USE";
  if (status === 401 || msg.includes("invalid") || msg.includes("credentials"))
    return "INVALID_CREDENTIALS";
  if (msg.includes("weak") || msg.includes("password")) return "WEAK_PASSWORD";
  if (msg.includes("email")) return "INVALID_EMAIL";
  return "UNKNOWN";
}

/**
 * Fetches and normalises the current user from GET /auth/me.
 * Throws if the request fails — callers handle the error.
 */
async function fetchMe(emailFallback = ""): Promise<UserProfile> {
  const { ok, status, body } = await apiFetch("/auth/me");
  if (!ok) {
    if (status === 404 && (body as Record<string, unknown>).error === 'PROFILE_NOT_FOUND') {
      throw new Error('no_profile');
    }
    throw new Error("fetch_me_failed");
  }

  // Response shape: { data: { user, profile } }
  const data = (body.data ?? body) as Record<string, unknown>;
  const profileRow = (data.profile ?? data) as Record<string, unknown>;
  const authUser = data.user as Record<string, unknown> | undefined;
  const userMeta = authUser?.user_metadata as
    | Record<string, unknown>
    | undefined;

  // Name lives in the profile row; fallback to Supabase user_metadata
  const name =
    (typeof profileRow.name === "string" && profileRow.name) ||
    (typeof userMeta?.name === "string" && userMeta.name) ||
    (typeof userMeta?.full_name === "string" && userMeta.full_name) ||
    "";

  return fromApiProfile({
    ...profileRow,
    name,
    email: (authUser?.email ?? profileRow.email ?? emailFallback) as string,
    id: (authUser?.id ?? profileRow.id ?? profileRow.user_id) as string,
  });
}

// ── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [oauthProfilePending, setOauthProfilePending] = useState(false);

  // Stable ref so updateProfile's rollback always sees the latest snapshot.
  const userRef = useRef<UserProfile | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  userRef.current = user;

  const isAuth = status === "authenticated";

  // ── Restore session on mount ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        // Proactively refresh if expired — this also runs the mismatch guard
        // (different-user tokens) before any data requests fire.
        const stillValid = await proactiveRefreshIfNeeded(0);
        if (!stillValid) {
          setStatus("unauthenticated");
          return;
        }
        setUser(await fetchMe());
        setStatus("authenticated");
      } catch (err) {
        if (err instanceof Error && err.message === 'no_profile') {
          // Valid tokens but no RoundFit profile yet (OAuth user mid-onboarding).
          // Keep tokens and route to profile setup instead of logging out.
          setOauthProfilePending(true);
          setStatus("needs-profile");
        } else {
          await clearTokens();
          setStatus("unauthenticated");
        }
      }
    })();
  }, []);

  // ── Proactive token refresh on foreground ─────────────────────────────────
  // Every time the app comes back to the foreground we check whether the
  // access token is about to expire (within 5 min) and refresh it before any
  // API call goes out.  This keeps the Supabase session alive as long as the
  // user opens the app at least once before the server-side inactivity window.
  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      async (next: AppStateStatus) => {
        const prev = appStateRef.current;
        appStateRef.current = next;

        if (!prev.match(/inactive|background/) || next !== "active") return;
        if (status !== "authenticated") return;

        const stillValid = await proactiveRefreshIfNeeded();
        if (!stillValid) {
          setUser(null);
          setStatus("unauthenticated");
          return;
        }

        // Re-fetch user profile silently so stale data doesn't linger
        try {
          setUser(await fetchMe(userRef.current?.email ?? ""));
        } catch (err) {
          if (err instanceof Error && err.message === 'no_profile') {
            setOauthProfilePending(true);
            setStatus("needs-profile");
          }
          // other errors: network hiccup — keep existing profile data
        }
      },
    );
    return () => sub.remove();
  }, [status]);

  useEffect(() => {
    if (error === null) return;
    const id = setTimeout(() => setError(null), AUTH_ERROR_DISPLAY_MS);
    return () => clearTimeout(id);
  }, [error]);

  // ── Sign up ──────────────────────────────────────────────────────────────
  const signUp = useCallback(
    async (
      email: string,
      password: string,
      profile: Omit<
        UserProfile,
        "id" | "email" | "createdAt" | "tdee" | "calorieBudget"
      >,
    ) => {
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
        });

        if (!ok) {
          setError(parseApiError(s, body));
          return;
        }

        if (
          typeof body.access_token === "string" &&
          typeof body.refresh_token === "string"
        ) {
          await storeTokens(body.access_token, body.refresh_token);
        }

        try {
          setUser(await fetchMe(email));
        } catch {
          // Token stored; profile fetch failed — session restore on next mount retries
        }

        setStatus("authenticated");
      } catch {
        setError("UNKNOWN");
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // ── Sign in ──────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const {
        ok,
        status: s,
        body,
      } = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (!ok) {
        setError(parseApiError(s, body));
        return;
      }

      if (
        typeof body.access_token === "string" &&
        typeof body.refresh_token === "string"
      ) {
        await storeTokens(body.access_token, body.refresh_token);
      }

      try {
        setUser(await fetchMe(email));
      } catch {
        // Token stored; profile fetch failed — session restore on next mount retries
      }

      setStatus("authenticated");
    } catch {
      setError("UNKNOWN");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── OAuth sign-in ─────────────────────────────────────────────────────────
  const signInWithOAuth = useCallback(async (provider: "google" | "apple") => {
    setError(null);
    setIsLoading(true);

    try {
      if (provider === "apple") {
        // ── Native Apple Sign In ──────────────────────────────────────────
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        const { identityToken } = credential;
        if (!identityToken) {
          console.error("[auth] Apple credential missing identityToken");
          setError("UNKNOWN");
          return;
        }

        const { data, error: idTokenError } =
          await supabase.auth.signInWithIdToken({
            provider: "apple",
            token: identityToken,
          });

        if (idTokenError || !data.session) {
          console.error("[auth] signInWithIdToken failed:", idTokenError?.message ?? "no session returned");
          setError("UNKNOWN");
          return;
        }

        await storeTokens(
          data.session.access_token,
          data.session.refresh_token,
        );
      } else {
        // ── Google — browser OAuth flow ───────────────────────────────────
        const redirectTo = "roundfit://auth/callback";

        const { data, error: oauthError } = await supabase.auth.signInWithOAuth(
          {
            provider: "google",
            options: { redirectTo, skipBrowserRedirect: true },
          },
        );

        if (oauthError || !data.url) {
          console.error("[auth] Google OAuth init failed:", oauthError?.message ?? "no URL");
          setError("UNKNOWN");
          return;
        }

        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo,
        );

        if (result.type !== "success") {
          return;
        }

        const fragment = result.url.split("#")[1];
        const params = fragment ? new URLSearchParams(fragment) : null;
        const access_token = params?.get("access_token");
        const refresh_token = params?.get("refresh_token");

        if (!access_token || !refresh_token) {
          console.error("[auth] Google callback missing tokens, fragment:", fragment?.substring(0, 100));
          setError("UNKNOWN");
          return;
        }

        await storeTokens(access_token, refresh_token);
      }

      try {
        setUser(await fetchMe());
        setStatus("authenticated");
      } catch {
        // New OAuth user — Supabase account exists but no RoundFit profile yet
        setOauthProfilePending(true);
        setStatus("needs-profile");
      }
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === "ERR_CANCELED") return;
      console.error("[auth] OAuth error:", err instanceof Error ? err.message : err);
      setError("UNKNOWN");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── OAuth profile setup ───────────────────────────────────────────────────
  const setupOAuthProfile = useCallback(
    async (
      profile: Omit<
        UserProfile,
        "id" | "email" | "createdAt" | "tdee" | "calorieBudget"
      >,
    ) => {
      setError(null);
      setIsLoading(true);

      try {
        const apiBody = toApiBody(profile);
        console.log("[auth] oauth-setup request body:", JSON.stringify(apiBody));

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
          return;
        }

        try {
          setUser(await fetchMe());
        } catch (fetchErr) {
          console.error("[auth] fetchMe after oauth-setup failed:", fetchErr instanceof Error ? fetchErr.message : fetchErr);
        }

        setOauthProfilePending(false);
        setStatus("authenticated");
      } catch (err) {
        console.error("[auth] oauth-setup exception:", err instanceof Error ? err.message : err);
        setError("UNKNOWN");
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // ── Sign out ─────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    await clearTokens();
    setUser(null);
    setOauthProfilePending(false);
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
    setUser(null);
    setOauthProfilePending(false);
    setStatus("unauthenticated");
  }, []);

  // ── Update profile ───────────────────────────────────────────────────────
  const updateProfile = useCallback(
    async (patch: Partial<Omit<UserProfile, "id" | "email" | "createdAt">>) => {
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
            // Refresh already failed inside apiFetch — session is dead
            setUser(null);
            setStatus("unauthenticated");
          }
          return;
        }

        if (body.profile) {
          const profileRow = body.profile as Record<string, unknown>;
          setUser((prev) =>
            prev
              ? {
                  ...prev,
                  ...fromApiProfile({
                    ...profileRow,
                    email: prev.email,
                    id: prev.id,
                  }),
                }
              : prev,
          );
        }
      } catch {
        setUser(previous); // rollback on network error
      }
    },
    [],
  );

  // ── Refresh user ─────────────────────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const fresh = await fetchMe(userRef.current?.email ?? "");
      setUser(fresh);
    } catch {
      // silently ignore — stale data is better than a crash
    }
  }, []);

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
        oauthProfilePending,
        setupOAuthProfile,
        signOut,
        deleteAccount,
        updateProfile,
        refreshUser,
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
