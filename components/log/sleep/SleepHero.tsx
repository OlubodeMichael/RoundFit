import { Text, View } from 'react-native';

import { usePalette } from '@/lib/log-theme';
import { sleepStyles } from '@/components/log/sleep/sleep-styles';
import type { SleepHoursResult } from '@/utils/sleep-time';

export interface SleepHeroProps {
  bedtime: string;
  wakeup: string;
  hours: SleepHoursResult;
  loading: boolean;
}

export function SleepHero({ bedtime, wakeup, hours, loading }: SleepHeroProps) {
  const P = usePalette();

  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 28 }}>
      {!loading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Text style={{ color: P.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 1.8 }}>
            ASLEEP
          </Text>
          <Text style={{ color: P.textDim, fontSize: 13, fontWeight: '600', letterSpacing: -0.2 }}>
            {bedtime}
            <Text style={{ color: P.textFaint }}>{' → '}</Text>
            {wakeup}
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <Text style={[sleepStyles.heroNum, { color: P.text }]}>
          {loading ? '—' : String(hours.hours)}
        </Text>
        {!loading && (
          <Text style={[sleepStyles.heroSub, { color: P.textDim, paddingBottom: 14, marginLeft: 2 }]}>
            h
          </Text>
        )}
        {!loading && <View style={{ width: 12 }} />}
        <Text style={[sleepStyles.heroNum, { color: P.text }]}>
          {loading ? '' : String(hours.minutes).padStart(2, '0')}
        </Text>
        {!loading && (
          <Text style={[sleepStyles.heroSub, { color: P.textDim, paddingBottom: 14, marginLeft: 2 }]}>
            m
          </Text>
        )}
      </View>
    </View>
  );
}
