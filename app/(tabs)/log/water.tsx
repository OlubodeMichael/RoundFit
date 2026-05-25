import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState, Fragment } from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle } from 'react-native-svg';

import { DayNavigator, usePalette } from '@/lib/log-theme';
import { useToast } from '@/components/ui/Toast';
import { WaterQuickAdd } from '@/components/log/WaterQuickAdd';
import { WaterTimeline } from '@/components/log/WaterTimeline';
import { WaterEntryRow } from '@/components/log/WaterEntryRow';
import { WaterReminderModal } from '@/components/log/WaterReminderModal';
import { useWater } from '@/hooks/use-water';
import { usePostHog } from 'posthog-react-native';

// ── Constants ─────────────────────────────────────────────────────────────────

const ML_PER_OZ = 29.5735;

// SVG ring dimensions
const RING   = 148;
const STROKE = 11;
const RADIUS = (RING - STROKE) / 2;
const CIRC   = 2 * Math.PI * RADIUS;
const CX     = RING / 2;

// ── Date helpers ─────────────────────────────────────────────────────────────

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function offsetDate(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function isToday(d: Date): boolean {
  const t = new Date();
  return localDateKey(d) === localDateKey(t);
}

function formatNavLabel(d: Date): string {
  const today = new Date();
  if (localDateKey(d) === localDateKey(today)) return 'Today';
  const yesterday = offsetDate(today, -1);
  if (localDateKey(d) === localDateKey(yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Content helpers ───────────────────────────────────────────────────────────

function whatsLeft(progress: number, remainOz: number) {
  const oz = Math.ceil(remainOz);
  if (progress >= 1)    return { head: 'Goal crushed!',    body: 'You nailed your hydration today.' };
  if (progress >= 0.9)  return { head: 'Almost there.',    body: `One small glass — about ${oz} oz — wraps it.` };
  if (progress >= 0.75) return { head: 'Keep it up.',      body: `Only ${oz} oz to go. Stay on track.` };
  if (progress >= 0.5)  return { head: 'Halfway there.',   body: `${oz} oz to go. Keep sipping.` };
  if (progress >= 0.25) return { head: 'Getting started.', body: `${oz} oz left. You've got this.` };
  return                       { head: "Let's get going!", body: 'Drink a big glass now to get on track.' };
}

type TimeGroup = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';

function getTimeGroup(iso: string): TimeGroup {
  const h = new Date(iso).getHours();
  if (h >= 5  && h < 12) return 'MORNING';
  if (h >= 12 && h < 17) return 'AFTERNOON';
  if (h >= 17 && h < 21) return 'EVENING';
  return 'NIGHT';
}

function groupEntries<T extends { logged_at: string }>(
  entries: T[],
): { group: TimeGroup; items: T[] }[] {
  const order: TimeGroup[] = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'];
  const map = new Map<TimeGroup, T[]>();
  for (const e of entries) {
    const g = getTimeGroup(e.logged_at);
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(e);
  }
  return order.filter(g => map.has(g)).map(g => ({ group: g, items: map.get(g)! }));
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function WaterLogScreen() {
  const P      = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast  = useToast();
  const posthog = usePostHog();

  const { entries, totalMl, goalMl, isLoading, logWater, deleteEntry, refresh } = useWater();

  const [selectedDate,   setSelectedDate]   = useState(() => new Date());
  const [showReminder,   setShowReminder]   = useState(false);

  const acc = P.water;

  useFocusEffect(
    useCallback(() => { void refresh(localDateKey(selectedDate)); }, [refresh, selectedDate]),
  );

  const navigate = (dir: -1 | 1) => {
    const next = offsetDate(selectedDate, dir);
    if (next > new Date()) return;
    setSelectedDate(next);
    void refresh(localDateKey(next));
  };

  // Derived values
  const progress  = Math.min(totalMl / Math.max(goalMl, 1), 1);
  const pct       = Math.round(progress * 100);
  const totalOz   = totalMl / ML_PER_OZ;
  const goalOz    = goalMl  / ML_PER_OZ;
  const remainOz  = Math.max(goalOz - totalOz, 0);
  const strokeOff = CIRC * (1 - progress);
  const left      = whatsLeft(progress, remainOz);

  const mostUsedMl = useMemo(() => {
    if (entries.length === 0) return 237;
    const counts: Record<number, number> = {};
    entries.forEach(e => { counts[e.amount_ml] = (counts[e.amount_ml] ?? 0) + 1; });
    return Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0]![0]);
  }, [entries]);

  const handleAdd = async (ml: number) => {
    try {
      await logWater(ml);
      posthog.capture('water_logged', { amount_ml: ml, source: 'quick_add' });
    } catch {
      toast.error('Could not save', 'Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEntry(id);
    } catch {
      toast.error('Could not delete', 'Please try again.');
    }
  };

  const dayIsToday = isToday(selectedDate);

  return (
    <View style={[s.root, { backgroundColor: P.bg }]}>

      {/* ── Scrollable content (header scrolls with content) ─────────────────── */}
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={10}
            style={[s.iconBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={P.text} />
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <Text style={[s.eyebrow, { color: acc }]}>HYDRATION</Text>
            <Text style={[s.screenTitle, { color: P.text }]}>
              Water log<Text style={{ color: acc }}>.</Text>
            </Text>
          </View>

          <TouchableOpacity
            hitSlop={10}
            style={[s.iconBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}
            activeOpacity={0.7}
            onPress={() => setShowReminder(true)}
          >
            <Ionicons name="alarm-outline" size={19} color={P.textDim} />
          </TouchableOpacity>
        </View>

        {/* ── Date navigator ────────────────────────────────────────────────── */}
        <View style={s.navRow}>
          <DayNavigator
            label={formatNavLabel(selectedDate)}
            isToday={dayIsToday}
            onPrev={() => navigate(-1)}
            onNext={() => navigate(1)}
            accentColor={acc}
          />
        </View>

        {/* ── Progress card ─────────────────────────────────────────────────── */}
        <View style={[s.progressCard, {
          backgroundColor: P.isDark ? '#0E1219' : P.card,
          borderColor: P.isDark ? 'rgba(56,189,248,0.12)' : P.cardEdge,
        }]}>

          {/* Ring + headline row */}
          <View style={s.progressRow}>

            {/* Donut ring */}
            <View style={s.ringWrap}>
              <Svg
                width={RING}
                height={RING}
                style={{ transform: [{ rotate: '-90deg' }] }}
              >
                <Circle
                  cx={CX} cy={CX} r={RADIUS}
                  fill="none"
                  stroke={P.isDark ? 'rgba(56,189,248,0.10)' : 'rgba(14,165,233,0.08)'}
                  strokeWidth={STROKE}
                />
                <Circle
                  cx={CX} cy={CX} r={RADIUS}
                  fill="none"
                  stroke={acc}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${CIRC}`}
                  strokeDashoffset={strokeOff}
                />
              </Svg>
              <View style={s.ringCenter}>
                <Text style={[s.ringVal, { color: P.text }]}>
                  {totalOz.toFixed(0)}
                </Text>
                <Text style={[s.ringUnit, { color: acc }]}>oz</Text>
                <Text style={[s.ringPct, { color: P.textFaint }]}>{pct}%</Text>
              </View>
            </View>

            {/* Motivation */}
            <View style={s.whatsLeftCol}>
              <Text style={[s.wlHead, { color: P.text }]}>
                {left.head}
              </Text>
              <Text style={[s.wlBody, { color: P.textDim }]}>{left.body}</Text>

              {/* Inline stats */}
              <View style={s.statsRow}>
                <View style={[s.statChip, { backgroundColor: P.isDark ? 'rgba(251,191,36,0.12)' : 'rgba(251,191,36,0.10)' }]}>
                  <Ionicons name="flame" size={11} color="#FBBF24" />
                  <Text style={[s.statChipTxt, { color: '#FBBF24' }]}>goal</Text>
                </View>
                <View style={[s.statChip, { backgroundColor: P.isDark ? 'rgba(56,189,248,0.10)' : 'rgba(14,165,233,0.08)' }]}>
                  <Ionicons name="water-outline" size={11} color={acc} />
                  <Text style={[s.statChipTxt, { color: acc }]}>{goalOz.toFixed(0)} oz</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Thin progress bar */}
          <View style={[s.progressBarTrack, { backgroundColor: P.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
            <View style={[s.progressBarFill, { width: `${pct}%`, backgroundColor: acc }]} />
          </View>

          {/* Footer */}
          <View style={s.cardFooter}>
            <Text style={[s.footerLabel, { color: P.textFaint }]}>
              {totalOz.toFixed(1)} of {goalOz.toFixed(1)} oz today
            </Text>
            <Pressable hitSlop={10} onPress={() => {}}>
              <Text style={[s.adjustTxt, { color: acc }]}>Edit goal</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Quick Add (standalone — no card wrapper) ─────────────────────── */}
        <View style={s.quickAddSection}>
          <WaterQuickAdd onAdd={handleAdd} usualMl={mostUsedMl} />
        </View>

        {entries.length > 0 && (
          <WaterTimeline
            entries={entries}
            accentColor={acc}
            isDark={P.isDark}
            textColor={P.text}
            textFaint={P.textFaint}
            cardBackground={P.isDark ? '#0E1219' : P.card}
            cardBorder={P.isDark ? 'rgba(56,189,248,0.10)' : P.cardEdge}
            showNowMarker={dayIsToday}
          />
        )}

        {/* ── Entries ───────────────────────────────────────────────────────── */}
        {entries.length > 0 && (
          <>
            <View style={s.entriesHeader}>
              <Text style={[s.entriesLabel, { color: P.textFaint }]}>
                ENTRIES
              </Text>
              <Text style={[s.entriesCount, { color: P.isDark ? acc + 'BB' : acc }]}>
                {entries.length}
              </Text>
            </View>

            {groupEntries(entries).map(({ group, items }) => (
              <Fragment key={group}>
                {/* Time-of-day section label */}
                <View style={s.groupHeader}>
                  <View style={[s.groupLine, { backgroundColor: P.isDark ? 'rgba(255,255,255,0.07)' : P.cardEdge }]} />
                  <Text style={[s.groupLabel, { color: P.textFaint }]}>{group}</Text>
                  <View style={[s.groupLine, { backgroundColor: P.isDark ? 'rgba(255,255,255,0.07)' : P.cardEdge }]} />
                </View>

                <View style={[s.card, {
                  backgroundColor: P.isDark ? '#111318' : P.card,
                  borderColor: P.cardEdge,
                  padding: 0,
                  overflow: 'hidden',
                }]}>
                  {items.map((entry, i) => (
                    <View key={entry.id}>
                      {i > 0 && <View style={[s.entryDivider, { backgroundColor: P.isDark ? 'rgba(255,255,255,0.06)' : P.cardEdge }]} />}
                      <WaterEntryRow
                        entry={entry}
                        unit="oz"
                        onDelete={handleDelete}
                      />
                    </View>
                  ))}
                </View>
              </Fragment>
            ))}
          </>
        )}

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {entries.length === 0 && !isLoading && (
          <View style={[s.emptyCard, { backgroundColor: P.isDark ? '#111318' : P.card, borderColor: P.cardEdge }]}>
            <Ionicons name="water-outline" size={36} color={P.textFaint} />
            <Text style={[s.emptyHead, { color: P.textDim }]}>No entries yet</Text>
            <Text style={[s.emptySub, { color: P.textFaint }]}>
              Use Quick Add above to log your first sip
            </Text>
          </View>
        )}

      </ScrollView>

      <WaterReminderModal
        visible={showReminder}
        onClose={() => setShowReminder(false)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingBottom:     12,
    gap:               12,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  eyebrow:      { fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 1 },
  screenTitle:  { fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },

  // Date navigator
  navRow: {
    marginBottom: 16,
    alignItems:   'center',
  },

  // Scrollable area
  scroll: {
    paddingHorizontal: 20,
    gap:               12,
  },

  // Progress card
  progressCard: {
    borderRadius: 24,
    borderWidth:  StyleSheet.hairlineWidth,
    padding:      22,
    ...Platform.select({
      ios:     { shadowColor: '#0EA5E9', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 4 },
    }),
  },

  // Ring
  progressRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           18,
    marginBottom:  20,
  },
  ringWrap: {
    width: RING, height: RING,
    alignItems: 'center', justifyContent: 'center',
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  ringVal:  { fontSize: 36, fontWeight: '900', letterSpacing: -1.5, lineHeight: 40 },
  ringUnit: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3, marginTop: 1 },
  ringPct:  { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginTop: 1 },

  // Motivation column
  whatsLeftCol: { flex: 1, gap: 8 },
  wlHead:  { fontSize: 24, fontWeight: '900', letterSpacing: -0.8, lineHeight: 28 },
  wlBody:  { fontSize: 13, fontWeight: '500', lineHeight: 19 },

  statsRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  statChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      8,
  },
  statChipTxt: { fontSize: 11, fontWeight: '700' },

  progressBarTrack: {
    height: 4, borderRadius: 2,
    marginBottom: 14, overflow: 'hidden',
  },
  progressBarFill: {
    height: 4, borderRadius: 2,
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  footerLabel: { flex: 1, fontSize: 12, fontWeight: '500' },
  adjustTxt:   { fontSize: 13, fontWeight: '700' },

  // Quick Add standalone section
  quickAddSection: {},

  // Generic card
  card: {
    borderRadius: 20,
    borderWidth:  StyleSheet.hairlineWidth,
    padding:      18,
  },

  // Entries
  entriesHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4, marginBottom: 4,
  },
  entriesLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  entriesCount: { fontSize: 13, fontWeight: '800' },
  entryDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },

  groupHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginTop:     4,
    marginBottom:  6,
    paddingHorizontal: 2,
  },
  groupLine:  { flex: 1, height: StyleSheet.hairlineWidth },
  groupLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },

  // Empty
  emptyCard: {
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
    padding: 44, alignItems: 'center', gap: 8,
  },
  emptyHead: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, marginTop: 4 },
  emptySub:  { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 18 },
});
