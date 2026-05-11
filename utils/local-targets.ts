import AsyncStorage from '@react-native-async-storage/async-storage'

const SLEEP_KEY = '@roundfit/sleep_target_hours'
const STEPS_KEY = '@roundfit/steps_target'

export interface LocalTargets {
  steps_target: number | null
  sleep_target: number | null
}

export async function getLocalTargets(): Promise<LocalTargets> {
  const [sleepRaw, stepsRaw] = await Promise.all([
    AsyncStorage.getItem(SLEEP_KEY),
    AsyncStorage.getItem(STEPS_KEY),
  ])
  return {
    sleep_target: sleepRaw !== null ? parseFloat(sleepRaw) : null,
    steps_target: stepsRaw !== null ? parseInt(stepsRaw, 10) : null,
  }
}
