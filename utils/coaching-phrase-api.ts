import { apiFetch } from '@/utils/api';

export interface CoachingPhraseResult {
  title: string;
  message: string;
}

/**
 * Cloud phrasing path — POST /insights/coaching/phrase under the phrasing system
 * prompt (premium-gated, alongside /insights/ai/*). Returns null on any failure so
 * the caller falls through to the template.
 */
export async function phraseCoachingViaOpenAI(
  decisionPrompt: string,
): Promise<CoachingPhraseResult | null> {
  const { ok, body } = await apiFetch('/insights/coaching/phrase', {
    method: 'POST',
    body: JSON.stringify({ decisionPrompt }),
  });

  if (!ok) return null;

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return null;

  return { title: title || 'Today', message };
}
