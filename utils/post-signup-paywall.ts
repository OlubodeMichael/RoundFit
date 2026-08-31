/**
 * One-shot "this session just created an account" signal.
 *
 * The paywall sits between sign-up and the home screen, so the router gate in
 * `app/_layout.tsx` needs to distinguish a brand-new account from a returning
 * log-in. A returning user goes straight to the app (unless `PAYWALL_ENABLED`
 * gates them); a new account sees the paywall exactly once.
 *
 * Deliberately module state rather than React state: account creation resolves
 * the auth status in the same tick the gate reads it, so a `setState` would
 * land a render too late — the redirect to `/(tabs)` would already have fired
 * and the paywall would be skipped. A module flag is readable synchronously.
 *
 * Not persisted. A cold start is never "just signed up".
 */
let justSignedUp = false;

/** Called from the auth context wherever a new account is successfully created. */
export function markJustSignedUp() {
  justSignedUp = true;
}

/** True while a sign-up is awaiting its paywall. Does not clear the flag. */
export function isAwaitingSignupPaywall(): boolean {
  return justSignedUp;
}

/** Reads and clears — the paywall is shown once, not on every render pass. */
export function consumeSignupPaywall(): boolean {
  if (!justSignedUp) return false;
  justSignedUp = false;
  return true;
}

/** Clears without consuming, for sign-out and abandoned sign-up flows. */
export function clearSignupPaywall() {
  justSignedUp = false;
}
