import type { DailyCoachingDecision } from '@/types/daily-coaching';
import { buildPhrasingPrompt } from '@/utils/coaching-prompt';
import { renderCoachingTemplate, coachingTitle } from '@/utils/coaching-template';
import { PHRASING_SYSTEM_PROMPT } from '@/constants/coaching-prompt';

export type CoachingMessageSource = 'apple_fm' | 'openai' | 'template';

export interface CoachingMessage {
  title: string;
  message: string;
  source: CoachingMessageSource;
}

/** Injected phrasing backends — mocked in tests, real in the hook. */
export interface CoachingPhraser {
  /** True when the on-device model can run right now. */
  appleAvailable: () => boolean;
  /** Phrase on-device. Resolves null / throws → fall through. */
  generateOnDevice: (systemPrompt: string, userPrompt: string) => Promise<{ title: string; message: string } | null>;
  /** Phrase via the OpenAI backend. Resolves null / throws (e.g. offline) → fall through. */
  phraseViaOpenAI: (decisionPrompt: string) => Promise<{ title: string; message: string } | null>;
}

/**
 * Resolves the final coaching message through the fallback chain:
 *   Apple FM (on-device, offline-capable) → OpenAI (cloud) → renderCoachingTemplate.
 *
 * The template branch always succeeds and is fully local, so the user NEVER sees a
 * blank card — even fully offline on an ineligible device. Single response, no streaming.
 */
export async function resolveCoachingMessage(
  decision: DailyCoachingDecision,
  phraser: CoachingPhraser,
): Promise<CoachingMessage> {
  const userPrompt = buildPhrasingPrompt(decision);

  if (phraser.appleAvailable()) {
    try {
      const r = await phraser.generateOnDevice(PHRASING_SYSTEM_PROMPT, userPrompt);
      if (r?.message?.trim()) return { title: r.title, message: r.message, source: 'apple_fm' };
    } catch {
      // fall through to OpenAI
    }
  }

  try {
    const r = await phraser.phraseViaOpenAI(userPrompt);
    if (r?.message?.trim()) return { title: r.title, message: r.message, source: 'openai' };
  } catch {
    // fall through to the deterministic template
  }

  return {
    title: coachingTitle(decision),
    message: renderCoachingTemplate(decision),
    source: 'template',
  };
}
