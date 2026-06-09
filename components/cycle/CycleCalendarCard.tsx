import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react-native';

import {
  buildWeeks,
  DOW,
  FULL_MONTHS,
  sameDay,
  toIso,
} from '@/components/cycle/cycle-calendar-utils';
import type { Palette } from '@/lib/log-theme';

const MIN_CELL = 44;

export interface CycleCalendarCardProps {
  P: Palette;
  accent: string;
  screenWidth: number;
  calYear: number;
  calMonth: number;
  selected: Date;
  today: Date;
  loggedDates: Set<string>;
  canGoNext: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (day: Date) => void;
}

export function CycleCalendarCard({
  P,
  accent,
  screenWidth,
  calYear,
  calMonth,
  selected,
  today,
  loggedDates,
  canGoNext,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
}: CycleCalendarCardProps) {
  const cellSize = Math.max(MIN_CELL, Math.floor((screenWidth - 72) / 7));
  const weeks = buildWeeks(calYear, calMonth);

  return (
    <View style={[s.card, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
      <View style={[s.nav, { borderBottomColor: P.hair }]}>
        <Text style={[s.monthLabel, { color: P.text }]}>
          {FULL_MONTHS[calMonth]}{' '}
          <Text style={{ color: P.textFaint }}>{calYear}</Text>
        </Text>
        <View style={s.navArrows}>
          <Pressable
            onPress={onPrevMonth}
            style={[s.arrowBtn, { backgroundColor: P.sunken }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <ChevronLeft size={18} color={P.textDim} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            onPress={onNextMonth}
            disabled={!canGoNext}
            style={[
              s.arrowBtn,
              { backgroundColor: P.sunken, opacity: canGoNext ? 1 : 0.3 },
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <ChevronRight size={18} color={P.textDim} strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>

      <View style={s.gridWrap}>
        <View style={s.dowRow}>
          {DOW.map((label, index) => (
            <View key={label} style={{ width: cellSize, alignItems: 'center' }}>
              <Text style={[s.dow, { color: index === 0 ? accent : P.textFaint }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>

        {weeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} style={s.weekRow}>
            {week.map((day, dayIndex) => {
              if (!day) {
                return <View key={`blank-${weekIndex}-${dayIndex}`} style={{ width: cellSize, height: cellSize }} />;
              }

              const isSelected = sameDay(day, selected);
              const isToday = sameDay(day, today);
              const isFuture = day > today;
              const isLogged = loggedDates.has(toIso(day));
              const isSunday = dayIndex === 0;
              const innerSize = cellSize - 10;

              return (
                <Pressable
                  key={toIso(day)}
                  disabled={isFuture}
                  onPress={() => onSelectDay(day)}
                  style={({ pressed }) => [
                    s.dayCell,
                    { width: cellSize, height: cellSize },
                    pressed && !isFuture && { opacity: 0.6 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: isFuture }}
                  accessibilityLabel={day.toLocaleDateString()}
                >
                  <View
                    style={[
                      s.dayInner,
                      { width: innerSize, height: innerSize, borderRadius: innerSize / 2 },
                      isSelected && { backgroundColor: accent },
                      !isSelected && isToday && { borderWidth: 1.5, borderColor: accent },
                      isFuture && { opacity: 0.25 },
                    ]}
                  >
                    <Text
                      style={[
                        s.dayNum,
                        { color: isSelected ? '#fff' : isToday ? accent : isSunday ? accent : P.text },
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </View>
                  {isLogged && !isSelected && (
                    <View style={[s.loggedDot, { backgroundColor: accent }]} />
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={[s.footer, { borderTopColor: P.hair }]}>
        <View style={s.footerCopy}>
          <View style={[s.footerDot, { backgroundColor: accent }]} />
          <Text style={[s.footerText, { color: P.textDim }]}>
            Period started{' '}
            <Text style={{ color: P.text, fontWeight: '700' }}>
              {selected.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </Text>
        </View>
        <CheckCircle2 size={18} color={accent} strokeWidth={2.2} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  monthLabel: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  navArrows: { flexDirection: 'row', gap: 6 },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  dowRow: { flexDirection: 'row', marginBottom: 6 },
  dow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2, paddingVertical: 4 },
  weekRow: { flexDirection: 'row', marginBottom: 2 },
  dayCell: { alignItems: 'center', justifyContent: 'center' },
  dayInner: { alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 14, fontWeight: '600' },
  loggedDot: { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 6,
  },
  footerCopy: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  footerDot: { width: 6, height: 6, borderRadius: 3 },
  footerText: { fontSize: 12, fontWeight: '500', flex: 1 },
});
