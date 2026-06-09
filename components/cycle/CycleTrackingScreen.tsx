import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { CycleCalendarCard } from '@/components/cycle/CycleCalendarCard';
import { CycleHeroCard } from '@/components/cycle/CycleHeroCard';
import { CycleHistoryCard } from '@/components/cycle/CycleHistoryCard';
import { CycleLogCard } from '@/components/cycle/CycleLogCard';
import { CycleMetricsRow } from '@/components/cycle/CycleMetricsRow';
import { CycleSectionLabel } from '@/components/cycle/CycleSectionLabel';
import { toIso } from '@/components/cycle/cycle-calendar-utils';
import { HeaderButton, ProfileHeader } from '@/components/profile/profile-ui';
import { useSettingsPalette } from '@/components/profile/settings-ui';
import { useToast } from '@/components/ui/Toast';
import { useCycle } from '@/context/cycle-context';
import { usePalette } from '@/lib/log-theme';

const HPAD = 20;
const MIN_CYCLE = 21;
const MAX_CYCLE = 45;

export interface CycleTrackingScreenProps {
  onBack: () => void;
}

export function CycleTrackingScreen({ onBack }: CycleTrackingScreenProps) {
  const P = usePalette();
  const settingsP = useSettingsPalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { width: screenWidth } = useWindowDimensions();
  const { current, history, isLoading, logPeriod } = useCycle();

  const today = useMemo(() => new Date(), []);
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<Date>(today);
  const [cycleLength, setCycleLength] = useState(history[0]?.cycle_length ?? 28);
  const [saving, setSaving] = useState(false);

  const loggedDates = useMemo(
    () => new Set(history.map((entry) => entry.period_start_date)),
    [history],
  );

  const canGoNext = calYear < today.getFullYear()
    || (calYear === today.getFullYear() && calMonth < today.getMonth());
  const isViewingCurrentMonth = calYear === today.getFullYear() && calMonth === today.getMonth();
  const barWidth = screenWidth - HPAD * 2 - 40;

  const cycleLen = history[0]?.cycle_length ?? 28;
  const cycleDay = current?.day_of_cycle != null
    ? current.day_of_cycle
    : current?.days_remaining != null
      ? Math.max(cycleLen - current.days_remaining, 1)
      : null;

  const nextPeriod = current?.predicted_next_period
    ? new Date(current.predicted_next_period)
    : null;
  const nextPeriodLabel = nextPeriod
    ? nextPeriod.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;
  const daysUntilNext = nextPeriod
    ? Math.ceil((nextPeriod.getTime() - today.getTime()) / 86400000)
    : null;

  function goToToday() {
    setCalYear(today.getFullYear());
    setCalMonth(today.getMonth());
    setSelected(today);
  }

  function prevMonth() {
    if (calMonth === 0) {
      setCalYear((year) => year - 1);
      setCalMonth(11);
      return;
    }
    setCalMonth((month) => month - 1);
  }

  function nextMonth() {
    if (!canGoNext) return;
    if (calMonth === 11) {
      setCalYear((year) => year + 1);
      setCalMonth(0);
      return;
    }
    setCalMonth((month) => month + 1);
  }

  async function handleLog() {
    setSaving(true);
    try {
      await logPeriod(toIso(selected), cycleLength);
      toast.success(
        'Period logged',
        `Started ${selected.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      );
    } catch {
      toast.error('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[s.root, { backgroundColor: P.bg }]}>
      <View style={{ paddingTop: insets.top + 6 }}>
        <ProfileHeader
          P={settingsP}
          title="Cycle tracking"
          left={(
            <HeaderButton
              P={settingsP}
              icon={ChevronLeft}
              onPress={onBack}
              accessibilityLabel="Back"
            />
          )}
          right={!isViewingCurrentMonth ? (
            <TouchableOpacity
              onPress={goToToday}
              style={[s.todayPill, { backgroundColor: P.bodySoft, borderColor: `${P.body}40` }]}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Go to today"
            >
              <Text style={[s.todayText, { color: P.body }]}>Today</Text>
            </TouchableOpacity>
          ) : undefined}
        />
        <Text style={[s.subtitle, { color: P.textDim }]}>
          Log your period to personalise nutrition and training.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          s.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <CycleHeroCard
          P={P}
          barWidth={barWidth}
          isLoading={isLoading}
          cycleDay={cycleDay}
          cycleLength={cycleLen}
          current={current}
          daysUntilNext={daysUntilNext}
          nextPeriodLabel={nextPeriodLabel}
        />

        {!isLoading && (cycleDay != null || nextPeriodLabel) && (
          <View style={s.section}>
            <CycleSectionLabel P={P} label="Overview" />
            <CycleMetricsRow
              P={P}
              cycleDay={cycleDay}
              cycleLength={cycleLen}
              daysUntilNext={daysUntilNext}
              daysRemaining={current?.days_remaining ?? null}
            />
          </View>
        )}

        <View style={s.section}>
          <CycleSectionLabel P={P} label="Calendar" />
          <CycleCalendarCard
            P={P}
            accent={P.body}
            screenWidth={screenWidth}
            calYear={calYear}
            calMonth={calMonth}
            selected={selected}
            today={today}
            loggedDates={loggedDates}
            canGoNext={canGoNext}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            onSelectDay={setSelected}
          />
        </View>

        <View style={s.section}>
          <CycleSectionLabel P={P} label="Log period" />
          <CycleLogCard
            P={P}
            accent={P.body}
            cycleLength={cycleLength}
            saving={saving}
            onDecrease={() => setCycleLength((length) => Math.max(length - 1, MIN_CYCLE))}
            onIncrease={() => setCycleLength((length) => Math.min(length + 1, MAX_CYCLE))}
            onLog={handleLog}
          />
        </View>

        {history.length > 0 && (
          <View style={s.section}>
            <CycleSectionLabel P={P} label="History" />
            <CycleHistoryCard P={P} accent={P.body} history={history} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  subtitle: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: HPAD,
    marginTop: 4,
    marginBottom: 8,
  },
  content: {
    paddingHorizontal: HPAD,
    gap: 16,
    paddingTop: 8,
  },
  section: { gap: 0 },
  todayPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  todayText: { fontSize: 12, fontWeight: '700' },
});
