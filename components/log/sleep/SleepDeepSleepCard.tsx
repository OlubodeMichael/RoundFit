import { Text, View } from 'react-native';

import { AnimatedCard, FieldLabel, TextField, usePalette } from '@/lib/log-theme';

export interface SleepDeepSleepCardProps {
  visible: boolean;
  deepH: string;
  deepM: string;
  onChangeDeepH: (v: string) => void;
  onChangeDeepM: (v: string) => void;
}

export function SleepDeepSleepCard({
  visible,
  deepH,
  deepM,
  onChangeDeepH,
  onChangeDeepM,
}: SleepDeepSleepCardProps) {
  const P = usePalette();
  if (!visible) return null;

  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
      <AnimatedCard delay={300}>
        <FieldLabel>Deep sleep (optional)</FieldLabel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <TextField
              value={deepH}
              onChangeText={onChangeDeepH}
              placeholder="0"
              keyboardType="number-pad"
              unit="hr"
            />
          </View>
          <Text style={{ color: P.textFaint, fontSize: 18, fontWeight: '700', marginBottom: 2 }}>:</Text>
          <View style={{ flex: 1 }}>
            <TextField
              value={deepM}
              onChangeText={onChangeDeepM}
              placeholder="00"
              keyboardType="number-pad"
              unit="min"
            />
          </View>
        </View>
      </AnimatedCard>
    </View>
  );
}
