import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, Animated, Image, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DailyTargetsGrid } from '@/components/profile/DailyTargetsGrid';
import { DailyTargetsModal } from '@/components/profile/DailyTargetsModal';
import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { GoalsActivityModal } from '@/components/profile/GoalsActivityModal';
import { ExportDataModal } from '@/components/profile/ExportDataModal';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { AppModal } from '@/components/ui/AppModal';
import { useAuth } from '@/hooks/use-auth';
import { useHealth } from '@/hooks/use-health';
import { useProfile } from '@/hooks/use-profile';
import { getLocalTargets } from '@/utils/local-targets';
import { registerTodayTargetsListener } from '@/utils/today-sync';
import { useTheme, type ThemePreference } from '@/hooks/use-theme';
import { deleteAvatar, pickAndUploadAvatar } from '@/utils/avatar';
import { isStoredTokenOAuth } from '@/utils/api';
import { usePostHog } from 'posthog-react-native';

const NOTIFICATIONS_ENABLED_KEY = '@roundfit/notification_enabled_v1';

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

const HEALTH_KEY = '@roundfit/health_connected';
const HEALTH_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierHeight',
  'HKWorkoutTypeIdentifier',
] as const; // used inside handleHealthConnect

const THEME_SEG_PAD = 4;

const THEME_OPTIONS: {
  value: ThemePreference;
  icon: IoniconsName;
  iconActive: IoniconsName;
  label: string;
}[] = [
  { value: 'light',  icon: 'sunny-outline',          iconActive: 'sunny',          label: 'Light'  },
  { value: 'dark',   icon: 'moon-outline',           iconActive: 'moon',           label: 'Dark'   },
  { value: 'system', icon: 'phone-portrait-outline', iconActive: 'phone-portrait', label: 'System' },
];

