import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { useHealth } from '@/hooks/use-health';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ── Palette ────────────────────────────────────────────────────────────────

function usePalette() {
  const { isDark } = useTheme();
  return isDark ? {
    bg:       '#0A0B0F',
    card:     '#1C1D23',
    sunken:   '#0E0F13',
    edge:     'rgba(255,255,255,0.08)',
    hair:     'rgba(255,255,255,0.06)',
    text:     '#F4F4F5',
    dim:      '#909096',
    faint:    '#505058',
    accent:   '#F97316',
    isDark:   true,
  } : {
    bg:       '#F2F2F6',
    card:     '#FFFFFF',
    sunken:   '#F7F7F9',
    edge:     'rgba(0,0,0,0.06)',
    hair:     'rgba(0,0,0,0.05)',
    text:     '#09090B',
    dim:      '#6B7280',
    faint:    '#C0C0C8',
    accent:   '#F97316',
    isDark:   false,
  };
}

const GOAL_LABELS: Record<string, string> = {
  lose_weight:  'Lose weight',
  build_muscle: 'Build muscle',
  boost_energy: 'Boost energy',
  maintain:     'Maintain',
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary:          'Sedentary',
  lightly_active:     'Lightly active',
  moderately_active:  'Moderately active',
  very_active:        'Very active',
};

const HEALTH_KEY = '@roundfit/health_connected';
const HEALTH_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierHeight',
  'HKWorkoutTypeIdentifier',
] as const; // used inside handleHealthConnect

