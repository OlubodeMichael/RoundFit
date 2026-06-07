import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useCallback, useState } from 'react';

import {
  NavRow,
  Section,
  SettingsScreen,
  useSettingsPalette,
} from '@/components/profile/settings-ui';
import { ThemeSegmentPicker } from '@/components/profile/ThemeSegmentPicker';
import { useTheme } from '@/hooks/use-theme';

const NOTIFICATIONS_ENABLED_KEY = '@roundfit/notification_enabled_v1';

export default function PreferencesScreen() {
  const P = useSettingsPalette();
  const router = useRouter();
  const { preference, setTheme } = useTheme();
  const [notificationsDisplay, setNotificationsDisplay] = useState('—');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const raw = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
        if (cancelled) return;
        if (!raw) { setNotificationsDisplay('Off'); return; }
        try {
          const parsed = JSON.parse(raw) as Record<string, boolean>;
          setNotificationsDisplay(Object.values(parsed).some(Boolean) ? 'On' : 'Off');
        } catch {
          setNotificationsDisplay('Off');
        }
      })();
      return () => { cancelled = true; };
    }, []),
  );

  return (
    <SettingsScreen title="Preferences" subtitle="Notifications and appearance.">
      <Section label="Notifications" P={P}>
        <NavRow
          icon={Bell}
          color="#3B82F6"
          label="Notifications"
          value={notificationsDisplay}
          P={P}
          onPress={() => router.push('/(tabs)/profile/notifications')}
        />
      </Section>

      <Section label="Appearance" P={P}>
        <ThemeSegmentPicker value={preference} onChange={setTheme} P={P} />
      </Section>
    </SettingsScreen>
  );
}
