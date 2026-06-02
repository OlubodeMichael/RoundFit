import { Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { usePalette } from '@/lib/log-theme';
import { sleepStyles } from '@/components/log/sleep/sleep-styles';

export interface SleepLogHeaderProps {
  paddingTop: number;
  dateLabel: string;
  isToday: boolean;
  onBack: () => void;
  onPrevDay: () => void;
  onNextDay: () => void;
}

export function SleepLogHeader({
  paddingTop,
  dateLabel,
  isToday,
  onBack,
  onPrevDay,
  onNextDay,
}: SleepLogHeaderProps) {
  const P = usePalette();

  return (
    <View style={[sleepStyles.header, { paddingTop }]}>
      <TouchableOpacity
        onPress={onBack}
        hitSlop={10}
        activeOpacity={0.7}
        style={[sleepStyles.iconBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}
      >
        <Ionicons name="chevron-back" size={20} color={P.text} />
      </TouchableOpacity>

      <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
        <Text style={[sleepStyles.eyebrow, { color: P.textFaint }]}>SLEEP</Text>
        <View style={[sleepStyles.datePill, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
          <TouchableOpacity onPress={onPrevDay} hitSlop={8} activeOpacity={0.6} style={sleepStyles.dateArrow}>
            <Ionicons name="chevron-back" size={16} color={P.textDim} />
          </TouchableOpacity>
          <View style={sleepStyles.dateLabelWrap}>
            {isToday && <View style={[sleepStyles.todayDot, { backgroundColor: P.sleep }]} />}
            <Text style={[sleepStyles.dateLabel, { color: P.text }]}>{dateLabel}</Text>
          </View>
          <TouchableOpacity
            onPress={onNextDay}
            hitSlop={8}
            activeOpacity={isToday ? 1 : 0.6}
            disabled={isToday}
            style={sleepStyles.dateArrow}
          >
            <Ionicons name="chevron-forward" size={16} color={isToday ? P.cardEdge : P.textDim} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ width: 38 }} />
    </View>
  );
}
