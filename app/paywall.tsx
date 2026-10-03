import { RoundFitPaywall, type PaywallPlan } from '@/components/paywall/RoundFitPaywall';
import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import { useSubscription } from '@/context/subscription-context';
import { isPurchasesConfigured } from '@/lib/purchases';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { useEffect, useMemo, useState } from 'react';
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  PACKAGE_TYPE,
  type PurchasesPackage,
} from 'react-native-purchases';

function isUserCancelled(error: unknown): boolean {
  return !!(
    error &&
    typeof error === 'object' &&
    'userCancelled' in error &&
    error.userCancelled
  );
}

function packageForType(
  packages: PurchasesPackage[],
  type: PACKAGE_TYPE,
  identifierHint: string,
) {
  return (
    packages.find((pkg) => pkg.packageType === type) ??
    packages.find((pkg) => pkg.identifier.toLowerCase().includes(identifierHint))
  );
}

export default function HardPaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string }>();
  const posthog = usePostHog();
  const { status: authStatus, user } = useAuth();
  const { status, offerings, offeringsUnavailable, purchase, restore } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [annualTrialEligible, setAnnualTrialEligible] = useState(false);

  const signedIn = hasActiveUserSession(authStatus, user);
  const openedFromSettings = params.source === 'settings';
  const packages = useMemo(
    () => offerings?.current?.availablePackages ?? [],
    [offerings],
  );
  const annual = useMemo(
    () => packageForType(packages, PACKAGE_TYPE.ANNUAL, 'annual'),
    [packages],
  );
  const monthly = useMemo(
    () => packageForType(packages, PACKAGE_TYPE.MONTHLY, 'monthly'),
    [packages],
  );

  const proceed = () => {
    if (openedFromSettings) {
      router.back();
      return;
    }
    if (signedIn) router.replace('/(tabs)');
    else router.push({ pathname: '/auth/sign-up-options', params } as never);
  };

  useEffect(() => {
    posthog.capture('paywall_viewed', {
      source: openedFromSettings ? 'settings' : signedIn ? 'trial_expired' : 'onboarding',
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!annual || !isPurchasesConfigured()) {
      setAnnualTrialEligible(false);
      return;
    }

    let cancelled = false;
    Purchases.checkTrialOrIntroductoryPriceEligibility([annual.product.identifier])
      .then((eligibility) => {
        if (cancelled) return;
        setAnnualTrialEligible(
          eligibility[annual.product.identifier]?.status ===
            INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE,
        );
      })
      .catch(() => {
        if (!cancelled) setAnnualTrialEligible(false);
      });

    return () => {
      cancelled = true;
    };
  }, [annual]);

  const savings = useMemo(() => {
    if (!annual || !monthly || monthly.product.price <= 0) return null;
    const percent = Math.round((1 - annual.product.price / (monthly.product.price * 12)) * 100);
    return percent > 0 ? `SAVE ${percent}%` : null;
  }, [annual, monthly]);

  const handlePurchase = async (plan: PaywallPlan) => {
    const selectedPackage = plan === 'annual' ? annual : monthly;
    if (!selectedPackage) {
      setMessage('That plan is temporarily unavailable.');
      return;
    }

    setPurchasing(true);
    setMessage(null);
    posthog.capture('purchase_started', { plan, product_id: selectedPackage.product.identifier });

    try {
      const entitled = await purchase(selectedPackage);
      if (!entitled) {
        setMessage('We could not confirm your subscription. Please try again.');
        return;
      }
      posthog.capture('purchase_completed', {
        plan,
        product_id: selectedPackage.product.identifier,
        price: selectedPackage.product.price,
        currency: selectedPackage.product.currencyCode,
      });
      proceed();
    } catch (error) {
      if (!isUserCancelled(error)) {
        posthog.capture('purchase_failed', {
          plan,
          reason: error instanceof Error ? error.message : 'unknown',
        });
        setMessage('Purchase could not be completed. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    setMessage(null);
    try {
      const restored = await restore();
      posthog.capture('restore_completed', { found: restored });
      if (restored) proceed();
      else setMessage('No active purchase was found.');
    } catch (error) {
      posthog.capture('restore_failed', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      setMessage('Restore could not be completed. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const plansUnavailable =
    !isPurchasesConfigured() || status === 'loading' || !annual || !monthly;

  // Order matters: `offeringsUnavailable` means the fetch settled with nothing to
  // sell, which otherwise reads as a permanent "Loading plans…". When it is set
  // the router gate stands down, so Close genuinely leaves the paywall and the
  // copy has to say so.
  const unavailableMessage = !isPurchasesConfigured()
    ? 'Subscriptions are unavailable on this build.'
    : offeringsUnavailable
      ? 'Plans are unavailable right now. You can keep using the app and subscribe later.'
      : status === 'loading' || !offerings
        ? 'Loading plans…'
        : !annual || !monthly
          ? 'Plans are temporarily unavailable.'
          : null;

  return (
    <RoundFitPaywall
      annualPrice={annual?.product.priceString ?? '—'}
      annualMonthlyPrice={annual?.product.pricePerMonthString}
      monthlyPrice={monthly?.product.priceString ?? '—'}
      annualBadge={savings ?? undefined}
      annualHasTrial={annualTrialEligible}
      purchasing={purchasing}
      purchaseDisabled={plansUnavailable}
      message={message ?? unavailableMessage}
      onClose={proceed}
      onContinue={(plan) => void handlePurchase(plan)}
      onRestore={() => void handleRestore()}
    />
  );
}
