import { useRouter } from 'expo-router';

import { RoundFitPaywall } from '@/components/paywall/RoundFitPaywall';

export default function NewPaywallPreviewScreen() {
  const router = useRouter();

  return (
    <RoundFitPaywall
      annualPrice="$89.99"
      annualMonthlyPrice="$7.50"
      monthlyPrice="$14.99"
      annualBadge="SAVE 50%"
      preview
      onClose={() => router.back()}
      onContinue={() => {}}
    />
  );
}