// ── Screen ─────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const P = usePalette();
  const { isDark, preference, setTheme } = useTheme();
  const { signOut } = useAuth();
  const { profile, avatarUrl, avatarLetter, stats } = useProfile();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
  const { isConnected: healthConnected, syncFromDevice } = useHealth();

  const calorieDisplay  = stats.dailyCalories ? `${stats.dailyCalories.toLocaleString()} kcal` : '—';
  const proteinDisplay  = stats.proteinGrams ? `${stats.proteinGrams}g` : '—';
  const weightDisplay   = stats.weightDisplay ?? '—';
  const goalDisplay     = profile ? (GOAL_LABELS[profile.goal] ?? '—') : '—';
  const activityDisplay = profile ? (ACTIVITY_LABELS[profile.activityLevel] ?? '—') : '—';

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
      void syncFromDevice();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not connect', msg || 'Allow access in Settings → Health → RoundFit.');
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: P.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 64, gap: 8 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero header ─────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
        <View style={[s.heroCard, { backgroundColor: P.card, borderColor: P.edge }]}>
          {/* Avatar ring */}
          <View style={s.avatarRing}>
            <View style={[s.avatar, { backgroundColor: P.sunken }]}>
              {avatarUrl
                ? <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
                : <Text style={[s.avatarLetter, { color: P.accent }]}>{avatarLetter}</Text>
              }
            </View>
          </View>

          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.heroName, { color: P.text }]} numberOfLines={1}>
              {profile?.name || '—'}
            </Text>
            <Text style={[s.heroEmail, { color: P.dim }]} numberOfLines={1}>
              {profile?.email || '—'}
            </Text>
            {/* Inline chips */}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              {goalDisplay !== '—' && (
                <View style={[s.chip, { backgroundColor: P.sunken, borderColor: P.edge }]}>
                  <Text style={[s.chipText, { color: P.dim }]}>{goalDisplay}</Text>
                </View>
              )}
              {activityDisplay !== '—' && (
                <View style={[s.chip, { backgroundColor: P.sunken, borderColor: P.edge }]}>
                  <Text style={[s.chipText, { color: P.dim }]}>{activityDisplay}</Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[s.editBtn, { backgroundColor: 'rgba(249,115,22,0.10)', borderColor: 'rgba(249,115,22,0.25)' }]}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.75}
          >
            <Ionicons name="pencil" size={14} color={P.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Daily targets ───────────────────────────────────────────── */}
      <Section label="Daily Targets" P={P}>
        <Row
          icon="flame" iconBg="#FF7849" iconFg="#FFF"
          label="Calories" value={calorieDisplay}
          P={P}
        />
        <Divider P={P} />
        <Row
          icon="barbell" iconBg="#34D399" iconFg="#FFF"
          label="Protein" value={proteinDisplay}
          P={P}
        />
        <Divider P={P} />
        <Row
          icon="scale" iconBg="#A78BFA" iconFg="#FFF"
          label="Current Weight" value={weightDisplay}
          P={P}
        />
        <Divider P={P} />
        <Row
          icon="footsteps" iconBg="#38BDF8" iconFg="#FFF"
          label="Daily Steps" value="10,000"
          P={P}
          last
        />
      </Section>

      {/* ── Tracking ────────────────────────────────────────────────── */}
      <Section label="Tracking" P={P}>
        {profile?.sex === 'female' && (
          <>
            <NavRow
              icon="rose" iconBg="#FB7185" iconFg="#FFF"
              label="Cycle Tracking"
              P={P}
              onPress={() => router.push('/(tabs)/profile/cycle')}
            />
            <Divider P={P} />
          </>
        )}
        <NavRow
          icon="heart" iconBg="#EF4444" iconFg="#FFF"
          label="Wearable & Health"
          P={P}
          onPress={() => router.push('/(tabs)/profile/wearable')}
        />
        <Divider P={P} />
        <NavRow
          icon="notifications" iconBg="#60A5FA" iconFg="#FFF"
          label="Notifications"
          P={P}
          last
          onPress={() => router.push('/(tabs)/profile/notifications')}
        />
      </Section>

      {/* ── Subscription ────────────────────────────────────────────── */}
      <Section label="Subscription" P={P}>
        <NavRow
          icon="receipt" iconBg="#FBBF24" iconFg="#FFF"
          label="Manage Subscription"
          P={P}
          onPress={() => router.push('/(tabs)/profile/subscription')}
        />
        <Divider P={P} />
        <NavRow
          icon="star" iconBg="#F59E0B" iconFg="#FFF"
          label="Upgrade to Premium"
          labelColor="#F59E0B"
          P={P}
          last
          onPress={() => router.push('/(tabs)/profile/paywall')}
        />
      </Section>

      {/* ── Apple Health ────────────────────────────────────────────── */}
      {Platform.OS === 'ios' && (
        <Section label="Health" P={P}>
          <TouchableOpacity
            style={[s.rowBase, { paddingHorizontal: 16, paddingVertical: 14 }]}
            activeOpacity={healthConnected ? 1 : 0.7}
            onPress={healthConnected ? undefined : handleHealthConnect}
          >
            <IconBox bg="#EF4444" fg="#FFF" icon="heart" />
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, { color: P.text }]}>Apple Health</Text>
              <Text style={[s.rowSub, { color: healthConnected ? '#22C55E' : P.dim }]}>
                {healthConnected ? 'Connected · syncing steps, calories & workouts' : 'Tap to connect your Health data'}
              </Text>
            </View>
            {healthConnected ? (
              <View style={s.connectedBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                <Text style={s.connectedText}>Connected</Text>
              </View>
            ) : (
              <View style={[s.connectPill, { backgroundColor: P.accent }]}>
                <Text style={s.connectPillText}>Connect</Text>
              </View>
            )}
          </TouchableOpacity>
        </Section>
      )}

      {/* ── Appearance ──────────────────────────────────────────────── */}
      <Section label="Appearance" P={P}>
        <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
          {(['light', 'dark', 'system'] as const).map((p) => {
            const active = preference === p;
            const meta = {
              light:  { icon: 'sunny'    as IoniconsName, label: 'Light',  iconBg: '#FBBF24', iconFg: '#FFF' },
              dark:   { icon: 'moon'     as IoniconsName, label: 'Dark',   iconBg: '#818CF8', iconFg: '#FFF' },
              system: { icon: 'phone-portrait' as IoniconsName, label: 'System', iconBg: '#34D399', iconFg: '#FFF' },
            }[p];
            return (
              <TouchableOpacity
                key={p}
                onPress={() => setTheme(p)}
                style={[
                  s.themeTile,
                  { borderColor: active ? P.accent : P.edge, backgroundColor: active ? 'rgba(249,115,22,0.08)' : P.sunken },
                ]}
                activeOpacity={0.75}
              >
                <View style={[s.tileIconBox, { backgroundColor: active ? meta.iconBg : P.card, borderColor: P.edge }]}>
                  <Ionicons name={meta.icon} size={15} color={active ? meta.iconFg : P.dim} />
                </View>
                <Text style={[s.tileLabel, { color: active ? P.accent : P.dim, fontWeight: active ? '700' : '500' }]}>
                  {meta.label}
                </Text>
                {active && (
                  <View style={[s.tileDot, { backgroundColor: P.accent }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Section>

      {/* ── Account ─────────────────────────────────────────────────── */}
      <Section label="Account" P={P}>
        <NavRow
          icon="lock-closed" iconBg="#818CF8" iconFg="#FFF"
          label="Change Password"
          P={P}
          onPress={() => {}}
        />
        <Divider P={P} />
        <NavRow
          icon="cloud-upload" iconBg="#38BDF8" iconFg="#FFF"
          label="Export Data"
          P={P}
          onPress={() => {}}
        />
        <Divider P={P} />
        <NavRow
          icon="help-circle" iconBg="#2DD4BF" iconFg="#FFF"
          label="Help & Support"
          P={P}
          onPress={() => {}}
        />
        <Divider P={P} />
        <NavRow
          icon="log-out" iconBg="rgba(239,68,68,0.15)" iconFg="#EF4444"
          label="Sign Out"
          labelColor="#EF4444"
          P={P}
          last
          onPress={signOut}
          hideChevron
        />
      </Section>

      <Text style={[s.version, { color: P.faint }]}>RoundFit v1.0.0</Text>
    </ScrollView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

type P = ReturnType<typeof usePalette>;

function Section({ label, children, P }: { label: string; children: React.ReactNode; P: P }) {
  return (
    <View style={{ paddingHorizontal: 20, gap: 6 }}>
      <Text style={[s.sectionLabel, { color: P.dim }]}>{label.toUpperCase()}</Text>
      <View style={[s.card, { backgroundColor: P.card, borderColor: P.edge }]}>
        {children}
      </View>
    </View>
  );
}

function Divider({ P }: { P: P }) {
  return <View style={[s.divider, { backgroundColor: P.hair, marginLeft: 60 }]} />;
}

function IconBox({ bg, fg, icon }: { bg: string; fg: string; icon: IoniconsName }) {
  return (
    <View style={[s.iconBox, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={15} color={fg} />
    </View>
  );
}

interface RowProps {
  icon: IoniconsName;
  iconBg: string;
  iconFg: string;
  label: string;
  value: string;
  P: P;
  last?: boolean;
}

function Row({ icon, iconBg, iconFg, label, value, P }: RowProps) {
  return (
    <View style={[s.rowBase, { paddingHorizontal: 16, paddingVertical: 13 }]}>
      <IconBox bg={iconBg} fg={iconFg} icon={icon} />
      <Text style={[s.rowLabel, { color: P.text, flex: 1 }]}>{label}</Text>
      <Text style={[s.rowValue, { color: P.dim }]}>{value}</Text>
    </View>
  );
}

interface NavRowProps {
  icon: IoniconsName;
  iconBg: string;
  iconFg: string;
  label: string;
  labelColor?: string;
  P: P;
  last?: boolean;
  hideChevron?: boolean;
  onPress: () => void;
}

function NavRow({ icon, iconBg, iconFg, label, labelColor, P, hideChevron, onPress }: NavRowProps) {
  return (
    <TouchableOpacity
      style={[s.rowBase, { paddingHorizontal: 16, paddingVertical: 14 }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <IconBox bg={iconBg} fg={iconFg} icon={icon} />
      <Text style={[s.rowLabel, { color: labelColor ?? P.text, flex: 1 }]}>{label}</Text>
      {!hideChevron && <Ionicons name="chevron-forward" size={14} color={P.faint} />}
    </TouchableOpacity>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Hero
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  avatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 2,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg:    { width: 52, height: 52, borderRadius: 26 },
  avatarLetter: { fontSize: 22, fontWeight: '800' },
  heroName:     { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  heroEmail:    { fontSize: 13 },

  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: '500' },

  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  // Section
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },

  // Row atoms
  rowBase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowSub:   { fontSize: 12, marginTop: 1 },
  rowValue: { fontSize: 14 },

  // Appearance tiles
  themeTile: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 7,
  },
  tileIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tileLabel: { fontSize: 12, letterSpacing: 0.1 },
  tileDot:   { width: 5, height: 5, borderRadius: 3 },

  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  connectedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22C55E',
  },
  connectPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  connectPillText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  version: { textAlign: 'center', fontSize: 12, paddingTop: 4, paddingBottom: 8 },
});
