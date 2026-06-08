import AsyncStorage from '@react-native-async-storage/async-storage'

import { ACTIVE_WORKOUT_SESSION_KEY } from '@/context/workout-session-context'
import {
  HEALTHKIT_WORKOUT_CURSOR_KEY,
  IMPORTED_UUIDS_KEY,
} from '@/services/workout-import'
import { WORKOUT_RECENT_ACTIVITY_IDS_KEY } from '@/utils/workout-recent'
import { invalidateByPrefix } from '@/utils/resource-cache'

const PREFIXES = [
  'resource:',
  'daily-summary:',
  'insights:',
  '@roundfit/day_cache/',
  '@roundfit/auth_user',
] as const

const EXACT_LOGOUT_KEYS = [
  ACTIVE_WORKOUT_SESSION_KEY,
  HEALTHKIT_WORKOUT_CURSOR_KEY,
  IMPORTED_UUIDS_KEY,
  WORKOUT_RECENT_ACTIVITY_IDS_KEY,
] as const

/** Drop persisted API caches on logout (memory layers clear on process restart). */
export async function clearUserCachesOnLogout(): Promise<void> {
  await Promise.all([
    ...PREFIXES.map((prefix) => invalidateByPrefix(prefix)),
    AsyncStorage.multiRemove([...EXACT_LOGOUT_KEYS]),
  ])
}
