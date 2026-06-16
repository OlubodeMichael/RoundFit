import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import type { UserProfile } from '@/context/auth-context';
import { prefetchAvatarImage } from '@/utils/avatar-image-cache';
import { formatHeightForStats, formatWeightForStats } from '@/utils/body-units';
import { resolveProteinTargetG } from '@/utils/nutrition';

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
  updateProfile: (patch: Partial<Omit<UserProfile, 'id' | 'email' | 'createdAt'>>) => Promise<boolean>;

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

  // Single source of truth with the home screen: a manually-set protein target
  // if present, else the goal-aware calculated value.
  const proteinGrams = resolveProteinTargetG(
    {
      sex:           profile.sex,
      age:           profile.age,
      heightCm:      profile.heightCm,
      weightKg:      profile.weightKg,
      activityLevel: profile.activityLevel,
      goal:          profile.goal,
    },
    profile.proteinTarget,
  );

  const weightDisplay  = formatWeightForStats(weightKg, unit);
  const heightDisplay  = formatHeightForStats(heightCm, unit);

  return { dailyCalories, proteinGrams, weightDisplay, heightDisplay };
}

// ── Context ────────────────────────────────────────────────────────────────

const ProfileContext = createContext<ProfileContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const {
    user,
    status,
    updateProfile: authUpdateProfile,
    refreshUser: authRefreshUser,
  } = useAuth();

  const isLoading = status === 'loading';

  const avatarUrl = user?.avatarUrl ?? null;

  useEffect(() => {
    prefetchAvatarImage(avatarUrl);
  }, [avatarUrl]);

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

  /** GET /auth/me with Bearer token — includes `avatar_url` from `users`. */
  const refreshProfile = useCallback(async () => {
    await authRefreshUser();
  }, [authRefreshUser]);

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
