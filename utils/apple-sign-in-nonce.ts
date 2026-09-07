import * as Crypto from "expo-crypto";
import { sha256 } from "js-sha256";

/**
 * Random UUID v4 for Apple Sign-In / Supabase id_token nonce.
 *
 * Uses expo-crypto's native CSPRNG. `globalThis.crypto.getRandomValues` is not
 * reliably present across React Native runtimes, and a Math.random fallback
 * would produce a predictable nonce, silently weakening the replay protection
 * the nonce exists for — failing loudly is the safe behavior.
 */
function generateRandomNonce(): string {
  return Crypto.randomUUID();
}

/** Apple Sign-In nonce pair: raw value for Supabase, SHA-256 hex for Apple. */
export function createAppleSignInNonce(): {
  rawNonce: string;
  hashedNonce: string;
} {
  const rawNonce = generateRandomNonce();
  const hashedNonce = sha256(rawNonce);
  return { rawNonce, hashedNonce };
}
