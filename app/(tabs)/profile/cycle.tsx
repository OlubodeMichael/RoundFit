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

import { usePalette } from '@/lib/log-theme';
import { useToast } from '@/components/ui/Toast';
import { useCycle } from '@/context/cycle-context';
import { useTheme } from '@/hooks/use-theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Accent ──────────────────────────────────────────────────────────────────
function useAcc() {
  const { isDark } = useTheme();
  return isDark ? '#FB7185' : '#E11D48';
}

// ─── Phase config ─────────────────────────────────────────────────────────────
const PHASE_META: Record<string, { label: string; icon: IoniconName; color: string; tip: string }> = {
  menstrual:  { label: 'Menstrual',  icon: 'water',      color: '#F43F5E', tip: 'Rest and gentle movement today.' },
  follicular: { label: 'Follicular', icon: 'leaf',       color: '#F97316', tip: 'Energy rising — good time for new goals.' },
  ovulation:  { label: 'Ovulation',  icon: 'sunny',      color: '#EAB308', tip: 'Peak strength and energy window.' },
  luteal:     { label: 'Luteal',     icon: 'moon',       color: '#8B5CF6', tip: 'Wind down and prioritise recovery.' },
};

// Phase segments (adjust luteal to fill remaining days)
function buildSegments(cycleLength: number) {
  const luteal = Math.max(cycleLength - 16, 10);
  return [
    { key: 'menstrual',  days: 5,      color: '#F43F5E', label: 'Menstrual' },
    { key: 'follicular', days: 8,      color: '#F97316', label: 'Follicular' },
    { key: 'ovulation',  days: 3,      color: '#EAB308', label: 'Ovulation' },
    { key: 'luteal',     days: luteal, color: '#8B5CF6', label: 'Luteal' },
  ];
}

