import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import type { SettingsPalette } from '@/components/profile/settings-ui';

interface NotificationInboxEmptyProps {
  P: SettingsPalette;
  filtered?: boolean;
}

export function NotificationInboxEmpty({ P, filtered = false }: NotificationInboxEmptyProps) {
  return (
    <View style={s.wrap}>
      <View style={[s.iconRing, { backgroundColor: P.isDark ? P.card : P.sunken, borderColor: P.edge }]}>
        <Ionicons
          name={filtered ? 'search-outline' : 'notifications-off-outline'}
          size={32}
          color={P.faint}
        />
      </View>
      <Text style={[s.title, { color: P.text }]}>
        {filtered ? 'No matches' : 'All caught up'}
      </Text>
      <Text style={[s.sub, { color: P.dim }]}>
        {filtered
          ? 'Try a different filter or reset to see all notifications.'
          : 'Reminders, insights, and updates from RoundFit will appear here.'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 72,
    gap: 10,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
});
