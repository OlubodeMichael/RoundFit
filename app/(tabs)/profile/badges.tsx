import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BadgeCard } from '@/components/badges/BadgeCard';
import { BadgeReviewModal } from '@/components/badges/BadgeReviewModal';
import { SettingsScreen, useSettingsPalette } from '@/components/profile/settings-ui';
import { BADGE_CATEGORY_LABELS, type BadgeCategory } from '@/constants/badges';
import { useBadges, type UserBadge } from '@/hooks/use-badges';

const CATEGORY_ORDER: BadgeCategory[] = ['starter', 'streak', 'consistency', 'milestone', 'sleep'];

export default function BadgesScreen() {
  const P = useSettingsPalette();
  const { badges, earnedCount, totalCount, isLoading, error } = useBadges();
  const [selectedBadge, setSelectedBadge] = useState<UserBadge | null>(null);

  const subtitle = `${earnedCount} of ${totalCount} earned. Keep showing up.`;

  return (
    <SettingsScreen title="Badges" subtitle={subtitle}>
      {isLoading && (
        <View style={s.center}>
          <ActivityIndicator color={P.accent} />
        </View>
      )}

      {!!error && (
        <Text style={[s.error, { color: P.dim }]}>{error}</Text>
      )}

      {CATEGORY_ORDER.map((category) => {
        const group = badges.filter((b) => b.category === category);
        if (group.length === 0) return null;
        return (
          <View key={category} style={s.section}>
            <Text style={[s.sectionLabel, { color: P.dim }]}>
              {BADGE_CATEGORY_LABELS[category].toUpperCase()}
            </Text>
            <View style={s.grid}>
              {group.map((badge: UserBadge) => (
                <BadgeCard
                  key={badge.id}
                  badge={badge}
                  P={P}
                  onPress={() => setSelectedBadge(badge)}
                />
              ))}
            </View>
          </View>
        );
      })}

      <BadgeReviewModal
        badge={selectedBadge}
        visible={selectedBadge != null}
        onClose={() => setSelectedBadge(null)}
      />
    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  center: { paddingTop: 60, alignItems: 'center' },
  error: { textAlign: 'center', paddingTop: 40, fontSize: 14 },

  section: { paddingHorizontal: 20, gap: 8, paddingBottom: 10 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
