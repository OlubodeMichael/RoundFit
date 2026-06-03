import AsyncStorage from '@react-native-async-storage/async-storage'

import type { UserProfile } from '@/context/auth-context'

// Shares the `@roundfit/auth_user` prefix so clearUserCachesOnLogout wipes it.
const AUTH_USER_KEY = '@roundfit/auth_user_v1'

/**
 * Persisted snapshot of the authenticated user profile. Lets the app paint an
 * authenticated session instantly on cold start and revalidate /auth/me in the
 * background, instead of blocking the splash on the network every launch.
 */
export async function readCachedAuthUser(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UserProfile
    return typeof parsed?.id === 'string' && parsed.id.length > 0 ? parsed : null
  } catch {
    return null
  }
}

export async function writeCachedAuthUser(user: UserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
  } catch {
    /* best-effort */
  }
}

export async function clearCachedAuthUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTH_USER_KEY)
  } catch {
    /* best-effort */
  }
}
