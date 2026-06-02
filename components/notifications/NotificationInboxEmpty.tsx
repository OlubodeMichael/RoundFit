import { StyleSheet, Text, View } from 'react-native';

interface NotificationInboxEmptyProps {
  hi: string;
  mid: string;
}

export function NotificationInboxEmpty({ hi, mid }: NotificationInboxEmptyProps) {
  return (
    <View style={s.wrap}>
      <Text style={[s.title, { color: hi }]}>No notifications</Text>
      <Text style={[s.sub, { color: mid }]}>
        Reminders and updates will show up here.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 40,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
  },
});
