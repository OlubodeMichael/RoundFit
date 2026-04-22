import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Switch, Image, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import Constants from 'expo-constants';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const O   = '#F97316';
const O10 = 'rgba(249,115,22,0.10)';
const O20 = 'rgba(249,115,22,0.20)';
const O35 = 'rgba(249,115,22,0.35)';

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

export default function ProfileScreen() {
  const { isDark, preference, setTheme } = useTheme();
  const { signOut } = useAuth();
  const { profile, avatarUrl, avatarLetter, stats } = useProfile();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const bg      = isDark ? '#0A0B0F' : '#F7F7F5';
  const surface = isDark ? '#1C1D23' : '#FFFFFF';
  const hi      = isDark ? '#F4F4F5' : '#0C0C0C';
  const mid     = isDark ? '#909096' : '#888';
  const lo      = isDark ? '#2A2A32' : '#F0EDE8';

  const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
  const [healthConnected, setHealthConnected] = useState(false);
  const [healthLoading,   setHealthLoading]   = useState(false);

  const HEALTH_KEY = '@roundfit/health_connected';
  const HEALTH_TYPES = [
    'HKQuantityTypeIdentifierStepCount',
    'HKQuantityTypeIdentifierActiveEnergyBurned',
    'HKQuantityTypeIdentifierBodyMass',
    'HKQuantityTypeIdentifierHeight',
    'HKWorkoutTypeIdentifier',
  ] as const;

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const val = await AsyncStorage.getItem(HEALTH_KEY);
        if (val === 'true') setHealthConnected(true);
      } catch {
        // AsyncStorage unavailable; leave as disconnected
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleHealthConnect() {
    if (isExpoGo) {
      Alert.alert('Not available in Expo Go', 'Build the app to connect Apple Health.');
      return;
    }
    if (Platform.OS !== 'ios') return;
    setHealthLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Healthkit = require('@kingstinct/react-native-healthkit');
      const isAvailable = await Healthkit.isHealthDataAvailable();
      if (!isAvailable) {
        Alert.alert('Not Available', 'Apple Health is not available on this device.');
        return;
      }
      await Healthkit.requestAuthorization({ toRead: HEALTH_TYPES });
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem(HEALTH_KEY, 'true');
      setHealthConnected(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not connect', msg || 'Please allow access in Settings → Health → RoundFit.');
    } finally {
      setHealthLoading(false);
    }
  }

  const calorieDisplay = stats.dailyCalories
    ? `${stats.dailyCalories.toLocaleString()} kcal`
    : '—';

  const proteinDisplay = stats.proteinGrams ? `${stats.proteinGrams}g` : '—';
  const weightDisplay  = stats.weightDisplay ?? '—';

  const goalDisplay    = profile ? GOAL_LABELS[profile.goal]          : '—';
  const activityDisplay = profile ? ACTIVITY_LABELS[profile.activityLevel] : '—';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48, paddingHorizontal: 20, gap: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[s.profileCard, { backgroundColor: surface, borderColor: lo }]}>
        <View style={[s.avatar, { backgroundColor: O20, borderColor: O35 }]}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
            : <Text style={[s.avatarLetter, { color: O }]}>{avatarLetter}</Text>
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.profileName, { color: hi }]}>{profile?.name || '—'}</Text>
          <Text style={[s.profileEmail, { color: mid }]}>{profile?.email || '—'}</Text>
        </View>
        <TouchableOpacity
          style={[s.editBtn, { backgroundColor: O10, borderColor: O35 }]}
          onPress={() => router.push('/edit-profile')}
          activeOpacity={0.75}
        >
          <Ionicons name="pencil-outline" size={15} color={O} />
        </TouchableOpacity>
      </View>

      <View style={[s.statsRow, { backgroundColor: surface, borderColor: lo }]}>
        <StatCell label="Goal"     value={goalDisplay}     hi={hi} mid={mid} />
        <View style={[s.statDivider, { backgroundColor: lo }]} />
        <StatCell label="Activity" value={activityDisplay} hi={hi} mid={mid} />
        <View style={[s.statDivider, { backgroundColor: lo }]} />
        <StatCell label="Weight"   value={weightDisplay}   hi={hi} mid={mid} />
      </View>

      <SectionHeader title="Goals" hi={hi} />
      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        <GoalRow icon="flame-outline"   label="Daily Calories"  value={calorieDisplay} hi={hi} mid={mid} lo={lo} />
        <GoalRow icon="barbell-outline" label="Protein Target"  value={proteinDisplay} hi={hi} mid={mid} lo={lo} />
        <GoalRow icon="scale-outline"   label="Current Weight"  value={weightDisplay}  hi={hi} mid={mid} lo={lo} />
        <GoalRow icon="walk-outline"    label="Daily Steps"     value="10,000"         hi={hi} mid={mid} lo={lo} last />
      </View>

      <SectionHeader title="Tracking" hi={hi} />
      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        {profile?.sex === 'female' && (
          <NavRow icon="moon-outline" label="Cycle tracking" hi={hi} mid={mid} lo={lo}
            onPress={() => router.push('/(tabs)/profile/cycle')} />
        )}
        <NavRow icon="heart-outline" label="Wearable & Health" hi={hi} mid={mid} lo={lo}
          onPress={() => router.push('/(tabs)/profile/wearable')} />
        <NavRow icon="notifications-outline" label="Notifications" hi={hi} mid={mid} lo={lo}
          onPress={() => router.push('/(tabs)/profile/notifications')} last />
      </View>

      <SectionHeader title="Subscription" hi={hi} />
      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        <NavRow icon="sparkles-outline" label="Subscription" hi={hi} mid={mid} lo={lo}
          onPress={() => router.push('/(tabs)/profile/subscription')} />
        <NavRow icon="star-outline" label="Upgrade to Premium" hi={hi} mid={mid} lo={lo}
          onPress={() => router.push('/(tabs)/profile/paywall')} last />
      </View>

      {Platform.OS === 'ios' && (
        <>
          <SectionHeader title="Health" hi={hi} />
          <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
            <TouchableOpacity
              style={s.row}
              activeOpacity={healthConnected ? 1 : 0.7}
              onPress={healthConnected ? undefined : handleHealthConnect}
              disabled={healthLoading}
            >
              <View style={[s.rowIcon, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.18)' }]}>
                <Ionicons name="heart" size={16} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowLabel, { color: hi, flex: 0 }]}>Apple Health</Text>
                <Text style={[{ fontSize: 12, marginTop: 2 }, { color: mid }]}>
                  {healthConnected ? 'Syncing steps, calories & workouts' : 'Tap to connect your Health data'}
                </Text>
              </View>
              {healthConnected
                ? <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                : <View style={s.connectBadge}>
                    <Text style={s.connectBadgeText}>{healthLoading ? '…' : 'Connect'}</Text>
                  </View>
              }
            </TouchableOpacity>
          </View>
        </>
      )}

      <SectionHeader title="Notifications" hi={hi} />
      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        <NotifRow label="Meal reminders"  sub="9:00 AM, 1:00 PM, 7:00 PM" hi={hi} mid={mid} lo={lo} defaultOn />
        <NotifRow label="Daily summary"   sub="9:00 PM each evening"       hi={hi} mid={mid} lo={lo} defaultOn />
        <NotifRow label="Streak alerts"   sub="When streak is at risk"     hi={hi} mid={mid} lo={lo} defaultOn={false} last />
      </View>

      <SectionHeader title="Appearance" hi={hi} />
      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        {(['light', 'dark', 'system'] as const).map((p, i, arr) => (
          <TouchableOpacity
            key={p}
            onPress={() => setTheme(p)}
            style={[s.themeRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: lo }]}
          >
            <Ionicons
              name={p === 'light' ? 'sunny-outline' : p === 'dark' ? 'moon-outline' : 'settings-outline'}
              size={18}
              color={preference === p ? O : mid}
            />
            <Text style={[s.themeLabel, { color: preference === p ? O : hi }]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
            {preference === p && (
              <Ionicons name="checkmark" size={16} color={O} style={{ marginLeft: 'auto' }} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <SectionHeader title="Account" hi={hi} />
      <View style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
        <ActionRow icon="lock-closed-outline"  label="Change Password" hi={hi} mid={mid} lo={lo} />
        <ActionRow icon="cloud-upload-outline" label="Export Data"     hi={hi} mid={mid} lo={lo} />
        <ActionRow icon="help-circle-outline"  label="Help & Support"  hi={hi} mid={mid} lo={lo} />
        <ActionRow icon="log-out-outline"      label="Sign Out"        hi={hi} mid={mid} lo={lo} destructive last onPress={signOut} />
      </View>

      <Text style={[s.version, { color: mid }]}>RoundFit v1.0.0</Text>
    </ScrollView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ title, hi }: { title: string; hi: string }) {
  return <Text style={[s.sectionTitle, { color: hi }]}>{title}</Text>;
}

function StatCell({ label, value, hi, mid }: { label: string; value: string; hi: string; mid: string }) {
  return (
    <View style={s.statCell}>
      <Text style={[s.statValue, { color: hi }]} numberOfLines={1}>{value}</Text>
      <Text style={[s.statLabel, { color: mid }]}>{label}</Text>
    </View>
  );
}

function GoalRow({ icon, label, value, hi, mid, lo, last }: { icon: IoniconsName; label: string; value: string; hi: string; mid: string; lo: string; last?: boolean }) {
  return (
    <View style={[s.row, !last && { borderBottomWidth: 1, borderBottomColor: lo }]}>
      <View style={[s.rowIcon, { backgroundColor: O10, borderColor: O20 }]}>
        <Ionicons name={icon} size={16} color={O} />
      </View>
      <Text style={[s.rowLabel, { color: hi }]}>{label}</Text>
      <Text style={[s.rowValue, { color: mid }]}>{value}</Text>
      <Ionicons name="chevron-forward" size={14} color={mid} />
    </View>
  );
}

function NavRow({ icon, label, hi, mid, lo, onPress, last }: { icon: IoniconsName; label: string; hi: string; mid: string; lo: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity style={[s.row, !last && { borderBottomWidth: 1, borderBottomColor: lo }]} activeOpacity={0.7} onPress={onPress}>
      <View style={[s.rowIcon, { backgroundColor: O10, borderColor: O20 }]}>
        <Ionicons name={icon} size={16} color={O} />
      </View>
      <Text style={[s.rowLabel, { color: hi }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={mid} />
    </TouchableOpacity>
  );
}

function NotifRow({ label, sub, hi, mid, lo, defaultOn, last }: { label: string; sub: string; hi: string; mid: string; lo: string; defaultOn: boolean; last?: boolean }) {
  return (
    <View style={[s.row, !last && { borderBottomWidth: 1, borderBottomColor: lo }]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, { color: hi }]}>{label}</Text>
        <Text style={[{ fontSize: 11, marginTop: 2 }, { color: mid }]}>{sub}</Text>
      </View>
      <Switch
        value={defaultOn}
        onValueChange={() => {}}
        trackColor={{ false: lo, true: O35 }}
        thumbColor={defaultOn ? O : '#999'}
        ios_backgroundColor={lo}
      />
    </View>
  );
}

function ActionRow({ icon, label, hi, mid, lo, destructive, last, onPress }: { icon: IoniconsName; label: string; hi: string; mid: string; lo: string; destructive?: boolean; last?: boolean; onPress?: () => void }) {
  const color = destructive ? '#EF4444' : hi;
  return (
    <TouchableOpacity style={[s.row, !last && { borderBottomWidth: 1, borderBottomColor: lo }]} activeOpacity={0.7} onPress={onPress}>
      <Ionicons name={icon} size={18} color={destructive ? '#EF4444' : mid} />
      <Text style={[s.rowLabel, { color, flex: 1 }]}>{label}</Text>
      {!destructive && <Ionicons name="chevron-forward" size={14} color={mid} />}
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  profileCard:  { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 16, borderWidth: 1 },
  avatar:       { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, overflow: 'hidden' },
  avatarImg:    { width: 52, height: 52, borderRadius: 26 },
  avatarLetter: { fontSize: 22, fontWeight: '800' },
  profileName:  { fontSize: 16, fontWeight: '700' },
  profileEmail: { fontSize: 13, marginTop: 2 },
  editBtn:      { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  statsRow:    { flexDirection: 'row', borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  statCell:    { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 3 },
  statDivider: { width: 1 },
  statValue:   { fontSize: 13, fontWeight: '700' },
  statLabel:   { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },

  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: -6 },

  card:     { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowIcon:  { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  rowValue: { fontSize: 13 },

  themeRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  themeLabel: { fontSize: 14, fontWeight: '600' },

  connectBadge: {
    backgroundColor: '#F97316',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  connectBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  version: { textAlign: 'center', fontSize: 12, marginTop: 4 },
});
