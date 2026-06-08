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
  isToday,
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

  const { entries, totalMl, goalMl, isLoading, logWater, deleteEntry, refresh } = useWater();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showReminder, setShowReminder] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [heroBump, setHeroBump] = useState(0);

  const dateKey = localDateKey(selectedDate);
  const dateKeyRef = useRef(dateKey);
  dateKeyRef.current = dateKey;

  useFocusEffect(
    useCallback(() => {
      void refresh(dateKeyRef.current, { force: false });
    }, [refresh]),
  );

  useEffect(() => {
    void refresh(dateKey, { force: false });
  }, [dateKey, refresh]);

  const navigate = (dir: -1 | 1) => {
    const next = offsetDate(selectedDate, dir);
    if (next > new Date()) return;
    setSelectedDate(next);
  };

  const { progress, pct, totalOz, goalOz, remainOz } = computeWaterDayStats(totalMl, goalMl);
  const message = whatsLeft(progress, remainOz);
  const dayIsToday = isToday(selectedDate);
  const showInitialLoad = isLoading && entries.length === 0;

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
      await refresh(dateKey, { force: true });
    } catch {
      toast.error('Could not refresh', 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }, [dateKey, refresh, toast]);

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
      await deleteEntry(id);
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
          dateLabel={formatNavLabel(selectedDate)}
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
