import { TTL_FOREGROUND_SKIP_MS } from '@/utils/daily-summary-cache'

export interface ForegroundRefetchInput {
  lastFetchAt: number
  dayRolled: boolean
  skipMs?: number
}

/** Whether a foreground resume should trigger a network refetch. */
export function shouldRefetchOnForeground({
  lastFetchAt,
  dayRolled,
  skipMs = TTL_FOREGROUND_SKIP_MS,
}: ForegroundRefetchInput): boolean {
  if (dayRolled) return true
  if (lastFetchAt <= 0) return true
  return Date.now() - lastFetchAt > skipMs
}
