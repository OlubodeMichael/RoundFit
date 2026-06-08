import { useRouter } from 'expo-router';
import {
  Bell,
  ChevronLeft,
  CreditCard,
  FileText,
  HeartPulse,
  HelpCircle,
  LogOut,
  Pencil,
  Shield,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { usePostHog } from 'posthog-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import { UserAvatar } from '@/components/profile/UserAvatar';
import {
  HeaderButton,
  ProfileDivider,
  ProfileGroup,
  ProfileHeader,
  ProfileRow,
} from '@/components/profile/profile-ui';
import { useSettingsPalette } from '@/components/profile/settings-ui';
import { useAuth } from '@/hooks/use-auth';
import { useAvatarPhotoActions } from '@/hooks/use-avatar-photo-actions';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

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
      <ProfileHeader
        P={P}
        title="My Profile"
        left={router.canGoBack() ? (
          <HeaderButton P={P} icon={ChevronLeft} onPress={() => router.back()} accessibilityLabel="Back" />
        ) : undefined}
      />

      {/* ── Avatar ───────────────────────────────────────────────────── */}
      <View style={s.avatarWrap}>
        <UserAvatar
          size="lg"
          avatarUrl={avatarUrl}
          avatarLetter={avatarLetter}
          accentColor={P.accent}
          fillColor={P.sunken}
          uploading={uploading}
          onPress={present}
        />
      </View>

      {/* ── Basic Information ─────────────────────────────────────────── */}
      <ProfileGroup
        P={P}
        title="Basic Information"
        action={
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile/you')}
            hitSlop={10}
            activeOpacity={0.6}
          >
            <Pencil size={17} color={P.dim} strokeWidth={2.2} />
          </TouchableOpacity>
        }
      >
        <TouchableOpacity
          style={s.basicCard}
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/profile/you')}
        >
          <Text style={[s.basicName, { color: P.text }]} numberOfLines={1}>
            {profile?.name || '—'}
          </Text>
          <Text style={[s.basicSub, { color: P.dim }]} numberOfLines={1}>
            {profile?.email || '—'}
          </Text>
        </TouchableOpacity>
      </ProfileGroup>

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
  avatarWrap: { alignItems: 'center', paddingTop: 18, paddingBottom: 22 },

  basicCard: { paddingHorizontal: 16, paddingVertical: 16, gap: 4 },
  basicName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  basicSub: { fontSize: 14 },

  version: { textAlign: 'center', fontSize: 12, paddingTop: 28 },
});
