import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AnimatedCard, PrimaryButton, usePalette } from '@/lib/log-theme';
import { useToast } from '@/components/ui/Toast';
import { useCycle } from '@/context/cycle-context';
import { useTheme } from '@/hooks/use-theme';

function useAcc() {
  const { isDark } = useTheme();
  return isDark ? '#F9A8D4' : '#BE185D';
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const PHASES: { key: string; label: string; short: string; icon: IoniconName }[] = [
  { key: 'menstrual',  label: 'Menstrual',  short: 'Men', icon: 'water'  },
  { key: 'follicular', label: 'Follicular', short: 'Fol', icon: 'leaf'   },
  { key: 'ovulation',  label: 'Ovulation',  short: 'Ovu', icon: 'sunny'  },
  { key: 'luteal',     label: 'Luteal',     short: 'Lut', icon: 'moon'   },
];

const PHASE_TIP: Record<string, string> = {
  menstrual:  'Rest and gentle movement recommended.',
  follicular: 'Energy rising — great time for new goals.',
  ovulation:  'Peak energy and strength window.',
  luteal:     'Wind down and prioritise recovery.',
};

const FULL_MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function toIso(d: Date) {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}

function buildWeeks(year: number, month: number): (Date | null)[][] {
  const first  = new Date(year, month, 1);
  const offset = first.getDay();
  const total  = new Date(year, month + 1, 0).getDate();
  const flat: (Date | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= total; d++) flat.push(new Date(year, month, d));
  while (flat.length % 7 !== 0) flat.push(null);
  const out: (Date | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) out.push(flat.slice(i, i + 7));
  return out;
}

// ─── Phase Track ─────────────────────────────────────────────────────────────
function PhaseTrack({
  activePhase,
  ACC,
  P,
}: {
  activePhase: string | null | undefined;
  ACC: string;
  P: ReturnType<typeof usePalette>;
}) {
  const activeIdx = PHASES.findIndex(p => p.key === activePhase);

  return (
    <View style={pt.wrap}>
      {PHASES.map((phase, i) => {
        const isPast   = activeIdx > i;
        const isActive = activeIdx === i;
        const isFuture = activeIdx < i;

        return (
          <View key={phase.key} style={pt.col}>
            {/* Connector line before this node (skip first) */}
            <View style={pt.lineRow}>
              {i > 0 && (
                <View style={[
                  pt.line,
                  { backgroundColor: isPast || isActive ? ACC : P.hair },
                ]} />
              )}
              {/* Node */}
              <View style={[
                pt.node,
                isActive && { width: 22, height: 22, borderRadius: 11, backgroundColor: ACC },
                isPast   && { width: 18, height: 18, borderRadius: 9,  backgroundColor: ACC, opacity: 0.5 },
                isFuture && { width: 18, height: 18, borderRadius: 9,  backgroundColor: 'transparent',
                              borderWidth: 1.5, borderColor: P.hair },
              ]}>
                {isActive && (
                  <View style={[pt.nodeInner, { backgroundColor: '#fff' }]} />
                )}
              </View>
              {i < PHASES.length - 1 && (
                <View style={[
                  pt.line,
                  { backgroundColor: isActive || isPast ? (i < activeIdx - 1 || isActive ? ACC : P.hair) : P.hair },
                  // line after active node is unfilled
                  isActive && { backgroundColor: P.hair },
                ]} />
              )}
            </View>
            <Text style={[
              pt.label,
              { color: isActive ? P.text : P.textFaint,
                fontWeight: isActive ? '700' : '400' },
            ]}>
              {phase.short}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const pt = StyleSheet.create({
  wrap:      { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 24, marginTop: 20, marginBottom: 4 },
  col:       { flex: 1, alignItems: 'center' },
  lineRow:   { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  line:      { flex: 1, height: 1.5 },
  node:      { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  nodeInner: { width: 6, height: 6, borderRadius: 3 },
  label:     { fontSize: 11, marginTop: 6, letterSpacing: 0.2 },
});

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function CycleTrackingScreen() {
  const P      = usePalette();
  const ACC    = useAcc();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast  = useToast();
  const { width: screenW } = useWindowDimensions();
  const { current, history, isLoading, logPeriod } = useCycle();

  // Cell = screen width minus screen padding (20×2) minus calendar inner padding (16×2)
  const CELL = Math.floor((screenW - 72) / 7);

  const today = useMemo(() => new Date(), []);

  const [calYear,     setCalYear]     = useState(today.getFullYear());
  const [calMonth,    setCalMonth]    = useState(today.getMonth());
  const [selected,    setSelected]    = useState<Date>(today);
  const [cycleLength, setCycleLength] = useState(history[0]?.cycle_length ?? 28);
  const [saving,      setSaving]      = useState(false);

  const weeks       = useMemo(() => buildWeeks(calYear, calMonth), [calYear, calMonth]);
  const loggedDates = useMemo(() => new Set(history.map(h => h.period_start_date)), [history]);

  const canGoNext =
    calYear < today.getFullYear() ||
    (calYear === today.getFullYear() && calMonth < today.getMonth());

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (!canGoNext) return;
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }
  function jumpToToday() {
    setCalYear(today.getFullYear());
    setCalMonth(today.getMonth());
    setSelected(today);
  }

  const handleLog = async () => {
    setSaving(true);
    try {
      await logPeriod(toIso(selected), cycleLength);
      toast.success('Period logged',
        `Started ${selected.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      );
    } catch {
      toast.error('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const cycleLen  = history[0]?.cycle_length ?? 28;
  const cycleDay  = current?.days_remaining != null
    ? Math.max(cycleLen - current.days_remaining, 1)
    : null;
  const phaseMeta = PHASES.find(p => p.key === current?.phase);
  const nextPeriod = current?.predicted_next_period
    ? new Date(current.predicted_next_period).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    : null;
  const tip = current?.phase ? PHASE_TIP[current.phase] : null;

  const isViewingCurrentMonth =
    calYear === today.getFullYear() && calMonth === today.getMonth();

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={[s.backBtn, { borderColor: P.cardEdge }]}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={P.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={[s.eyebrow, { color: P.textFaint }]}>WOMEN'S HEALTH</Text>
          <Text style={[s.headerTitle, { color: P.text }]}>Cycle Tracking</Text>
        </View>

        {!isViewingCurrentMonth && (
          <TouchableOpacity
            onPress={jumpToToday}
            hitSlop={8}
            style={[s.todayPill, { backgroundColor: ACC + '18', borderColor: ACC + '40' }]}
            activeOpacity={0.75}
          >
            <Text style={[s.todayPillText, { color: ACC }]}>Today</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Hero: Day counter + phase name ───────────────────────── */}
        <View style={[s.hero, { borderBottomColor: P.hair }]}>
          {isLoading ? (
            <ActivityIndicator color={ACC} size="large" style={{ paddingVertical: 24 }} />
          ) : (
            <>
              <View style={s.heroLeft}>
                {/* Large day number */}
                <View style={s.heroNumRow}>
                  <Text style={[s.heroDay, { color: P.text }]}>
                    {cycleDay ?? '—'}
                  </Text>
                  <View style={s.heroNumSub}>
                    <Text style={[s.heroDayLabel, { color: P.textFaint }]}>day</Text>
                    <Text style={[s.heroDayOf,    { color: P.textFaint }]}>of {cycleLen}</Text>
                  </View>
                </View>

                {/* Phase name */}
                {phaseMeta ? (
                  <View style={s.heroPhaseRow}>
                    <Ionicons name={phaseMeta.icon} size={14} color={ACC} />
                    <Text style={[s.heroPhase, { color: ACC }]}>{phaseMeta.label} phase</Text>
                  </View>
                ) : (
                  <Text style={[s.heroPhase, { color: P.textFaint }]}>No cycle logged</Text>
                )}

                {/* Tip */}
                {tip && (
                  <Text style={[s.heroTip, { color: P.textFaint }]}>{tip}</Text>
                )}
              </View>

              {/* Next period badge */}
              {nextPeriod && (
                <View style={[s.nextBadge, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
                  <Text style={[s.nextBadgeEye, { color: P.textFaint }]}>NEXT PERIOD</Text>
                  <Text style={[s.nextBadgeDate, { color: ACC }]}>{nextPeriod}</Text>
                  <View style={[s.nextBadgeDot, { backgroundColor: ACC }]} />
                </View>
              )}
            </>
          )}

          {/* Phase progress nodes */}
          {!isLoading && (
            <PhaseTrack activePhase={current?.phase} ACC={ACC} P={P} />
          )}
        </View>

        {/* ── Calendar ──────────────────────────────────────────────── */}
        <View style={[s.calWrap, { backgroundColor: P.card, borderColor: P.cardEdge }]}>

          {/* Month nav */}
          <View style={[s.calNav, { borderBottomColor: P.hair }]}>
            <Text style={[s.calMonth, { color: P.text }]}>
              {FULL_MONTHS[calMonth]}{' '}
              <Text style={[s.calYear, { color: P.textFaint }]}>{calYear}</Text>
            </Text>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <Pressable
                onPress={prevMonth}
                hitSlop={10}
                style={({ pressed }) => [s.calArrow, { backgroundColor: P.sunken }, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="chevron-back" size={15} color={P.textDim} />
              </Pressable>
              <Pressable
                onPress={nextMonth}
                hitSlop={10}
                style={({ pressed }) => [
                  s.calArrow,
                  { backgroundColor: P.sunken, opacity: canGoNext ? 1 : 0.25 },
                  pressed && canGoNext && { opacity: 0.6 },
                ]}
              >
                <Ionicons name="chevron-forward" size={15} color={P.textDim} />
              </Pressable>
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>

            {/* DOW header */}
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {DOW.map((d, i) => (
                <View key={i} style={{ width: CELL, alignItems: 'center' }}>
                  <Text style={[s.dow, { color: i === 0 ? ACC : P.textFaint }]}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Week rows */}
            {weeks.map((week, wi) => (
              <View key={wi} style={{ flexDirection: 'row', marginBottom: 2 }}>
                {week.map((day, di) => {
                  if (!day) return <View key={`b${wi}-${di}`} style={{ width: CELL, height: CELL }} />;

                  const isSel    = sameDay(day, selected);
                  const isToday  = sameDay(day, today);
                  const isFuture = day > today;
                  const isLogged = loggedDates.has(toIso(day));
                  const isSun    = di === 0;
                  const cs       = CELL - 8;

                  return (
                    <Pressable
                      key={toIso(day)}
                      disabled={isFuture}
                      onPress={() => setSelected(day)}
                      style={({ pressed }) => [
                        { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },
                        pressed && !isFuture && { opacity: 0.55 },
                      ]}
                    >
                      <View style={[
                        { width: cs, height: cs, borderRadius: cs / 2,
                          alignItems: 'center', justifyContent: 'center' },
                        isSel    && { backgroundColor: ACC },
                        !isSel && isToday && { borderWidth: 1.5, borderColor: ACC },
                        isFuture && { opacity: 0.2 },
                      ]}>
                        <Text style={[
                          s.dayNum,
                          { color: isSel ? '#fff' : isToday ? ACC : isSun ? ACC : P.text },
                        ]}>
                          {day.getDate()}
                        </Text>
                      </View>
                      {isLogged && !isSel && (
                        <View style={[s.logDot, { backgroundColor: ACC }]} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Selected date footer */}
          <View style={[s.calFooter, { borderTopColor: P.hair }]}>
            <Text style={[s.calFooterText, { color: P.textDim }]}>
              Period started{' '}
              <Text style={{ color: P.text, fontWeight: '700' }}>
                {selected.toLocaleDateString(undefined, {
                  weekday: 'short', month: 'short', day: 'numeric',
                })}
              </Text>
            </Text>
            <View style={[s.calFooterCheck, { backgroundColor: ACC }]}>
              <Ionicons name="checkmark" size={12} color="#fff" />
            </View>
          </View>
        </View>

        {/* ── Cycle length + save ───────────────────────────────────── */}
        <View style={[s.controlsWrap, { backgroundColor: P.card, borderColor: P.cardEdge }]}>

          {/* Cycle length */}
          <View style={[s.lenRow, { borderBottomColor: P.hair }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.lenLabel, { color: P.text }]}>Cycle length</Text>
              <Text style={[s.lenSub, { color: P.textFaint }]}>Average days per cycle</Text>
            </View>
            <View style={s.stepper}>
              <Pressable
                onPress={() => setCycleLength(l => Math.max(l - 1, 21))}
                style={({ pressed }) => [s.stepBtn, { borderColor: P.cardEdge }, pressed && { opacity: 0.55 }]}
              >
                <Ionicons name="remove" size={18} color={P.textDim} />
              </Pressable>
              <Text style={[s.stepVal, { color: P.text }]}>{cycleLength}</Text>
              <Pressable
                onPress={() => setCycleLength(l => Math.min(l + 1, 45))}
                style={({ pressed }) => [s.stepBtn, { borderColor: P.cardEdge }, pressed && { opacity: 0.55 }]}
              >
                <Ionicons name="add" size={18} color={P.textDim} />
              </Pressable>
            </View>
          </View>

          {/* Log button */}
          <Pressable
            onPress={handleLog}
            disabled={saving}
            style={({ pressed }) => [
              s.logBtn,
              { backgroundColor: ACC },
              pressed && { opacity: 0.88 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="flower-outline" size={17} color="#fff" />
                <Text style={s.logBtnText}>Log Period</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* ── History ───────────────────────────────────────────────── */}
        {history.length > 0 && (
          <View style={[s.histWrap, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
            <View style={[s.histHead, { borderBottomColor: P.hair }]}>
              <Text style={[s.histTitle, { color: P.text }]}>Period History</Text>
              <Text style={[s.histBadge, { color: P.textFaint, backgroundColor: P.sunken }]}>
                {history.length}
              </Text>
            </View>
            {history.map((log, i) => {
              const start = new Date(log.period_start_date);
              const nextD = log.predicted_next_period
                ? new Date(log.predicted_next_period).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : null;
              return (
                <View key={log.id}>
                  {i > 0 && <View style={[s.histDiv, { backgroundColor: P.hair }]} />}
                  <View style={s.histRow}>
                    {/* Timeline dot + line */}
                    <View style={s.histTimeline}>
                      <View style={[s.histDot, { backgroundColor: ACC }]} />
                      {i < history.length - 1 && (
                        <View style={[s.histLine, { backgroundColor: P.hair }]} />
                      )}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 20 }}>
                      <Text style={[s.histDate, { color: P.text }]}>
                        {start.toLocaleDateString(undefined, {
                          month: 'long', day: 'numeric', year: 'numeric',
                        })}
                      </Text>
                      <Text style={[s.histMeta, { color: P.textFaint }]}>
                        {log.cycle_length} days{nextD ? `  ·  next ~${nextD}` : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 12, gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  eyebrow:     { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 1 },
  headerTitle: { fontFamily: 'Syne_800ExtraBold', fontSize: 20, letterSpacing: -0.4 },
  todayPill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  todayPillText: { fontSize: 13, fontWeight: '700' },

  // Hero
  hero: {
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  heroLeft:    { flexDirection: 'column', marginBottom: 4 },
  heroNumRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 6 },
  heroDay: {
    fontFamily:    'BarlowCondensed_800ExtraBold',
    fontSize:       80,
    lineHeight:     76,
    letterSpacing: -2,
  },
  heroNumSub:    { flexDirection: 'column', paddingBottom: 8, gap: 2 },
  heroDayLabel:  { fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 14, letterSpacing: 0.5 },
  heroDayOf:     { fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 13, letterSpacing: 0.3 },
  heroPhaseRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  heroPhase:     { fontFamily: 'Syne_700Bold', fontSize: 16, letterSpacing: -0.2 },
  heroTip:       { fontSize: 13, fontWeight: '400', lineHeight: 19, marginTop: 4, maxWidth: '80%' },
  nextBadge: {
    position: 'absolute', top: 0, right: 0,
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14, paddingVertical: 10,
    alignItems: 'center', gap: 3,
  },
  nextBadgeEye:  { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  nextBadgeDate: { fontSize: 14, fontFamily: 'Syne_700Bold', letterSpacing: -0.3 },
  nextBadgeDot:  { width: 5, height: 5, borderRadius: 3, marginTop: 2 },

  // Calendar
  calWrap: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 12,
  },
  calNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  calMonth:  { fontFamily: 'Syne_700Bold', fontSize: 17, letterSpacing: -0.3 },
  calYear:   { fontFamily: 'Syne_700Bold', fontSize: 17, letterSpacing: -0.3 },
  calArrow:  { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  dow:    { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, paddingVertical: 4 },
  dayNum: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  logDot: { position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: 2 },

  calFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 6,
  },
  calFooterText:  { fontSize: 13, fontWeight: '500' },
  calFooterCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  // Controls
  controlsWrap: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 12,
  },
  lenRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lenLabel: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  lenSub:   { fontSize: 12, fontWeight: '400', marginTop: 2 },
  stepper:  { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn:  {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
  },
  stepVal: {
    fontFamily: 'BarlowCondensed_800ExtraBold',
    fontSize: 28, letterSpacing: -0.8,
    minWidth: 32, textAlign: 'center',
  },

  logBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, margin: 14, borderRadius: 14, paddingVertical: 15,
  },
  logBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },

  // History
  histWrap: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 12,
  },
  histHead: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  histTitle: { fontFamily: 'Syne_700Bold', fontSize: 15, letterSpacing: -0.2, flex: 1 },
  histBadge: {
    fontSize: 12, fontWeight: '700', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 8,
  },
  histDiv:      { height: StyleSheet.hairlineWidth, marginLeft: 20 + 16 + 12 },
  histRow:      { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 16 },
  histTimeline: { width: 28, alignItems: 'center', marginRight: 12, paddingTop: 3 },
  histDot:      { width: 10, height: 10, borderRadius: 5 },
  histLine:     { width: 1.5, flex: 1, marginTop: 6 },
  histDate:     { fontSize: 14, fontWeight: '700', letterSpacing: -0.2, marginBottom: 3 },
  histMeta:     { fontSize: 12, fontWeight: '400' },
});
