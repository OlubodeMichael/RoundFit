import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { CheckCircle2, Flower2, Heart, Watch } from 'lucide-react-native';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePostHog } from 'posthog-react-native';

import {
  IconBox,
  NavRow,
  Section,
  SettingsScreen,
  useSettingsPalette,
} from '@/components/profile/settings-ui';
import { useHealth } from '@/hooks/use-health';
import { useProfile } from '@/hooks/use-profile';

const HEALTH_KEY = '@roundfit/health_connected';
const HEALTH_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierHeight',
  'HKWorkoutTypeIdentifier',
] as const;

export default function HealthScreen() {
  const P = useSettingsPalette();
  const router = useRouter();
  const posthog = usePostHog();
  const { profile } = useProfile();
  const { isConnected: healthConnected } = useHealth();

  const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

  async function handleHealthConnect() {
    if (isExpoGo) { Alert.alert('Not available in Expo Go', 'Build the app to connect Apple Health.'); return; }
    if (Platform.OS !== 'ios') return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Healthkit = require('@kingstinct/react-native-healthkit');
      const isAvailable = await Healthkit.isHealthDataAvailable();
      if (!isAvailable) { Alert.alert('Not Available', 'Apple Health is not available on this device.'); return; }
      await Healthkit.requestAuthorization({ toRead: HEALTH_TYPES });
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem(HEALTH_KEY, 'true');
      posthog.capture('health_connected', { platform: 'apple_health' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not connect', msg || 'Allow access in Settings → Health → RoundFit.');
    }
  }

  return (
    <SettingsScreen title="Health & Devices" subtitle="Connect your health data and devices.">
      {Platform.OS === 'ios' && (
        <Section label="Apple Health" P={P}>
          <TouchableOpacity
            style={s.healthRow}
            activeOpacity={healthConnected ? 1 : 0.7}
            onPress={healthConnected ? undefined : handleHealthConnect}
          >
            <IconBox Icon={Heart} P={P} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, { color: P.text }]}>Apple Health</Text>
              <Text style={[s.rowSub, { color: P.dim }]}>
                {healthConnected ? 'Syncing steps, calories & workouts' : 'Tap to connect your Health data'}
              </Text>
            </View>
            {healthConnected ? (
              <View style={s.connectedBadge}>
                <CheckCircle2 size={18} color="#22C55E" strokeWidth={2.4} />
                <Text style={[s.connectedText, { color: '#22C55E' }]}>Connected</Text>
              </View>
            ) : (
              <View style={[s.connectPill, { backgroundColor: P.accent }]}>
                <Text style={[s.connectPillText, { color: '#FFF' }]}>Connect</Text>
              </View>
            )}
          </TouchableOpacity>
        </Section>
      )}

      <Section label="Devices" P={P}>
        <NavRow
          icon={Watch}
          color="#0EA5E9"
          label="Wearable"
          P={P}
          onPress={() => router.push('/(tabs)/profile/wearable')}
        />
      </Section>

      {profile?.sex === 'female' && (
        <Section label="Tracking" P={P}>
          <NavRow
            icon={Flower2}
            color="#FB7185"
            label="Cycle Tracking"
            P={P}
            onPress={() => router.push('/(tabs)/profile/cycle')}
          />
        </Section>
      )}
    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowLabel:  { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  rowSub:    { fontSize: 12, marginTop: 1 },
  connectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  connectedText:  { fontSize: 13, fontWeight: '600' },
  connectPill:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  connectPillText: { fontSize: 13, fontWeight: '700' },
});
