/**
 * Upgrade path from Settings → Subscription.
 *
 * Renders the same RevenueCat-hosted paywall as the onboarding gate
 * (`app/paywall.tsx`), so pricing and copy stay in one place — the dashboard
 * offering — rather than drifting between two screens.
 *
 * Differs from the hard gate in how it exits: this screen is entered
 * deliberately by an existing user, so every outcome returns them to Settings
 * instead of routing into the app or on to sign-up.
 */
import { useSubscription } from '@/context/subscription-context';
import { isPurchasesConfigured } from '@/lib/purchases';
import { useTheme } from '@/hooks/use-theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RevenueCatUI from 'react-native-purchases-ui';

export default function SettingsPaywallScreen() {
  const router = useRouter();
  const posthog = usePostHog();
  const { refresh } = useSubscription();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const configured = isPurchasesConfigured();

  useEffect(() => {
    posthog.capture('paywall_viewed', { source: 'settings' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => router.back();

  // No SDK key (or non-iOS) — RevenueCatUI cannot render. Give an explicit state
  // and a way out rather than a blank screen.
  if (!configured) {
    const bg = isDark ? '#0A0B0F' : '#F7F7F5';
    const hi = isDark ? '#F4F4F5' : '#0C0C0C';
    const mid = isDark ? '#909096' : '#888';
    return (
      <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.back} onPress={close} hitSlop={10}>
          <Ionicons name="close" size={22} color={hi} />
        </TouchableOpacity>
        <Text style={[s.eyebrow, { color: mid }]}>Go Premium</Text>
        <Text style={[s.title, { color: hi }]}>Plans are unavailable</Text>
        <Text style={[s.sub, { color: mid }]}>
          Subscriptions aren&apos;t available on this build. Please try again from
          a later version.
        </Text>
      </View>
    );
  }

  return (
    <RevenueCatUI.Paywall
      onPurchaseCompleted={async () => {
        posthog.capture('purchase_completed', { source: 'settings' });
        await refresh();
        close();
      }}
      onPurchaseError={({ error }) => {
        posthog.capture('purchase_failed', {
          source: 'settings',
          reason: error?.message ?? 'unknown',
        });
      }}
      onRestoreCompleted={async () => {
        posthog.capture('restore_completed', { source: 'settings' });
        await refresh();
        close();
      }}
      onDismiss={close}
    />
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, paddingHorizontal: 20 },
  back:    { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginBottom: 6 },
  eyebrow: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  title:   { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 3 },
  sub:     { fontSize: 14, marginTop: 12, lineHeight: 20 },
});
