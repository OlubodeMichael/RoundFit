import { useRouter } from 'expo-router';
import { Receipt, Star } from 'lucide-react-native';
import { Linking, Platform } from 'react-native';

import {
  Divider,
  NavRow,
  Section,
  SettingsScreen,
  useSettingsPalette,
} from '@/components/profile/settings-ui';
import { useIsPremium } from '@/hooks/use-is-premium';

const MANAGE_SUBSCRIPTION_URL = Platform.select({
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
  default: 'https://apps.apple.com/account/subscriptions',
});

export default function SubscriptionScreen() {
  const P = useSettingsPalette();
  const router = useRouter();
  // Offering "Upgrade to Premium" to someone who already pays reads as a bug,
  // so the row only exists while there is something to upgrade to.
  const isPremium = useIsPremium();

  return (
    <SettingsScreen title="Subscription" subtitle="Manage your plan and billing.">
      <Section label="Subscription" P={P}>
        <NavRow
          icon={Receipt}
          color="#FBBF24"
          label="Manage Subscription"
          P={P}
          onPress={() => Linking.openURL(MANAGE_SUBSCRIPTION_URL)}
        />
        {!isPremium && (
          <>
            <Divider P={P} inset={64} />
            <NavRow
              icon={Star}
              color="#F59E0B"
              label="Upgrade to Premium"
              P={P}
              onPress={() => router.push('/(tabs)/profile/paywall')}
            />
          </>
        )}
      </Section>
    </SettingsScreen>
  );
}
