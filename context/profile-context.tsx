import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { normaliseProfileUnit, useAuth } from '@/context/auth-context';
import type { UserProfile } from '@/context/auth-context';
import { formatHeightForStats, formatWeightForStats, LB_PER_KG } from '@/utils/body-units';

// ── Derived / display types ────────────────────────────────────────────────

export interface ProfileStats {
  /** Server-computed TDEE, or null if not yet available. */
  dailyCalories: number | null;
  /** Estimated daily protein target in grams (0.8 g per lb of body weight). */
  proteinGrams:  number | null;
  /** Current body weight formatted for display. */
  weightDisplay: string | null;
  /** Height formatted for display. */
  heightDisplay: string | null;
}

export interface ProfileContextValue {
  /** Raw profile from the server. Null while loading or unauthenticated. */
  profile: UserProfile | null;

  /** True while the auth layer is resolving the session on mount. */
  isLoading: boolean;

  /** Avatar image URL if the user has uploaded one, otherwise null. */
  avatarUrl: string | null;

  /** First letter of the user's name — for avatar initials. */
  avatarLetter: string;

  /** First name only — for greetings. */
  firstName: string;

  /** Computed display stats derived from the profile. */
  stats: ProfileStats;

  /** Persists a partial profile update. Optimistic — rolls back on failure. */
  updateProfile: (patch: Partial<Omit<UserProfile, 'id' | 'email' | 'createdAt'>>) => Promise<void>;

  /** Re-fetches the latest profile from the server. */
  refreshProfile: () => Promise<void>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function computeStats(profile: UserProfile | null): ProfileStats {
  if (!profile) {
    return { dailyCalories: null, proteinGrams: null, weightDisplay: null, heightDisplay: null };
  }

  const { weightKg, heightCm, unit, calorieBudget, tdee } = profile;

  const dailyCalories = calorieBudget ?? tdee ?? null;

  // 0.8 g protein per lb of bodyweight (common default)
  const weightLbs    = weightKg * LB_PER_KG;
  const proteinGrams = Math.round(weightLbs * 0.8);

  const weightDisplay  = formatWeightForStats(weightKg, unit);
  const heightDisplay  = formatHeightForStats(heightCm, unit);

  return { dailyCalories, proteinGrams, weightDisplay, heightDisplay };
}

// ── Context ────────────────────────────────────────────────────────────────

const ProfileContext = createContext<ProfileContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, status, updateProfile: authUpdateProfile } = useAuth();

  const isLoading = status === 'loading';

  const avatarUrl = user?.avatarUrl ?? null;

  const avatarLetter = useMemo(
    () => (user?.name?.trim()[0] ?? '?').toUpperCase(),
    [user?.name],
  );

  const firstName = useMemo(() => {
    if (!user?.name) return '';
    return user.name.trim().split(/\s+/)[0];
  }, [user?.name]);

  const stats = useMemo(() => computeStats(user), [user]);

  const updateProfile = useCallback(
    (patch: Partial<Omit<UserProfile, 'id' | 'email' | 'createdAt'>>) =>
      authUpdateProfile(patch),
    [authUpdateProfile],
  );

  /**
   * Forces a re-fetch of the profile from the server by calling GET /auth/me
   * through the auth layer's session-restore logic.
   * Implemented by triggering a lightweight re-mount of the auth effect via
   * a forced page reload isn't ideal in RN — instead we expose a direct fetch.
   */
  const refreshProfile = useCallback(async () => {
    // Delegate to updateProfile with an empty patch — the auth context
    // reconciles the server response and updates the user state.
    // For a true refresh we fetch /auth/me directly and merge.
    try {
      const res  = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api'}/auth/me`,
        { credentials: 'include' },
      );
      if (!res.ok) return;

      const body       = await res.json();
      const profileRow = (body.profile ?? body) as Record<string, unknown>;
      const authUser   = body.user   as Record<string, unknown> | undefined;

      // Merge via a no-op patch that carries the fresh server data.
      // We build only the fields updateProfile accepts.
      const fresh: Partial<Omit<UserProfile, 'id' | 'email' | 'createdAt'>> = {
        name:          (authUser?.name          ?? profileRow.name)          as string  | undefined,
        age:           (profileRow.age)                                      as number  | undefined,
        sex:           (profileRow.sex)                                      as UserProfile['sex'] | undefined,
        heightCm:      (profileRow.height_cm)                                as number  | undefined,
        weightKg:      (profileRow.weight_kg)                                as number  | undefined,
        activityLevel: (profileRow.activity_level)                           as UserProfile['activityLevel'] | undefined,
        goal:          (profileRow.goal)                                     as UserProfile['goal'] | undefined,
        unit:          normaliseProfileUnit(
          String(profileRow.unit ?? profileRow.distance_unit ?? ''),
        ),
        tdee:          typeof profileRow.tdee           === 'number' ? profileRow.tdee           : undefined,
        calorieBudget: typeof profileRow.calorie_budget === 'number' ? profileRow.calorie_budget : undefined,
      };

      await authUpdateProfile(fresh);
    } catch {
      // Silently ignore — stale data is better than a crash
    }
  }, [authUpdateProfile]);

  return (
    <ProfileContext.Provider value={{
      profile: user,
      isLoading,
      avatarUrl,
      avatarLetter,
      firstName,
      stats,
      updateProfile,
      refreshProfile,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
  return ctx;
}
