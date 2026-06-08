import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  AnimatedCard,
  ScreenHeader,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';
import { useWeight } from '@/hooks/use-weight';
import { useUnits } from '@/hooks/use-units';
import { useProfile } from '@/hooks/use-profile';
import { WeightHistoryCurrentCard } from '@/components/weight/WeightHistoryCurrentCard';
import { formatMonthDayLocal, localCalendarDaysAgo, localWeekdayLong } from '@/utils/date';


function histLabel(iso: string): string {
  // Calendar-day difference in LOCAL time — avoids both the 24h-rolling bug and
  // Hermes' toLocaleDateString UTC skew that showed an evening log a day ahead.
  const diff = localCalendarDaysAgo(iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return localWeekdayLong(iso);
  if (diff < 30) return `${diff}d ago`;
  if (diff < 90) return `${Math.round(diff / 7)}w ago`;
  return formatMonthDayLocal(iso);
}

function xLabel(iso: string): string {
  return formatMonthDayLocal(iso);
}

export default function WeightLogScreen() {
  const P      = usePalette();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { entries, latest } = useWeight();
  const { weightUnit, toDisplayWeight } = useUnits();
  const { profile } = useProfile();

  // entries are newest-first; reverse so the oldest entry is the "starting" value
  const allAsc = useMemo(() => [...entries].reverse(), [entries]);

  const currentKg  = latest?.weight_kg ?? profile?.weightKg ?? null;
  const startingKg = allAsc.length > 0 ? allAsc[0].weight_kg : currentKg;
  const deltaKg =
    currentKg !== null && startingKg !== null ? currentKg - startingKg : 0;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="History"
          title="Weight"
          accent={P.weight}
          right={
            <Pressable
              hitSlop={10}
              onPress={() => router.push('/(tabs)/log/weight')}
              style={[styles.addBtn, { backgroundColor: P.weight }]}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </Pressable>
          }
        />

        <View style={styles.stack}>
          <WeightHistoryCurrentCard
            entries={entries}
            currentKg={currentKg}
            startingKg={startingKg}
            deltaKg={deltaKg}
            weightUnit={weightUnit}
            toDisplayWeight={toDisplayWeight}
            delay={60}
          />

          {entries.length > 0 && (
            <>
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.sectionTitle, { color: P.text }]}>History</Text>
              </View>

              <AnimatedCard delay={200} padding={0}>
                {entries.map((entry, i) => {
                  const prev = entries[i + 1];
                  const d    = prev ? entry.weight_kg - prev.weight_kg : 0;
                  const up   = d > 0.05;
                  const dn   = d < -0.05;
                  return (
                    <View key={entry.id ?? i}>
                      <View style={styles.histRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.histLabel, { color: P.text }]}>
                            {histLabel(entry.logged_at)}
                          </Text>
                          <Text style={[styles.histDate, { color: P.textFaint }]}>
                            {xLabel(entry.logged_at)}
                          </Text>
                        </View>

                        <Text style={[styles.histValue, { color: P.text }]}>
                          {toDisplayWeight(entry.weight_kg).toFixed(1)}
                          <Text style={[styles.histUnit, { color: P.textFaint }]}> {weightUnit}</Text>
                        </Text>
                        {prev && (
                          <View style={[
                            styles.histDelta,
                            { backgroundColor: up ? P.dangerSoft : dn ? P.proteinSoft : P.sunken },
                          ]}>
                            <Ionicons
                              name={up ? 'arrow-up' : dn ? 'arrow-down' : 'remove'}
                              size={10}
                              color={up ? P.danger : dn ? P.protein : P.textFaint}
                            />
                            <Text style={[
                              styles.histDeltaText,
                              { color: up ? P.danger : dn ? P.protein : P.textFaint },
                            ]}>
                              {toDisplayWeight(Math.abs(d)).toFixed(1)}
                            </Text>
                          </View>
                        )}
                      </View>
                      {i < entries.length - 1 && (
                        <View style={[styles.histDivider, { backgroundColor: P.hair }]} />
                      )}
                    </View>
                  );
                })}
              </AnimatedCard>
            </>
          )}

          {/* ── Log new reading CTA ────────────────────────────── */}
          <Pressable
            onPress={() => router.push('/(tabs)/log/weight')}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: P.weight },
              pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
            ]}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.ctaText}>Log today&apos;s weight</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    paddingHorizontal: 20,
    gap:               14,
  },
  addBtn: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15, fontWeight: '800', letterSpacing: -0.3, marginTop: 4,
  },
  histRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14, gap: 12,
  },
  histLabel: {
    fontSize: 14, fontWeight: '700',
  },
  histDate: {
    fontSize: 11, fontWeight: '500', marginTop: 2,
  },
  histValue: {
    fontSize: 16, fontWeight: '800', letterSpacing: -0.4,
  },
  histUnit: {
    fontSize: 12, fontWeight: '600',
  },
  histDelta: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 4,
    borderRadius: 8, minWidth: 52, justifyContent: 'center',
  },
  histDeltaText: {
    fontSize: 11, fontWeight: '800',
  },
  histDivider: {
    height: StyleSheet.hairlineWidth, marginLeft: 18,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 16, marginTop: 8,
  },
  ctaText: {
    color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.2,
  },
});
