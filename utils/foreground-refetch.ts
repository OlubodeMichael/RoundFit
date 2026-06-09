import { TTL_FOREGROUND_SKIP_MS } from '@/utils/daily-summary-cache'

export interface ForegroundRefetchInput {
  lastFetchAt: number
  /** True only when the calendar day changed since the last successful load. */
  dayRolled: boolean
  skipMs?: number
  /** False until the provider finishes its initial cache-first boot. */
  booted?: boolean
}

/** Whether a foreground resume should trigger a network refetch. */
export function shouldRefetchOnForeground({
  lastFetchAt,
  dayRolled,
  skipMs = TTL_FOREGROUND_SKIP_MS,
  booted = true,
}: ForegroundRefetchInput): boolean {
  if (!booted) return false
  if (dayRolled) return true
  if (lastFetchAt <= 0) return false
  return Date.now() - lastFetchAt > skipMs
}
