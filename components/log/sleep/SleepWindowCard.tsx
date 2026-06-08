import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AnimatedCard, FieldLabel, MiniLabel, usePalette } from '@/lib/log-theme';

export interface SleepWindowCardProps {
  visible: boolean;
  bedtime: string;
  wakeup: string;
  onPress: () => void;
}

export function SleepWindowCard({ visible, bedtime, wakeup, onPress }: SleepWindowCardProps) {
  const P = usePalette();
  if (!visible) return null;

  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
      <AnimatedCard delay={120} onPress={onPress}>
        <FieldLabel>Sleep window</FieldLabel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <MiniLabel>Bedtime</MiniLabel>
            <Text style={{ color: P.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 }}>
              {bedtime}
            </Text>
          </View>
          <View style={{ width: 1, height: 36, backgroundColor: P.cardEdge }} />
          <View style={{ flex: 1 }}>
            <MiniLabel>Wake up</MiniLabel>
            <Text style={{ color: P.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 }}>
              {wakeup}
            </Text>
          </View>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: P.sleepSoft,
            }}
          >
            <Ionicons name="time-outline" size={17} color={P.sleep} />
          </View>
        </View>
      </AnimatedCard>
    </View>
  );
}
