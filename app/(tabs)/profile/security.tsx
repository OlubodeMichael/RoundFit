import { useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import {
  NavRow,
  Section,
  SettingsScreen,
  useSettingsPalette,
} from '@/components/profile/settings-ui';
import { isStoredTokenOAuth } from '@/utils/api';

export default function SecurityScreen() {
  const P = useSettingsPalette();
  const router = useRouter();

  // OAuth users have no password, so "Change password" can't work for them.
  const [isOAuthAccount, setIsOAuthAccount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isStoredTokenOAuth().then((v) => { if (!cancelled) setIsOAuthAccount(v); });
    return () => { cancelled = true; };
  }, []);

  return (
    <SettingsScreen title="Password & Security" subtitle="Manage your password and sign-in.">
      <Section label="Security" P={P}>
        {isOAuthAccount ? (
          <Text style={[s.note, { color: P.dim }]}>
            Your password is managed by your sign-in provider.
          </Text>
        ) : (
          <NavRow
            icon={Lock}
            color="#818CF8"
            label="Change Password"
            P={P}
            onPress={() => router.push('/auth/change-password')}
          />
        )}
      </Section>
    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  note: { fontSize: 14, lineHeight: 20, paddingHorizontal: 16, paddingVertical: 16 },
});
