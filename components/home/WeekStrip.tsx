import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { usePalette } from "@/lib/log-theme";

type WeekStripProps = {
  selected: Date;
  onSelect: (date: Date) => void;
};

type WeekCellProps = {
  index: number;
  isSelected: boolean;
  isToday: boolean;
  letter: string;
  day: number;
  onPress: () => void;
};

function isSameDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function WeekCell({ index, isSelected, isToday, letter, day, onPress }: WeekCellProps) {
  const P = usePalette();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay: 90 + index * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Animated.View style={{ flex: 1, opacity: anim, transform: [{ translateY }, { scale }] }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.cell,
          {
            backgroundColor: isSelected ? P.calories : P.card,
            borderColor: isSelected ? P.calories : P.cardEdge,
          },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={[styles.dow, { color: isSelected ? "#fff" : P.textFaint }]}>{letter}</Text>
        <Text style={[styles.num, { color: isSelected ? "#fff" : P.text }]}>{day}</Text>
        {isToday && !isSelected && <View style={[styles.todayDot, { backgroundColor: P.calories }]} />}
      </Pressable>
    </Animated.View>
  );
}

export function WeekStrip({ selected, onSelect }: WeekStripProps) {
  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }).map((_, index) => {
      const day = new Date(base);
      day.setDate(base.getDate() - (6 - index));
      return day;
    });
  }, []);

  const today = new Date();

  return (
    <View style={styles.row}>
      {days.map((date, index) => (
        <WeekCell
          key={date.toDateString()}
          index={index}
          isSelected={isSameDay(date, selected)}
          isToday={isSameDay(date, today)}
          letter={date.toLocaleDateString(undefined, { weekday: "short" })[0]}
          day={date.getDate()}
          onPress={() => onSelect(date)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
  },
  cell: {
    alignSelf: "stretch",
    aspectRatio: 0.72,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    position: "relative",
  },
  dow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  num: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  todayDot: {
    position: "absolute",
    bottom: 8,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
