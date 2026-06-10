import { sha256 } from "js-sha256";

/**
 * Random UUID v4 for Apple Sign-In / Supabase id_token nonce.
 * Requires `crypto.getRandomValues` (always present on Hermes). A Math.random
 * fallback would produce a predictable nonce and silently weaken the replay
 * protection the nonce exists for — failing loudly is the safe behavior.
 */
function generateRandomNonce(): string {
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error(
      "crypto.getRandomValues unavailable — cannot generate a secure Apple Sign-In nonce",
    );
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
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