function themeToIndex(preference: ThemePreference): number {
  if (preference === 'light') return 0;
  if (preference === 'dark') return 1;
  return 2;
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const P = usePalette();
  const { preference, setTheme } = useTheme();
  const { signOut, deleteAccount } = useAuth();
  const { profile, avatarUrl, avatarLetter, stats, updateProfile } = useProfile();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const posthog = usePostHog();
  const [avatarUploading,   setAvatarUploading]   = useState(false);
  const [avatarSheetOpen,   setAvatarSheetOpen]   = useState(false);
  const [viewingAvatar,     setViewingAvatar]     = useState(false);
  const [sleepTarget,       setSleepTarget]       = useState(8);
  const [stepsTarget,       setStepsTarget]       = useState(10000);
  // OAuth users have no password (Supabase creates them with provider=apple/
  // google and no email/password credentials), so "Change password" would
  // fail at the verify step. Hide the row for them.
  const [isOAuthAccount,    setIsOAuthAccount]    = useState(false);

  useEffect(() => {
    let cancelled = false;
    isStoredTokenOAuth().then((isOAuth) => {
      if (!cancelled) setIsOAuthAccount(isOAuth);
    });
    return () => { cancelled = true; };
  }, []);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [goalsActivityOpen, setGoalsActivityOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [notificationsDisplay, setNotificationsDisplay] = useState('—');

  const reloadLocalTargets = useCallback(async () => {
    const local = await getLocalTargets();
    setSleepTarget(profile?.sleepTarget ?? local.sleep_target ?? 8);
    setStepsTarget(profile?.stepsTarget ?? local.steps_target ?? 10000);
  }, [profile?.stepsTarget, profile?.sleepTarget]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const storedRaw = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
        if (cancelled) return;
        if (!storedRaw) {
          setNotificationsDisplay('Off');
          return;
        }
        try {
          const parsed = JSON.parse(storedRaw) as Record<string, boolean>;
          setNotificationsDisplay(Object.values(parsed).some(Boolean) ? 'On' : 'Off');
        } catch {
          setNotificationsDisplay('Off');
        }
      })();
      return () => { cancelled = true; };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      void reloadLocalTargets();
    }, [reloadLocalTargets]),
  );

  useEffect(() => {
    return registerTodayTargetsListener(() => {
      void reloadLocalTargets();
    });
  }, [reloadLocalTargets]);

  const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
  const { isConnected: healthConnected } = useHealth();

  const calorieGoal    = profile?.calorieBudget ?? profile?.tdee ?? stats.dailyCalories;
  const caloriesTarget = calorieGoal != null ? calorieGoal.toLocaleString() : '—';
  const proteinTarget  = stats.proteinGrams ? String(stats.proteinGrams) : '—';
  const waterTarget    = ((profile?.waterGoalMl ?? 2000) / 1000).toFixed(1);
  const sleepTargetDisplay = sleepTarget % 1 === 0 ? sleepTarget.toFixed(0) : sleepTarget.toFixed(1);
  const stepsTargetDisplay = stepsTarget.toLocaleString();
  const goalDisplay = profile ? (GOAL_LABELS[profile.goal] ?? '—') : '—';

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

  function handleAvatarPress() {
    if (avatarUploading) return;
    setAvatarSheetOpen(true);
  }

  async function handleAvatarChange() {
    setAvatarSheetOpen(false);
    await new Promise(r => setTimeout(r, 280));
    try {
      setAvatarUploading(true);
      const uploadedUrl = await pickAndUploadAvatar();
      if (!uploadedUrl) return;
      updateProfile({ avatarUrl: uploadedUrl });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not upload avatar', msg || 'Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleAvatarTakePhoto() {
    setAvatarSheetOpen(false);
    await new Promise(r => setTimeout(r, 280));
    try {
      setAvatarUploading(true);
      const uploadedUrl = await pickAndUploadAvatar();
      if (!uploadedUrl) return;
      updateProfile({ avatarUrl: uploadedUrl });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not upload avatar', msg || 'Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleAvatarRemove() {
    setAvatarSheetOpen(false);
    try {
      setAvatarUploading(true);
      await deleteAvatar();
      updateProfile({ avatarUrl: null }); // optimistic — clears UI immediately
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not remove avatar', msg || 'Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: P.bg }}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 96, gap: 8 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero header ─────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
        <View style={[s.heroCard, { backgroundColor: P.card, borderColor: P.edge }]}>
          <UserAvatar
            size="md"
            avatarUrl={avatarUrl}
            avatarLetter={avatarLetter}
            accentColor={P.accent}
            fillColor={P.sunken}
            uploading={avatarUploading}
            onPress={handleAvatarPress}
          />

          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.heroName, { color: P.text }]} numberOfLines={1}>
              {profile?.name || '—'}
            </Text>
            <Text style={[s.heroEmail, { color: P.dim }]} numberOfLines={1}>
              {profile?.email || '—'}
            </Text>
          </View>

          <TouchableOpacity
            style={[s.editBtn, { backgroundColor: P.sunken, borderColor: P.edge }]}
            onPress={() => setEditProfileOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={P.dim} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Daily targets ───────────────────────────────────────────── */}
      <DailyTargetsGrid
        calories={caloriesTarget}
        protein={proteinTarget}
        water={waterTarget}
        sleep={sleepTargetDisplay}
        steps={stepsTargetDisplay}
        colors={{ card: P.card, edge: P.edge, text: P.text, dim: P.dim, faint: P.faint, sunken: P.sunken, isDark: P.isDark }}
        onEdit={() => setTargetsOpen(true)}
      />

      {/* ── Preferences ─────────────────────────────────────────────── */}
      <Section label="Preferences" P={P}>
        <NavRow
          icon="notifications" iconBg="#60A5FA" iconFg="#FFF"
          label="Notifications"
          value={notificationsDisplay}
          P={P}
          onPress={() => router.push('/(tabs)/profile/notifications')}
        />
        <Divider P={P} />
        <NavRow
          icon="radio-button-on" iconBg="#F97316" iconFg="#FFF"
          label="Goals & Activity"
          value={goalDisplay}
          P={P}
          last
          onPress={() => setGoalsActivityOpen(true)}
        />
      </Section>

      {/* ── Tracking ────────────────────────────────────────────────── */}
      {profile?.sex === 'female' && (
        <Section label="Tracking" P={P}>
          <NavRow
            icon="rose" iconBg="#FB7185" iconFg="#FFF"
            label="Cycle Tracking"
            P={P}
            last
            onPress={() => router.push('/(tabs)/profile/cycle')}
          />
        </Section>
      )}

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
              <Text style={[s.rowSub, { color: P.dim }]}>
                {healthConnected
                  ? 'Syncing steps, calories & workouts'
                  : 'Tap to connect your Health data'}
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
        <ThemeSegmentPicker value={preference} onChange={setTheme} P={P} />
      </Section>

      {/* ── Account ─────────────────────────────────────────────────── */}
      <Section label="Account" P={P} cardRadius={20}>
        {!isOAuthAccount && (
          <>
            <NavRow
              icon="lock-closed" iconBg="#818CF8" iconFg="#FFF"
              label="Change Password"
              P={P}
              variant="account"
              onPress={() => router.push('/auth/change-password')}
            />
            <Divider P={P} variant="account" />
          </>
        )}
        <NavRow
          icon="cloud-upload" iconBg="#38BDF8" iconFg="#FFF"
          label="Export Data"
          P={P}
          variant="account"
          onPress={() => setExportModalOpen(true)}
        />
        <Divider P={P} variant="account" />
        <NavRow
          icon="help-circle" iconBg="#2DD4BF" iconFg="#FFF"
          label="Help & Support"
          P={P}
          variant="account"
          onPress={() => router.push('/(tabs)/profile/help')}
        />
        <Divider P={P} variant="account" />
        <NavRow
          icon="log-out" iconBg="#FF453A" iconFg="#FFF"
          label="Sign Out"
          labelColor="#FF453A"
          P={P}
          last
          variant="account"
          onPress={() => { posthog.capture('user_signed_out'); posthog.reset(); signOut(); }}
          hideChevron
        />
      </Section>

      {/* ── Danger zone ─────────────────────────────────────────────── */}
      <Section label="Danger Zone" P={P} cardRadius={20}>
        <NavRow
          icon="trash" iconBg="#FF453A" iconFg="#FFF"
          label="Delete Account"
          labelColor="#FF453A"
          P={P}
          last
          variant="account"
          onPress={() => setDeleteModalOpen(true)}
          hideChevron
        />
      </Section>

      <Text style={[s.version, { color: P.faint }]}>RoundFit v1.0.0</Text>

      <ExportDataModal
        visible={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExportStarted={() => posthog.capture('data_export_started')}
        onExportCompleted={() => posthog.capture('data_export_completed')}
        onExportFailed={(message) => posthog.capture('data_export_failed', { message })}
      />

      <DeleteAccountModal
        visible={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onDelete={deleteAccount}
      />

      <EditProfileModal
        visible={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
      />

      <GoalsActivityModal
        visible={goalsActivityOpen}
        onClose={() => setGoalsActivityOpen(false)}
      />

      <DailyTargetsModal
        visible={targetsOpen}
        onClose={() => setTargetsOpen(false)}
        onSaved={() => { void reloadLocalTargets(); }}
      />

      {/* ── Avatar action sheet ─────────────────────────────────────── */}
      <AppModal
        visible={avatarSheetOpen}
        onClose={() => setAvatarSheetOpen(false)}
        sheetHeight={avatarUrl ? 0.54 : 0.42}
      >
        {/* Identity */}
        <View style={{ alignItems: 'center', paddingTop: 2, paddingBottom: 22 }}>
          <View style={[s.sheetAvatar, { borderColor: P.hair }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={s.sheetAvatarImg} resizeMode="cover" />
            ) : (
              <LinearGradient
                colors={['#FB923C', '#F97316', '#EA580C']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={s.sheetAvatarGradient}
              >
                <Text style={s.sheetAvatarLetter}>{avatarLetter}</Text>
              </LinearGradient>
            )}
            {avatarUploading && (
              <View style={[StyleSheet.absoluteFill, s.sheetAvatarOverlay]}>
                <Ionicons name="cloud-upload-outline" size={22} color="#FFF" />
              </View>
            )}
          </View>
          <Text style={[s.sheetName, { color: P.text }]}>{profile?.name || ''}</Text>
          <Text style={[s.sheetSub, { color: P.dim }]}>Profile photo</Text>
        </View>

        {/* Primary actions */}
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <View style={[s.sheetGroup, { backgroundColor: P.card, borderColor: P.edge }]}>
            <TouchableOpacity style={s.sheetGroupRow} onPress={handleAvatarChange} activeOpacity={0.6}>
              <View style={[s.sheetGroupIcon, { backgroundColor: P.sunken }]}>
                <Ionicons name="image-outline" size={18} color={P.accent} />
              </View>
              <Text style={[s.sheetGroupLabel, { color: P.text }]}>Choose from Library</Text>
              <Ionicons name="chevron-forward" size={14} color={P.faint} />
            </TouchableOpacity>

            <View style={[s.sheetGroupDivider, { backgroundColor: P.hair }]} />

            <TouchableOpacity style={s.sheetGroupRow} onPress={handleAvatarTakePhoto} activeOpacity={0.6}>
              <View style={[s.sheetGroupIcon, { backgroundColor: P.sunken }]}>
                <Ionicons name="camera-outline" size={18} color={P.accent} />
              </View>
              <Text style={[s.sheetGroupLabel, { color: P.text }]}>Take Photo</Text>
              <Ionicons name="chevron-forward" size={14} color={P.faint} />
            </TouchableOpacity>

            {avatarUrl && (
              <>
                <View style={[s.sheetGroupDivider, { backgroundColor: P.hair }]} />
                <TouchableOpacity
                  style={s.sheetGroupRow}
                  onPress={() => { setAvatarSheetOpen(false); setViewingAvatar(true); }}
                  activeOpacity={0.6}
                >
                  <View style={[s.sheetGroupIcon, { backgroundColor: P.sunken }]}>
                    <Ionicons name="eye-outline" size={18} color={P.dim} />
                  </View>
                  <Text style={[s.sheetGroupLabel, { color: P.text }]}>View Photo</Text>
                  <Ionicons name="chevron-forward" size={14} color={P.faint} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Destructive */}
          {avatarUrl && (
            <View style={[s.sheetGroup, { backgroundColor: P.card, borderColor: P.edge }]}>
              <TouchableOpacity style={s.sheetGroupRow} onPress={handleAvatarRemove} activeOpacity={0.6}>
                <View style={[s.sheetGroupIcon, { backgroundColor: 'rgba(239,68,68,0.08)' }]}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </View>
                <Text style={[s.sheetGroupLabel, { color: '#EF4444' }]}>Remove Photo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </AppModal>

      {/* ── Full-screen avatar viewer ───────────────────────────────── */}
      <Modal visible={viewingAvatar} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewingAvatar(false)}>
        <StatusBar hidden />
        <View style={s.viewerBg}>
          <TouchableOpacity style={s.viewerClose} onPress={() => setViewingAvatar(false)} hitSlop={12}>
            <View style={s.viewerCloseCircle}>
              <Ionicons name="close" size={20} color="#FFF" />
            </View>
          </TouchableOpacity>
          {avatarUrl && (
            <Image source={{ uri: avatarUrl }} style={s.viewerImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

type P = ReturnType<typeof usePalette>;

function ThemeSegmentPicker({
  value,
  onChange,
  P,
}: {
  value: ThemePreference;
  onChange: (next: ThemePreference) => void;
  P: P;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const anim = useRef(new Animated.Value(themeToIndex(value))).current;
  const pillW = trackWidth > 0 ? (trackWidth - THEME_SEG_PAD * 2) / 3 : 0;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: themeToIndex(value),
      useNativeDriver: true,
      tension: 240,
      friction: 22,
    }).start();
  }, [anim, value]);

  const translateX = anim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, pillW, pillW * 2],
  });

  function select(next: ThemePreference) {
    if (next === value) return;
    Animated.spring(anim, {
      toValue: themeToIndex(next),
      useNativeDriver: true,
      tension: 240,
      friction: 22,
    }).start();
    onChange(next);
  }

  return (
    <View
      style={[s.themeSeg, { backgroundColor: P.sunken }]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {pillW > 0 && (
        <Animated.View
          style={[
            s.themeSegPill,
            {
              width: pillW,
              backgroundColor: P.card,
              shadowColor: '#000',
              shadowOpacity: P.isDark ? 0.42 : 0.1,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 },
              elevation: 4,
              transform: [{ translateX }],
            },
          ]}
        />
      )}

      {THEME_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => select(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={({ pressed }) => [s.themeSegCell, pressed && { opacity: 0.88 }]}
          >
            <Ionicons
              name={active ? opt.iconActive : opt.icon}
              size={20}
              color={active ? P.accent : P.dim}
            />
            <Text
              style={[
                s.themeSegLabel,
                {
                  color: active ? P.text : P.dim,
                  fontWeight: active ? '800' : '600',
                },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({
  label,
  children,
  P,
  onEdit,
  cardRadius,
}: {
  label: string;
  children: React.ReactNode;
  P: P;
  onEdit?: () => void;
  cardRadius?: number;
}) {
  return (
    <View style={{ paddingHorizontal: 20, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
        <Text style={[s.sectionLabel, { color: P.dim, flex: 1 }]}>{label.toUpperCase()}</Text>
        {onEdit && (
          <TouchableOpacity
            onPress={onEdit}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[s.sectionEditBtn, { backgroundColor: P.card, borderColor: P.edge }]}
          >
            <Ionicons name="options-outline" size={13} color={P.dim} />
          </TouchableOpacity>
        )}
      </View>
      <View
        style={[
          s.card,
          {
            backgroundColor: P.card,
            borderColor: P.edge,
            borderRadius: cardRadius ?? 16,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function Divider({ P, variant }: { P: P; variant?: 'default' | 'account' }) {
  return (
    <View
      style={[
        s.divider,
        {
          backgroundColor: P.hair,
          marginLeft: variant === 'account' ? 64 : 60,
        },
      ]}
    />
  );
}

function IconBox({
  bg,
  fg,
  icon,
  variant,
}: {
  bg: string;
  fg: string;
  icon: IoniconsName;
  variant?: 'default' | 'account';
}) {
  const isAccount = variant === 'account';

  return (
    <View
      style={[
        s.iconBox,
        isAccount && s.iconBoxAccount,
        { backgroundColor: bg },
      ]}
    >
      <Ionicons name={icon} size={isAccount ? 17 : 15} color={fg} />
    </View>
  );
}

interface NavRowProps {
  icon: IoniconsName;
  iconBg: string;
  iconFg: string;
  label: string;
  value?: string;
  labelColor?: string;
  P: P;
  last?: boolean;
  hideChevron?: boolean;
  variant?: 'default' | 'account';
  onPress: () => void;
}

function NavRow({
  icon,
  iconBg,
  iconFg,
  label,
  value,
  labelColor,
  P,
  hideChevron,
  variant = 'default',
  onPress,
}: NavRowProps) {
  const isAccount = variant === 'account';

  return (
    <TouchableOpacity
      style={[
        s.rowBase,
        isAccount ? s.rowAccount : { paddingHorizontal: 16, paddingVertical: 14 },
      ]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <IconBox bg={iconBg} fg={iconFg} icon={icon} variant={variant} />
      <Text
        style={[
          isAccount ? s.rowLabelAccount : s.rowLabel,
          { color: labelColor ?? P.text, flex: 1 },
        ]}
      >
        {label}
      </Text>
      {value != null && value !== '—' && (
        <Text style={[s.rowValue, { color: P.dim, marginRight: 6 }]}>{value}</Text>
      )}
      {!hideChevron && (
        <Ionicons
          name="chevron-forward"
          size={isAccount ? 16 : 14}
          color={P.faint}
          style={isAccount ? s.rowChevronAccount : undefined}
        />
      )}
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
  heroName:     { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  heroEmail:    { fontSize: 13 },

  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sectionEditBtn: {
    width: 24,
    height: 24,
    borderRadius: 7,
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
  iconBoxAccount: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowLabelAccount: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  rowAccount: {
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowChevronAccount: {
    marginRight: 2,
  },
  rowSub:   { fontSize: 12, marginTop: 1 },
  rowValue: { fontSize: 14 },

  // Appearance segmented control
  themeSeg: {
    flexDirection: 'row',
    margin: 12,
    padding: THEME_SEG_PAD,
    borderRadius: 14,
    position: 'relative',
  },
  themeSegPill: {
    position: 'absolute',
    top: THEME_SEG_PAD,
    bottom: THEME_SEG_PAD,
    left: THEME_SEG_PAD,
    borderRadius: 10,
  },
  themeSegCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 7,
    zIndex: 1,
  },
  themeSegLabel: {
    fontSize: 15,
    letterSpacing: -0.2,
  },

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

  // Avatar sheet
  sheetAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  sheetAvatarImg:      { width: 76, height: 76, borderRadius: 38 },
  sheetAvatarGradient: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  sheetAvatarLetter:   { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, color: '#FFF' },
  sheetAvatarOverlay: {
    borderRadius: 38,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  sheetSub:  { fontSize: 13, marginTop: 3 },

  sheetGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sheetGroupIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetGroupLabel:   { flex: 1, fontSize: 15, fontWeight: '500' },
  sheetGroupDivider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },

  // Full-screen viewer
  viewerBg: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 10,
  },
  viewerCloseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '80%',
  },
});
