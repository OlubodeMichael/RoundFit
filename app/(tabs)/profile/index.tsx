import { useRouter } from 'expo-router';
import {
  Award,
  Bell,
  CreditCard,
  FileText,
  Flower2,
  HeartPulse,
  HelpCircle,
  LogOut,
  Shield,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { usePostHog } from 'posthog-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import {
  ProfileDivider,
  ProfileGroup,
  ProfileHeader,
  ProfileRow,
  ProfileUserCard,
} from '@/components/profile/profile-ui';
import { useSettingsPalette } from '@/components/profile/settings-ui';
import { useAuth } from '@/hooks/use-auth';
import { useAvatarPhotoActions } from '@/hooks/use-avatar-photo-actions';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { CYCLE_ENABLED } from '@/constants/features';

const PRIVACY_URL = 'https://roundfit.co/privacy';
const TERMS_URL   = 'https://roundfit.co/terms';

export default function ProfileScreen() {
  const P = useSettingsPalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const posthog = usePostHog();
  const { signOut, deleteAccount } = useAuth();
  const { preference } = useTheme();
  const { profile, avatarUrl, avatarLetter, updateProfile } = useProfile();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const { present, uploading, overlay } = useAvatarPhotoActions({
    avatarUrl,
    avatarLetter,
    name: profile?.name || undefined,
    onUpdated: (url) => updateProfile({ avatarUrl: url }),
  });

  const themeLabel =
    preference === 'system' ? 'System' : preference === 'dark' ? 'Dark' : 'Light';

  const handleSignOut = () => {
    posthog.capture('user_signed_out');
    posthog.reset();
    signOut();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: P.bg }}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 96 }}
      showsVerticalScrollIndicator={false}
    >
      <ProfileHeader P={P} title="Profile" />

      <ProfileUserCard
        P={P}
        name={profile?.name || '—'}
        email={profile?.email || '—'}
        avatarUrl={avatarUrl}
        avatarLetter={avatarLetter}
        uploading={uploading}
        onAvatarPress={present}
        onPress={() => router.push('/(tabs)/profile/you')}
      />

      {/* ── Account ───────────────────────────────────────────────────── */}
      <ProfileGroup P={P} title="Account">
        <ProfileRow P={P} icon={CreditCard} label="Subscription"
          onPress={() => router.push('/(tabs)/profile/subscription')} />
        <ProfileDivider P={P} />
        <ProfileRow P={P} icon={ShieldCheck} label="Password & Security"
          onPress={() => router.push('/(tabs)/profile/security')} />
        <ProfileDivider P={P} />
        <ProfileRow P={P} icon={CreditCard} label="Account & Data"
          onPress={() => router.push('/(tabs)/profile/account')} />
      </ProfileGroup>

      {/* ── Health & Devices ──────────────────────────────────────────── */}
      <ProfileGroup P={P} title="Health & Devices">
        <ProfileRow P={P} icon={HeartPulse} label="Apple Health & Devices"
          onPress={() => router.push('/(tabs)/profile/health')} />
      </ProfileGroup>

      {/* ── Achievements ──────────────────────────────────────────────── */}
      <ProfileGroup P={P} title="Achievements">
        <ProfileRow P={P} icon={Award} label="Badges"
          onPress={() => router.push('/(tabs)/profile/badges')} />
      </ProfileGroup>

      {/* ── Tracking ──────────────────────────────────────────────────── */}
      {CYCLE_ENABLED && profile?.sex === 'female' && (
        <ProfileGroup P={P} title="Tracking">
          <ProfileRow P={P} icon={Flower2} label="Cycle Tracking"
            onPress={() => router.push('/(tabs)/profile/cycle')} />
        </ProfileGroup>
      )}

      {/* ── Personalization ───────────────────────────────────────────── */}
      <ProfileGroup P={P} title="Personalization">
        <ProfileRow P={P} icon={Bell} label="Notifications"
          onPress={() => router.push('/(tabs)/profile/notifications')} />
        <ProfileDivider P={P} />
        <ProfileRow P={P} icon={Sun} label="Theme" value={themeLabel}
          onPress={() => router.push('/(tabs)/profile/theme')} />
      </ProfileGroup>

      {/* ── Support & Help ────────────────────────────────────────────── */}
      <ProfileGroup P={P} title="Support & Help">
        <ProfileRow P={P} icon={HelpCircle} label="Help Center"
          onPress={() => router.push('/(tabs)/profile/help')} />
        <ProfileDivider P={P} />
        <ProfileRow P={P} icon={Shield} label="Privacy Policy"
          onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} />
        <ProfileDivider P={P} />
        <ProfileRow P={P} icon={FileText} label="Terms of Service"
          onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} />
      </ProfileGroup>

      {/* ── Session ───────────────────────────────────────────────────── */}
      <ProfileGroup P={P} title="Session">
        <ProfileRow P={P} icon={LogOut} label="Log Out" color="#EF4444" hideChevron bold filled
          onPress={handleSignOut} />
      </ProfileGroup>

      {/* ── Danger Zone ───────────────────────────────────────────────── */}
      <ProfileGroup P={P} title="Danger Zone">
        <ProfileRow P={P} icon={Trash2} label="Delete Account" color="#EF4444" hideChevron bold filled
          onPress={() => setDeleteModalOpen(true)} />
      </ProfileGroup>

      <Text style={[s.version, { color: P.faint }]}>RoundFit v1.0.0</Text>

      <DeleteAccountModal
        visible={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onDelete={deleteAccount}
      />

      {/* Avatar actions sheet + viewer */}
      {overlay}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  version: { textAlign: 'center', fontSize: 12, paddingTop: 28 },
});
