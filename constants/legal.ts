/**
 * Hosted legal pages.
 *
 * App Review walks the sign-up consent flow and expects "Terms" / "Privacy
 * Policy" to be tappable wherever they are named, so every call site (auth
 * sheet, onboarding sign-up, profile) reads these from here rather than
 * re-declaring the URLs.
 */
export const PRIVACY_URL = 'https://roundfit.co/privacy';
export const TERMS_URL = 'https://roundfit.co/terms';
