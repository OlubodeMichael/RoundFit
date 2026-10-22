import { useCallback } from 'react';

import { useAuth } from '@/hooks/use-auth';
import type { OnboardingRouteParams } from '@/utils/onboarding-profile';

type NameStepRoute =
  | { pathname: '/onboarding/name'; params: OnboardingRouteParams }
  | { pathname: '/onboarding/reveal'; params: OnboardingRouteParams };

/**
 * Route for the step after Apple Health. A user already signed in with Apple
 * or Google that shared a first name skips the name question: App Review
 * rejects asking for a name the provider already supplied.
 */
export function useNameStepRoute(): (params: OnboardingRouteParams) => NameStepRoute {
  const { profileSetupPending, socialFirstName } = useAuth();

  return useCallback(
    (params: OnboardingRouteParams): NameStepRoute =>
      profileSetupPending && socialFirstName
        ? { pathname: '/onboarding/reveal', params: { ...params, name: socialFirstName } }
        : { pathname: '/onboarding/name', params },
    [profileSetupPending, socialFirstName],
  );
}
