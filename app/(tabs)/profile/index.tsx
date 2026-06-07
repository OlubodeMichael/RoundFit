import { useRouter } from 'expo-router';
import { ChevronRight, Heart, ShieldCheck, SlidersHorizontal, User } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserAvatar } from '@/components/profile/UserAvatar';
import {
  Divider,
  NavRow,
  Section,
  useSettingsPalette,
} from '@/components/profile/settings-ui';
import { useAvatarPhotoActions } from '@/hooks/use-avatar-photo-actions';
import { useProfile } from '@/hooks/use-profile';

export default function ProfileScreen() {
  const P = useSettingsPalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, avatarUrl, avatarLetter, updateProfile } = useProfile();

  const { present, uploading, overlay } = useAvatarPhotoActions({
    avatarUrl,
    avatarLetter,
    name: profile?.name || undefined,
    onUpdated: (url) => updateProfile({ avatarUrl: url }),
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: P.bg }}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 96, gap: 8 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
        <TouchableOpacity
          style={[s.heroCard, { backgroundColor: P.card, borderColor: P.edge }]}
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/profile/you')}
        >
          <UserAvatar
            size="md"
            avatarUrl={avatarUrl}
            avatarLetter={avatarLetter}
            accentColor={P.accent}
            fillColor={P.sunken}
            uploading={uploading}
            onPress={present}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.heroName, { color: P.text }]} numberOfLines={1}>
              {profile?.name || '—'}
            </Text>
            <Text style={[s.heroEmail, { color: P.dim }]} numberOfLines={1}>
              {profile?.email || '—'}
            </Text>
          </View>
          <ChevronRight size={20} color={P.faint} strokeWidth={2.4} />
        </TouchableOpacity>
      </View>

      {/* ── Sections ─────────────────────────────────────────────────── */}
      <Section P={P} cardRadius={20}>
        <NavRow
          icon={User}
          color="#A855F7"
          label="You"
          sub="Details, goals & daily targets"
          P={P}
          onPress={() => router.push('/(tabs)/profile/you')}
        />
        <Divider P={P} inset={64} />
        <NavRow
          icon={Heart}
          color="#F43F5E"
          label="Health & Devices"
          sub="Apple Health, wearables, cycle"
          P={P}
          onPress={() => router.push('/(tabs)/profile/health')}
        />
        <Divider P={P} inset={64} />
        <NavRow
          icon={SlidersHorizontal}
          color="#3B82F6"
          label="Preferences"
          sub="Notifications & appearance"
          P={P}
          onPress={() => router.push('/(tabs)/profile/preferences')}
        />
        <Divider P={P} inset={64} />
        <NavRow
          icon={ShieldCheck}
          color="#10B981"
          label="Account"
          sub="Billing, security & data"
          P={P}
          onPress={() => router.push('/(tabs)/profile/account')}
        />
      </Section>

      <Text style={[s.version, { color: P.faint }]}>RoundFit v1.0.0</Text>

      {/* Avatar actions sheet + viewer */}
      {overlay}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  heroName:  { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  heroEmail: { fontSize: 13 },
  version:   { textAlign: 'center', fontSize: 12, paddingTop: 4, paddingBottom: 8 },
});
