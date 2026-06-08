import AsyncStorage from '@react-native-async-storage/async-storage'

const SLEEP_KEY = '@roundfit/sleep_target_hours'
const STEPS_KEY = '@roundfit/steps_target'

export interface LocalTargets {
  steps_target: number | null
  sleep_target: number | null
}

let memoryCache: LocalTargets | null = null

export async function getLocalTargets(): Promise<LocalTargets> {
  const [sleepRaw, stepsRaw] = await Promise.all([
    AsyncStorage.getItem(SLEEP_KEY),
    AsyncStorage.getItem(STEPS_KEY),
  ])
  const result: LocalTargets = {
    sleep_target: sleepRaw !== null ? parseFloat(sleepRaw) : null,
    steps_target: stepsRaw !== null ? parseInt(stepsRaw, 10) : null,
  }
  memoryCache = result
  return result
}

/** Persist sleep/steps targets and update the in-memory cache immediately. */
export async function setLocalTargets(sleep: number, steps: number): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(SLEEP_KEY, String(sleep)),
    AsyncStorage.setItem(STEPS_KEY, String(steps)),
  ])
  memoryCache = { sleep_target: sleep, steps_target: steps }
}

export function getCachedLocalTargets(): LocalTargets | null {
  return memoryCache
}
