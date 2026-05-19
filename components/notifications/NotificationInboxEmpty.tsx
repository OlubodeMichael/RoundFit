import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

interface NotificationInboxEmptyProps {
  hi: string;
  mid: string;
  accent: string;
}

export function NotificationInboxEmpty({
  hi,
  mid,
  accent,
}: NotificationInboxEmptyProps) {
  return (
    <View style={s.wrap}>
      <View style={[s.iconRing, { borderColor: `${accent}33` }]}>
        <Ionicons name="notifications-off-outline" size={32} color={accent} />
      </View>
      <Text style={[s.title, { color: hi }]}>No notifications yet</Text>
      <Text style={[s.sub, { color: mid }]}>
        Reminders and updates will show up here when you receive them.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
    gap: 10,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