// ─── Phase Progress Bar ───────────────────────────────────────────────────────
function PhaseBar({
  cycleDay,
  cycleLength,
  barWidth,
}: {
  cycleDay: number | null;
  cycleLength: number;
  barWidth: number;
}) {
  const P        = usePalette();
  const segments = buildSegments(cycleLength);
  const total    = segments.reduce((s, p) => s + p.days, 0);
  const BAR_H    = 8;
  const GAP      = 3;
  const usableW  = barWidth - GAP * (segments.length - 1);

  let cumulativeDays = 0;
  const progressX = cycleDay != null
    ? Math.min((cycleDay / cycleLength) * barWidth, barWidth - 1)
    : null;

  return (
    <View style={{ gap: 0 }}>
      {/* Segment bar */}
      <View style={{ flexDirection: 'row', gap: GAP, marginBottom: 10 }}>
        {segments.map((seg, i) => {
          const segW     = (seg.days / total) * usableW;
          const dayStart = cumulativeDays + 1;
          const dayEnd   = cumulativeDays + seg.days;
          cumulativeDays += seg.days;

          let fillRatio = 0;
          if (cycleDay != null) {
            if (cycleDay > dayEnd)    fillRatio = 1;
            else if (cycleDay >= dayStart) fillRatio = (cycleDay - dayStart + 1) / seg.days;
          }

          const isFirst = i === 0;
          const isLast  = i === segments.length - 1;
          const br      = { borderRadius: 6 };
          const brLeft  = { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 };
          const brRight = { borderTopRightRadius: 6, borderBottomRightRadius: 6 };

          return (
            <View
              key={seg.key}
              style={[
                { width: segW, height: BAR_H, overflow: 'hidden', backgroundColor: seg.color + '22' },
                isFirst && brLeft,
                isLast  && brRight,
                !isFirst && !isLast && {},
              ]}
            >
              <View
                style={[
                  { width: segW * fillRatio, height: BAR_H, backgroundColor: seg.color },
                  isFirst && brLeft,
                  isLast && fillRatio === 1 && brRight,
                ]}
              />
            </View>
          );
        })}
      </View>

      {/* Indicator dot */}
      {progressX != null && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            left: progressX - 8,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: '#fff',
            borderWidth: 3,
            borderColor: getCurrentPhaseColor(cycleDay ?? 0, cycleLength),
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
          }}
        />
      )}

      {/* Phase labels */}
      <View style={{ flexDirection: 'row', gap: GAP }}>
        {buildSegments(cycleLength).map((seg, i) => {
          const segW = (seg.days / total) * usableW;
          return (
            <Text
              key={seg.key}
              numberOfLines={1}
              style={{
                width: segW,
                fontSize: 9,
                fontWeight: '700',
                letterSpacing: 0.3,
                color: seg.color,
                opacity: 0.75,
                textAlign: i === 0 ? 'left' : i === segments.length - 1 ? 'right' : 'center',
              }}
            >
              {seg.label.slice(0, 3).toUpperCase()}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function getCurrentPhaseColor(cycleDay: number, cycleLength: number): string {
  const segs = buildSegments(cycleLength);
  let cum = 0;
  for (const seg of segs) {
    cum += seg.days;
    if (cycleDay <= cum) return seg.color;
  }
  return segs[segs.length - 1].color;
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────
const FULL_MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function toIso(d: Date) {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
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
  for (let i = 0; i < flat.length; i += 7) out.push(flat.slice(i, i+7));
  return out;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CycleTrackingScreen() {
  const P      = usePalette();
  const ACC    = useAcc();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast  = useToast();
  const { width: screenW } = useWindowDimensions();
  const { current, history, isLoading, logPeriod } = useCycle();

  const HPAD   = 20;
  const barW   = screenW - HPAD * 2;
  const CELL   = Math.floor((screenW - 72) / 7);
  const today  = useMemo(() => new Date(), []);

  const [calYear,     setCalYear]     = useState(today.getFullYear());
  const [calMonth,    setCalMonth]    = useState(today.getMonth());
  const [selected,    setSelected]    = useState<Date>(today);
  const [cycleLength, setCycleLength] = useState(history[0]?.cycle_length ?? 28);
  const [saving,      setSaving]      = useState(false);

  const weeks       = useMemo(() => buildWeeks(calYear, calMonth), [calYear, calMonth]);
  const loggedDates = useMemo(() => new Set(history.map(h => h.period_start_date)), [history]);

  const canGoNext = calYear < today.getFullYear()
    || (calYear === today.getFullYear() && calMonth < today.getMonth());

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y-1); setCalMonth(11); }
    else setCalMonth(m => m-1);
  }
  function nextMonth() {
    if (!canGoNext) return;
    if (calMonth === 11) { setCalYear(y => y+1); setCalMonth(0); }
    else setCalMonth(m => m+1);
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

  const cycleLen   = history[0]?.cycle_length ?? 28;
  const cycleDay   = current?.days_remaining != null
    ? Math.max(cycleLen - current.days_remaining, 1)
    : null;
  const phaseMeta  = current?.phase ? PHASE_META[current.phase] : null;
  const nextPeriod = current?.predicted_next_period
    ? new Date(current.predicted_next_period)
    : null;
  const nextPeriodStr = nextPeriod
    ? nextPeriod.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;
  const daysUntilNext = nextPeriod
    ? Math.ceil((nextPeriod.getTime() - today.getTime()) / 86400000)
    : null;

  const isViewingCurrentMonth = calYear === today.getFullYear() && calMonth === today.getMonth();

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 10, paddingHorizontal: HPAD }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={[s.backBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={18} color={P.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={[s.eyebrow, { color: P.textFaint }]}>WOMEN'S HEALTH</Text>
          <Text style={[s.headerTitle, { color: P.text }]}>Cycle Tracking</Text>
        </View>

        {!isViewingCurrentMonth && (
          <TouchableOpacity
            onPress={() => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); setSelected(today); }}
            style={[s.todayPill, { backgroundColor: ACC + '18', borderColor: ACC + '40' }]}
            activeOpacity={0.75}
          >
            <Text style={[s.todayPillText, { color: ACC }]}>Today</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <View style={[s.heroCard, { backgroundColor: P.card, borderColor: P.cardEdge, marginHorizontal: HPAD }]}>
          {isLoading ? (
            <ActivityIndicator color={ACC} size="large" style={{ paddingVertical: 32 }} />
          ) : (
            <>
              <View style={s.heroTop}>
                {/* Left: day + phase */}
                <View style={s.heroLeft}>
                  <View style={s.heroNumRow}>
                    <Text style={[s.heroDay, { color: P.text }]}>
                      {cycleDay ?? '—'}
                    </Text>
                    <View style={{ paddingBottom: 10, paddingLeft: 6 }}>
                      <Text style={[s.heroDaySub, { color: P.textFaint }]}>day of</Text>
                      <Text style={[s.heroDaySub, { color: P.textFaint }]}>{cycleLen}</Text>
                    </View>
                  </View>

                  {phaseMeta ? (
                    <View style={[s.phasePill, { backgroundColor: phaseMeta.color + '18' }]}>
                      <Ionicons name={phaseMeta.icon} size={11} color={phaseMeta.color} />
                      <Text style={[s.phasePillText, { color: phaseMeta.color }]}>
                        {phaseMeta.label} Phase
                      </Text>
                    </View>
                  ) : (
                    <View style={[s.phasePill, { backgroundColor: P.sunken }]}>
                      <Text style={[s.phasePillText, { color: P.textFaint }]}>No cycle logged</Text>
                    </View>
                  )}

                  {phaseMeta && (
                    <Text style={[s.heroTip, { color: P.textFaint }]}>{phaseMeta.tip}</Text>
                  )}
                </View>

                {/* Right: next period badge */}
                {nextPeriodStr && daysUntilNext != null && (
                  <View style={[s.nextBadge, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
                    <Text style={[s.nextEye, { color: P.textFaint }]}>NEXT</Text>
                    <Text style={[s.nextDate, { color: P.text }]}>{nextPeriodStr}</Text>
                    <View style={[s.nextDot, { backgroundColor: ACC }]}>
                      <Text style={s.nextDotText}>
                        {daysUntilNext <= 0 ? 'today' : `${daysUntilNext}d`}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Phase progress bar */}
              {cycleDay != null && (
                <View style={{ marginTop: 20 }}>
                  <PhaseBar cycleDay={cycleDay} cycleLength={cycleLen} barWidth={barW - 40} />
                </View>
              )}
            </>
          )}
        </View>

        {/* ── Quick stats ─────────────────────────────────────────────────── */}
        {!isLoading && (cycleDay != null || nextPeriodStr) && (
          <View style={[s.statsRow, { paddingHorizontal: HPAD }]}>
            <StatPill
              label="Cycle day"
              value={cycleDay != null ? `${cycleDay}` : '—'}
              unit={`of ${cycleLen}`}
              color={ACC}
              P={P}
            />
            <StatPill
              label="Next period"
              value={daysUntilNext != null ? (daysUntilNext <= 0 ? 'Today' : `${daysUntilNext}`) : '—'}
              unit={daysUntilNext != null && daysUntilNext > 0 ? 'days away' : ''}
              color={PHASE_META.menstrual.color}
              P={P}
            />
            <StatPill
              label="Remaining"
              value={current?.days_remaining != null ? `${current.days_remaining}` : '—'}
              unit="days left"
              color={PHASE_META.luteal.color}
              P={P}
            />
          </View>
        )}

        {/* ── Calendar ────────────────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: P.card, borderColor: P.cardEdge, marginHorizontal: HPAD }]}>

          {/* Month nav */}
          <View style={[s.calNav, { borderBottomColor: P.hair }]}>
            <Text style={[s.calMonth, { color: P.text }]}>
              {FULL_MONTHS[calMonth]}{' '}
              <Text style={{ color: P.textFaint }}>{calYear}</Text>
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable onPress={prevMonth} style={[s.calArrow, { backgroundColor: P.sunken }]} hitSlop={8}>
                <Ionicons name="chevron-back" size={14} color={P.textDim} />
              </Pressable>
              <Pressable
                onPress={nextMonth}
                style={[s.calArrow, { backgroundColor: P.sunken, opacity: canGoNext ? 1 : 0.25 }]}
                hitSlop={8}
              >
                <Ionicons name="chevron-forward" size={14} color={P.textDim} />
              </Pressable>
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            {/* DOW row */}
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {DOW.map((d, i) => (
                <View key={i} style={{ width: CELL, alignItems: 'center' }}>
                  <Text style={[s.dow, { color: i === 0 ? ACC : P.textFaint }]}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Weeks */}
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
                        { width: cs, height: cs, borderRadius: cs/2, alignItems: 'center', justifyContent: 'center' },
                        isSel   && { backgroundColor: ACC },
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[s.footerDot, { backgroundColor: ACC }]} />
              <Text style={[s.calFooterText, { color: P.textDim }]}>
                Period started{' '}
                <Text style={{ color: P.text, fontWeight: '700' }}>
                  {selected.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={18} color={ACC} />
          </View>
        </View>

        {/* ── Log controls ─────────────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: P.card, borderColor: P.cardEdge, marginHorizontal: HPAD }]}>

          <View style={[s.lenRow, { borderBottomColor: P.hair }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.lenLabel, { color: P.text }]}>Cycle length</Text>
              <Text style={[s.lenSub, { color: P.textFaint }]}>Average days per cycle</Text>
            </View>
            <View style={s.stepper}>
              <Pressable
                onPress={() => setCycleLength(l => Math.max(l-1, 21))}
                style={[s.stepBtn, { borderColor: P.cardEdge, backgroundColor: P.sunken }]}
              >
                <Ionicons name="remove" size={16} color={P.textDim} />
              </Pressable>
              <Text style={[s.stepVal, { color: P.text }]}>{cycleLength}</Text>
              <Pressable
                onPress={() => setCycleLength(l => Math.min(l+1, 45))}
                style={[s.stepBtn, { borderColor: P.cardEdge, backgroundColor: P.sunken }]}
              >
                <Ionicons name="add" size={16} color={P.textDim} />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={handleLog}
            disabled={saving}
            style={({ pressed }) => [
              s.logBtn,
              { backgroundColor: ACC, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="flower-outline" size={16} color="#fff" />
                <Text style={s.logBtnText}>Log Period</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* ── History ─────────────────────────────────────────────────────── */}
        {history.length > 0 && (
          <View style={[s.card, { backgroundColor: P.card, borderColor: P.cardEdge, marginHorizontal: HPAD }]}>
            <View style={[s.histHead, { borderBottomColor: P.hair }]}>
              <Text style={[s.histTitle, { color: P.text }]}>Period History</Text>
              <View style={[s.histBadge, { backgroundColor: P.sunken }]}>
                <Text style={[s.histBadgeText, { color: P.textFaint }]}>{history.length}</Text>
              </View>
            </View>

            {history.map((log, i) => {
              const start = new Date(log.period_start_date);
              const nextD = log.predicted_next_period
                ? new Date(log.predicted_next_period).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : null;
              return (
                <View key={log.id} style={[s.histRow, { borderBottomColor: P.hair, borderBottomWidth: i < history.length - 1 ? StyleSheet.hairlineWidth : 0 }]}>
                  <View style={[s.histDot, { backgroundColor: ACC + '20' }]}>
                    <View style={[s.histDotInner, { backgroundColor: ACC }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.histDate, { color: P.text }]}>
                      {start.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <Text style={[s.histMeta, { color: P.textFaint }]}>
                      {log.cycle_length} days{nextD ? `  ·  next ~${nextD}` : ''}
                    </Text>
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

// ─── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({
  label, value, unit, color, P,
}: {
  label: string; value: string; unit: string; color: string;
  P: ReturnType<typeof usePalette>;
}) {
  return (
    <View style={[sp.wrap, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
      <View style={[sp.dot, { backgroundColor: color + '20' }]}>
        <View style={[sp.dotInner, { backgroundColor: color }]} />
      </View>
      <Text style={[sp.value, { color: P.text }]}>{value}</Text>
      <Text style={[sp.unit, { color: P.textFaint }]}>{unit || label}</Text>
      {unit ? <Text style={[sp.label, { color: P.textFaint }]}>{label}</Text> : null}
    </View>
  );
}

const sp = StyleSheet.create({
  wrap:     { flex: 1, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 4 },
  dot:      { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  dotInner: { width: 8, height: 8, borderRadius: 4 },
  value:    { fontFamily: 'BarlowCondensed_800ExtraBold', fontSize: 28, letterSpacing: -0.5, lineHeight: 30 },
  unit:     { fontSize: 11, fontWeight: '500', letterSpacing: 0.1 },
  label:    { fontSize: 10, fontWeight: '400' },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingBottom:  16,
    gap:            12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  eyebrow:      { fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 1 },
  headerTitle:  { fontFamily: 'Syne_800ExtraBold', fontSize: 19, letterSpacing: -0.3 },
  todayPill:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  todayPillText:{ fontSize: 12, fontWeight: '700' },

  // Hero
  heroCard: {
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
    padding: 20, marginBottom: 12,
  },
  heroTop:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroLeft:   { flex: 1 },
  heroNumRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  heroDay: {
    fontFamily:    'BarlowCondensed_800ExtraBold',
    fontSize:       80,
    lineHeight:     72,
    letterSpacing: -2,
  },
  heroDaySub: { fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 13, letterSpacing: 0.3, lineHeight: 16 },

  phasePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  phasePillText: { fontSize: 12, fontWeight: '700', letterSpacing: -0.1 },
  heroTip:       { fontSize: 12, lineHeight: 18, marginTop: 8, maxWidth: '90%', fontWeight: '400' },

  nextBadge: {
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12, paddingVertical: 10,
    alignItems: 'center', gap: 3, minWidth: 80,
  },
  nextEye:     { fontSize: 8, fontWeight: '800', letterSpacing: 1.5 },
  nextDate:    { fontFamily: 'Syne_700Bold', fontSize: 13, letterSpacing: -0.2 },
  nextDot:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, marginTop: 2 },
  nextDotText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },

  // Generic card
  card: {
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden', marginBottom: 12,
  },

  // Calendar
  calNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  calMonth: { fontFamily: 'Syne_700Bold', fontSize: 15, letterSpacing: -0.2 },
  calArrow: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dow:      { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, paddingVertical: 4 },
  dayNum:   { fontSize: 14, fontWeight: '600' },
  logDot:   { position: 'absolute', bottom: 2, width: 3, height: 3, borderRadius: 2 },
  calFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, marginTop: 6,
  },
  footerDot:     { width: 6, height: 6, borderRadius: 3 },
  calFooterText: { fontSize: 12, fontWeight: '500' },

  // Controls
  lenRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lenLabel: { fontSize: 14, fontWeight: '700', letterSpacing: -0.1 },
  lenSub:   { fontSize: 11, marginTop: 2 },
  stepper:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn:  {
    width: 32, height: 32, borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
  },
  stepVal: {
    fontFamily: 'BarlowCondensed_800ExtraBold',
    fontSize: 26, letterSpacing: -0.5,
    minWidth: 30, textAlign: 'center',
  },

  logBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, margin: 14, borderRadius: 13, paddingVertical: 14,
  },
  logBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: -0.1 },

  // History
  histHead: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  histTitle:     { fontFamily: 'Syne_700Bold', fontSize: 14, letterSpacing: -0.1, flex: 1 },
  histBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  histBadgeText: { fontSize: 11, fontWeight: '700' },
  histRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  histDot:      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  histDotInner: { width: 10, height: 10, borderRadius: 5 },
  histDate:     { fontSize: 13, fontWeight: '700', letterSpacing: -0.1, marginBottom: 2 },
  histMeta:     { fontSize: 11 },
});
