import { invalidateByPrefix } from '@/utils/resource-cache'

const PREFIXES = [
  'resource:',
  'daily-summary:',
  'insights:',
  '@roundfit/day_cache/',
] as const

/** Drop persisted API caches on logout (memory layers clear on process restart). */
export async function clearUserCachesOnLogout(): Promise<void> {
  await Promise.all(PREFIXES.map((prefix) => invalidateByPrefix(prefix)))
}
