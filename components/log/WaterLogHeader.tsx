import Ionicons from "@expo/vector-icons/Ionicons";
import { Text, TouchableOpacity, View } from "react-native";

import { waterLogStyles as s } from "@/components/log/water-log-styles";
import { usePalette } from "@/lib/log-theme";

export interface WaterLogHeaderProps {
  paddingTop: number;
  dateLabel: string;
  isToday: boolean;
  onBack: () => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onReminders: () => void;
}

export function WaterLogHeader({
  paddingTop,
  dateLabel,
  isToday,
  onBack,
  onPrevDay,
  onNextDay,
  onReminders,
}: WaterLogHeaderProps) {
  const P = usePalette();
  const acc = P.water;

  return (
    <View style={[s.header, { paddingTop }]}>
      <TouchableOpacity
        onPress={onBack}
        hitSlop={10}
        activeOpacity={0.7}
        style={[
          s.iconBtn,
          { backgroundColor: P.card, borderColor: P.cardEdge },
        ]}
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={20} color={P.text} />
      </TouchableOpacity>

      <View style={s.headerCenter}>
        <Text style={[s.eyebrow, { color: acc }]}>HYDRATION</Text>
        <View
          style={[
            s.datePill,
            { backgroundColor: P.card, borderColor: P.cardEdge },
          ]}
        >
          <TouchableOpacity
            onPress={onPrevDay}
            hitSlop={8}
            activeOpacity={0.6}
            style={s.dateArrow}
            accessibilityLabel="Previous day"
          >
            <Ionicons name="chevron-back" size={16} color={P.textDim} />
          </TouchableOpacity>
          <View style={s.dateLabelWrap}>
            {isToday && <View style={[s.todayDot, { backgroundColor: acc }]} />}
            <Text style={[s.dateLabel, { color: P.text }]}>{dateLabel}</Text>
          </View>
          <TouchableOpacity
            onPress={onNextDay}
            hitSlop={8}
            activeOpacity={isToday ? 1 : 0.6}
            disabled={isToday}
            style={s.dateArrow}
            accessibilityLabel="Next day"
          >
            <Ionicons
              name="chevron-forward"
              size={16}
              color={isToday ? P.cardEdge : P.textDim}
            />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        hitSlop={10}
        activeOpacity={0.7}
        onPress={onReminders}
        style={[
          s.iconBtn,
          { backgroundColor: P.card, borderColor: P.cardEdge },
        ]}
        accessibilityLabel="Water reminders"
      >
        <Ionicons name="alarm-outline" size={19} color={P.textDim} />
      </TouchableOpacity>
    </View>
  );
}
