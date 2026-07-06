import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

// Why unavailable — mirrors Foundation Models' availability reasons plus a few
// JS-side ones. Callers route to the OpenAI fallback on anything but `available`.
export type AppleLLMUnavailableReason =
  | 'deviceNotEligible'           // hardware can't run Apple Intelligence
  | 'appleIntelligenceNotEnabled' // user hasn't turned it on
  | 'modelNotReady'               // model still downloading / preparing
  | 'unsupportedOS'               // iOS < 26
  | 'moduleMissing'               // native module absent (Android, stale binary)
  | 'unknown';

export interface AppleLLMAvailability {
  available: boolean;
  reason?: AppleLLMUnavailableReason;
}

export type CoachingFocus =
  | 'nutrition'
  | 'training'
  | 'recovery'
  | 'hydration'
  | 'consistency';

export interface DailyCoachingResult {
  title: string;
  message: string;
  focus: CoachingFocus;
}

interface NativeModule {
  isAvailable(): AppleLLMAvailability;
  generate(systemPrompt: string, userPrompt: string): Promise<DailyCoachingResult>;
  prewarm?(): Promise<void>;
}

const Native =
  Platform.OS === 'ios'
    ? (requireOptionalNativeModule('AppleLLM') as NativeModule | null)
    : null;

/**
 * Synchronous capability check — the routing source of truth. Returns
 * `{ available: false, reason: 'moduleMissing' }` on Android or when the native
 * binary predates this module (stale simulator/dev build).
 */
export function isAppleLLMAvailable(): AppleLLMAvailability {
  if (!Native) return { available: false, reason: 'moduleMissing' };
  try {
    return Native.isAvailable();
  } catch {
    return { available: false, reason: 'unknown' };
  }
}

/**
 * Generate a daily coaching insight on-device. Resolves `null` when the native
 * module is absent (caller should fall back to the OpenAI path). Throws if
 * on-device generation itself fails — caller should catch and fall back.
 */
export async function generateDailyCoaching(
  systemPrompt: string,
  userPrompt: string,
): Promise<DailyCoachingResult | null> {
  if (!Native) return null;
  return Native.generate(systemPrompt, userPrompt);
}

/** Best-effort model warm-up to cut first-token latency. Never throws. */
export async function prewarmAppleLLM(): Promise<void> {
  try {
    await Native?.prewarm?.();
  } catch {
    // best effort — ignore
  }
}
