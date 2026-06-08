import { sha256 } from "js-sha256";

/**
 * Random UUID v4 for Apple Sign-In / Supabase id_token nonce.
 * Uses `crypto.getRandomValues` when available (Hermes), otherwise Math.random.
 */
function generateRandomNonce(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
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
