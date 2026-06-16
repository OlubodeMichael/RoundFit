import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BadgeArt } from '@/components/badges/BadgeArt';
import type { SettingsPalette } from '@/components/profile/settings-ui';
import type { UserBadge } from '@/hooks/use-badges';

function formatEarnedDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface BadgeCardProps {
  badge: UserBadge;
  P: SettingsPalette;
  onPress: () => void;
}

export function BadgeCard({ badge, P, onPress }: BadgeCardProps) {
  const earnedDate = badge.earned ? formatEarnedDate(badge.earned_at) : null;
  const subtitle = earnedDate
    ? badge.times_earned > 1
      ? `Earned ${badge.times_earned}× · ${earnedDate}`
      : earnedDate
    : badge.description;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        { backgroundColor: P.card, borderColor: P.edge },
        !badge.earned && s.locked,
        pressed && s.pressed,
      ]}
    >
      <View style={s.art}>
        <BadgeArt
          badgeId={badge.id}
          icon={badge.icon}
          earned={badge.earned}
          backgroundColor={P.sunken}
        />
      </View>

      <Text style={[s.name, { color: P.text }]} numberOfLines={1}>
        {badge.name}
      </Text>
      <Text style={[s.sub, { color: P.dim }]} numberOfLines={2}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    flexBasis: '31%',
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
  },
  art: { marginBottom: 8 },
  locked: { opacity: 0.55 },
  pressed: { opacity: 0.88 },

  name: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2, textAlign: 'center' },
  sub: { fontSize: 11, textAlign: 'center', lineHeight: 15 },
});
