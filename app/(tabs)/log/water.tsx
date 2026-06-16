import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { usePostHog } from 'posthog-react-native';

import type { WaterEntry } from '@/context/water-context';
import { usePalette } from '@/lib/log-theme';
import { useToast } from '@/components/ui/Toast';
import { WaterQuickAdd } from '@/components/log/WaterQuickAdd';
import { WaterTimeline } from '@/components/log/WaterTimeline';
import { WaterReminderModal } from '@/components/log/WaterReminderModal';
import { WaterLogHeader } from '@/components/log/WaterLogHeader';
import { WaterLogGrid } from '@/components/log/WaterLogGrid';
import { WaterLogSkeleton } from '@/components/log/WaterLogSkeleton';
import { useWater } from '@/hooks/use-water';
import {
  computeWaterDayStats,
  formatNavLabel,
  localDateKey,
  ML_PER_OZ,
  offsetDate,
  whatsLeft,
} from '@/utils/water-screen';

const DOCK_HEIGHT = 118;

export default function WaterLogScreen() {
  const P = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const posthog = usePostHog();
  const acc = P.water;

  const {
    entries: todayEntries,
    goalMl,
    isLoading,
    logWater,
    deleteEntryForDate,
    refresh,
    fetchForDate,
  } = useWater();

  const [viewDate, setViewDate] = useState(() => new Date());
  const [pastEntries, setPastEntries] = useState<WaterEntry[]>([]);
  const [showReminder, setShowReminder] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [heroBump, setHeroBump] = useState(0);

  const todayKey = localDateKey(new Date());
  const dateKey = localDateKey(viewDate);
  const viewDateRef = useRef(viewDate);
  viewDateRef.current = viewDate;

  const dayIsToday = dateKey === todayKey;
  const entries = dayIsToday ? todayEntries : pastEntries;

  const loadViewDate = useCallback(async (key: string, force = false) => {
    if (key === todayKey) {
      await refresh({ force });
      return;
    }
    const data = await fetchForDate(key, force);
    setPastEntries(data.entries);
  }, [todayKey, refresh, fetchForDate]);

  useFocusEffect(
    useCallback(() => {
      void loadViewDate(localDateKey(viewDateRef.current), false);
    }, [loadViewDate]),
  );

  useEffect(() => {
    void loadViewDate(dateKey, false);
  }, [dateKey, loadViewDate]);

  useEffect(() => {
    setViewDate((prev) => (localDateKey(prev) > todayKey ? new Date() : prev));
  }, [todayKey]);

  const navigate = (dir: -1 | 1) => {
    const next = offsetDate(viewDate, dir);
    if (next > new Date()) return;
    setViewDate(next);
  };

  const totalMl = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.amount_ml, 0),
    [entries],
  );

  const { progress, pct, totalOz, goalOz, remainOz } = computeWaterDayStats(totalMl, goalMl);
  const message = whatsLeft(progress, remainOz);
  const showInitialLoad = isLoading && dayIsToday && entries.length === 0;

  const mostUsedMl = useMemo(() => {
    if (entries.length === 0) return 237;
    const counts: Record<number, number> = {};
    entries.forEach((e) => {
      counts[e.amount_ml] = (counts[e.amount_ml] ?? 0) + 1;
    });
    return Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0]![0]);
  }, [entries]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadViewDate(dateKey, true);
    } catch {
      toast.error('Could not refresh', 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }, [dateKey, loadViewDate, toast]);

  const handleAdd = async (ml: number) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await logWater(ml);
      setHeroBump((n) => n + 1);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const oz = (ml / ML_PER_OZ).toFixed(1);
      toast.success('Logged', `+${oz} oz added to today`);
      posthog.capture('water_logged', { amount_ml: ml, source: 'quick_add' });
    } catch {
      toast.error('Could not save', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEntryForDate(dateKey, id);
      if (!dayIsToday) {
        setPastEntries((prev) => prev.filter((entry) => entry.id !== id));
      }
      toast.info('Entry removed');
    } catch {
      toast.error('Could not delete', 'Please try again.');
    }
  };

  const cardBg = P.isDark ? '#0E1219' : P.card;
  const cardBorder = P.isDark ? 'rgba(56,189,248,0.12)' : P.cardEdge;

  return (
    <View style={[s.root, { backgroundColor: P.bg }]}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + (dayIsToday ? DOCK_HEIGHT + 28 : 48) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={acc}
            colors={[acc]}
          />
        }
      >
        <WaterLogHeader
          paddingTop={0}
          dateLabel={formatNavLabel(viewDate)}
          isToday={dayIsToday}
          onBack={() => router.back()}
          onPrevDay={() => navigate(-1)}
          onNextDay={() => navigate(1)}
          onReminders={() => setShowReminder(true)}
        />

        {showInitialLoad ? (
          <WaterLogSkeleton />
        ) : (
          <>
            <WaterLogGrid
              totalOz={totalOz}
              goalOz={goalOz}
              progress={progress}
              pct={pct}
              remainOz={remainOz}
              sipCount={entries.length}
              message={message}
              bumpToken={heroBump}
              entries={entries}
              dayIsToday={dayIsToday}
              onDelete={handleDelete}
            />

            {!dayIsToday && (
              <View style={[s.pastBanner, { backgroundColor: P.waterSoft, borderColor: acc + '40' }]}>
                <Ionicons name="information-circle-outline" size={16} color={acc} />
                <Text style={[s.pastBannerTxt, { color: P.textDim }]}>
                  Quick add logs to today. Browse past days to review history.
                </Text>
              </View>
            )}

            {entries.length > 0 && (
              <WaterTimeline
                entries={entries}
                accentColor={acc}
                isDark={P.isDark}
                textColor={P.text}
                textFaint={P.textFaint}
                cardBackground={cardBg}
                cardBorder={cardBorder}
                showNowMarker={dayIsToday}
              />
            )}
          </>
        )}
      </ScrollView>

      {dayIsToday && (
        <View style={[s.dock, { paddingBottom: insets.bottom + 10 }]} pointerEvents="box-none">
          <LinearGradient
            colors={[P.bg + '00', P.bg + 'F2', P.bg]}
            locations={[0, 0.4, 1]}
            style={s.dockFade}
            pointerEvents="none"
          />
          <View style={s.dockInner}>
            <WaterQuickAdd
              onAdd={handleAdd}
              usualMl={mostUsedMl}
              variant="dock"
              disabled={isSaving}
            />
          </View>
        </View>
      )}

      <WaterReminderModal visible={showReminder} onClose={() => setShowReminder(false)} />

    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 18 },
  pastBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pastBannerTxt: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  dockFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 130 },
  dockInner: {
    paddingHorizontal: 4,
  },
});
