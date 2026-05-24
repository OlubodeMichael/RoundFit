import Constants from 'expo-constants';

/** Deep link Supabase redirects to after Google OAuth (must match dashboard allow list). */
export const OAUTH_REDIRECT_URL = 'roundfit://auth/callback';

/** iOS bundle ID for the running build (Expo Go → host.exp.Exponent). */
export function getIosBundleIdentifier(): string | undefined {
  return Constants.expoConfig?.ios?.bundleIdentifier;
}

export type OAuthCallbackTokens = {
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
  errorDescription: string | null;
};

/** Parses tokens or errors from Supabase implicit-flow redirect URLs. */
export function parseOAuthCallbackUrl(url: string): OAuthCallbackTokens {
  const hashIdx = url.indexOf('#');
  const queryIdx = url.indexOf('?');

  const hashParams =
    hashIdx >= 0 ? new URLSearchParams(url.slice(hashIdx + 1)) : null;
  const queryParams =
    queryIdx >= 0
      ? new URLSearchParams(
          url.slice(queryIdx + 1, hashIdx >= 0 ? hashIdx : undefined),
        )
      : null;

  const params = hashParams ?? queryParams;

  return {
    accessToken: params?.get('access_token') ?? null,
    refreshToken: params?.get('refresh_token') ?? null,
    error: params?.get('error') ?? null,
    errorDescription: params?.get('error_description') ?? null,
  };
}

export function isAppleAudienceError(message: string | undefined): boolean {
  return Boolean(message?.includes('Unacceptable audience in id_token'));
}
