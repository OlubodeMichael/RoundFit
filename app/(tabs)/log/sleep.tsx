import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle } from 'react-native-svg';

import {
  AnimatedCard,
  FieldLabel,
  MiniLabel,
  NotesField,
  PrimaryButton,
  TextField,
  usePalette,
} from '@/lib/log-theme';
import { SleepHypnogram } from '@/components/log/SleepHypnogram';
import { SleepTimePicker } from '@/components/log/SleepTimePicker';
import { AnnouncementModal } from '@/components/ui/AnnouncementModal';
import { useToast } from '@/components/ui/Toast';
import { useHealth } from '@/hooks/use-health';
import { useRecovery } from '@/hooks/use-recovery';
import { usePostHog } from 'posthog-react-native';
import { ForceDarkScope } from '@/context/theme-context';
import {
  getHealthKitModule,
  readSleepSegmentsForNight,
  type SleepSegment,
} from '@/utils/healthkit';
import type { SleepQuality } from '@/context/recovery-context';
import type { HealthData } from '@/context/health-context';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type Quality = 'poor' | 'fair' | 'good' | 'great';

const QUALITY: { id: Quality; label: string; icon: IoniconName }[] = [
  { id: 'poor',  label: 'Poor',  icon: 'cloud-outline'         },
  { id: 'fair',  label: 'Fair',  icon: 'partly-sunny-outline'  },
  { id: 'good',  label: 'Good',  icon: 'sunny-outline'         },
  { id: 'great', label: 'Great', icon: 'sparkles-outline'      },
];

// ── Date helpers ───────────────────────────────────────────────────────────

function localDateString(d = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function offsetDate(base: string, days: number): string {
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDateString(d);
}

function formatNavDate(iso: string): string {
  const today = localDateString();
  if (iso === today) return 'Today';
  if (iso === offsetDate(today, -1)) return 'Yesterday';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatStageTime(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function QualityRing({
  quality,
  score: scoreProp,
  size = 54,
  strokeWidth = 5,
}: {
  quality: Quality;
  score?: number | null;
  size?: number;
  strokeWidth?: number;
}) {
  const P     = usePalette();
  const score = scoreProp ?? qualityPct(quality);
  const color = qualityRingColor(P, quality);
  const r      = (size - strokeWidth) / 2;
  const cx     = size / 2;
  const cy     = size / 2;
  const circ   = 2 * Math.PI * r;
  const filled = (score / 100) * circ;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={P.hair} strokeWidth={strokeWidth} />
        <Circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${cx},${cy}`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color }}>{score}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Star field + atmospheric glow ─────────────────────────────────────────
function StarFieldBackground() {
  const { width, height } = useWindowDimensions();

  // Deterministic star positions — seeded via sin/cos so they never re-randomize
  const stars = useMemo(() => {
    const count = 90;
    return Array.from({ length: count }, (_, i) => {
      const sx = Math.abs(Math.sin(i * 127.1) * 99991) % 1;
      const sy = Math.abs(Math.sin(i * 311.7) * 99991) % 1;
      const sr = Math.abs(Math.sin(i * 513.3) * 99991) % 1;
      const so = Math.abs(Math.sin(i * 719.9) * 99991) % 1;
      return {
        cx: sx * width,
        cy: sy * height,
        r:  sr < 0.7 ? 0.6 : sr < 0.92 ? 1.1 : 1.6,
        opacity: 0.15 + so * 0.55,
      };
    });
  }, [width, height]);

  return (
    <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 0 }} pointerEvents="none">
      {/* Violet atmospheric glow — top centre */}
      <LinearGradient
        colors={['rgba(88,60,180,0.28)', 'rgba(60,40,130,0.10)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.52 }}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      {/* Secondary indigo glow — upper-right bloom */}
      <LinearGradient
        colors={['rgba(100,60,200,0.14)', 'transparent']}
        style={{ position: 'absolute', top: 0, right: 0, width: width * 0.7, height: height * 0.35 }}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      {/* Stars */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFillObject}>
        {stars.map((s, i) => (
          <Circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="white"
            opacity={s.opacity}
          />
        ))}
      </Svg>
    </View>
  );
}

// ── Wrapper: forces dark palette for the entire screen tree ────────────────
export default function SleepLogScreenWrapper() {
  return (
    <ForceDarkScope>
      <SleepLogScreen />
    </ForceDarkScope>
  );
}

function SleepLogScreen() {
  const P               = usePalette();
  const router          = useRouter();
  const insets          = useSafeAreaInsets();
  const toast           = useToast();
  const health          = useHealth();
  const { logRecovery } = useRecovery();
  const posthog         = usePostHog();

  // ── Date navigation ────────────────────────────────────────────────────────
  const today = localDateString();
  const [activeDate, setActiveDate] = useState(today);
  const isToday = activeDate === today;

  const navigateDate = (dir: -1 | 1) => {
    const next = offsetDate(activeDate, dir);
    if (next > today) return;
    setActiveDate(next);
  };

  const segmentCache  = useRef<Map<string, SleepSegment[]>>(new Map());

  // ── Per-date health data ───────────────────────────────────────────────────
  const [dateHealthData, setDateHealthData] = useState<HealthData | null>(null);
  const [loadingDate,    setLoadingDate]    = useState(false);

  const hkSleep = useMemo(() => {
    const hk = isToday ? health.today : dateHealthData;
    return hk && typeof hk.sleep_hours === 'number' && hk.sleep_hours > 0 ? hk : null;
  }, [isToday, health.today, dateHealthData]);

  useEffect(() => {
    if (isToday) {
      setDateHealthData(null);
      setLoadingDate(false);
      return;
    }
    let cancelled = false;
    setLoadingDate(true);
    health.fetchForDate(activeDate, false)
      .then((data) => {
        if (!cancelled) setDateHealthData(data);
      })
      .catch(() => {
        if (!cancelled) setDateHealthData(null);
      })
      .finally(() => { if (!cancelled) setLoadingDate(false); });
    return () => { cancelled = true; };
  }, [activeDate, isToday, health.fetchForDate]);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [fromHealthKit, setFromHealthKit] = useState(false);
  const [bedtime,      setBedtime]      = useState('11:00 PM');
  const [wakeup,       setWakeup]       = useState('7:00 AM');
  const [quality,      setQuality]      = useState<Quality>('good');
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [deepH,    setDeepH]   = useState('');
  const [deepM,    setDeepM]   = useState('');
  const [notes,    setNotes]   = useState('');
  const [saving,              setSaving]              = useState(false);
  const [pickerVisible,       setPickerVisible]       = useState(false);
  const [noSleepModalVisible, setNoSleepModalVisible] = useState(false);
  const [qualityExpanded,     setQualityExpanded]     = useState(false);
  const [notesExpanded,       setNotesExpanded]       = useState(false);

  // ── Sleep stage segments (for hypnogram chart) ─────────────────────────────
  const [sleepSegments,   setSleepSegments]   = useState<SleepSegment[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);

  useEffect(() => {
    // Clear stale segments from a previous date immediately
    setSleepSegments([]);

    // Only serve non-empty results from cache — empty results are not cached so
    // we always retry (handles transient HealthKit permission/timing failures)
    const cached = segmentCache.current.get(activeDate);
    if (cached && cached.length > 0) {
      setSleepSegments(cached);
      return;
    }

    const hk = getHealthKitModule();
    if (!hk) return;

    setSegmentsLoading(true);
    let cancelled = false;
    readSleepSegmentsForNight(hk, activeDate).then((segs) => {
      if (!cancelled) {
        if (segs.length > 0) {
          segmentCache.current.set(activeDate, segs);
        }
        setSleepSegments(segs);
        setSegmentsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [activeDate]);

  const populateFromHealthKit = useCallback((hk: HealthData) => {
    setFromHealthKit(true);
    const { quality: q, score: s } = computeSleepQuality({
      sleep_hours:      hk.sleep_hours!,
      deep_sleep_hours: hk.deep_sleep_hours,
      rem_sleep_hours:  hk.rem_sleep_hours,
      sleep_efficiency: hk.sleep_efficiency,
    });
    setQuality(q);
    setQualityScore(s);
    if (hk.deep_sleep_hours !== null && hk.deep_sleep_hours > 0) {
      const totalMin = Math.round(hk.deep_sleep_hours * 60);
      setDeepH(String(Math.floor(totalMin / 60)));
      setDeepM(String(totalMin % 60));
    } else {
      setDeepH('');
      setDeepM('');
    }
    if (hk.bedtime_iso) {
      setBedtime(isoToClockString(hk.bedtime_iso));
    } else {
      const est = estimateBedtime(hk.sleep_hours!);
      setBedtime(est.bedtime);
    }
    if (hk.wakeup_iso) {
      setWakeup(isoToClockString(hk.wakeup_iso));
    } else {
      setWakeup('7:00 AM');
    }
  }, []);

  useEffect(() => {
    setFromHealthKit(false);
    setBedtime('11:00 PM');
    setWakeup('7:00 AM');
    setQuality('good');
    setQualityScore(null);
    setDeepH('');
    setDeepM('');
    setNotes('');
    setNotesExpanded(false);
    setQualityExpanded(false);
  }, [activeDate]);

  useEffect(() => {
    if (hkSleep && !fromHealthKit) {
      populateFromHealthKit(hkSleep);
    }
  }, [hkSleep, fromHealthKit, populateFromHealthKit]);

  useEffect(() => {
    if (isToday && !loadingDate && health.isConnected && !hkSleep) {
      setNoSleepModalVisible(true);
    } else {
      setNoSleepModalVisible(false);
    }
  }, [isToday, loadingDate, hkSleep, health.isConnected]);

  // ── Computed values ────────────────────────────────────────────────────────
  // When HealthKit is the source, render its "Time Asleep" directly. Deriving
  // from bedtime → wakeup would include any awake gaps and disagree with the
  // Health app (which shows time-asleep, not the in-bed window spread).
  const hours = useMemo(() => {
    if (fromHealthKit && hkSleep && hkSleep.sleep_hours > 0) {
      const totalMin = Math.round(hkSleep.sleep_hours * 60);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return {
        hours:    h,
        minutes:  m,
        rawHours: hkSleep.sleep_hours,
        label:    `${h}h ${String(m).padStart(2, '0')}m`,
      };
    }
    return computeHours(bedtime, wakeup);
  }, [fromHealthKit, hkSleep, bedtime, wakeup]);

  // True while we're waiting for data to arrive — suppresses default-value flash
  const heroLoading = !fromHealthKit && (loadingDate || !!hkSleep);

  const hasSegments = useMemo(
    () => sleepSegments.some((s) =>
      ['awake', 'rem', 'core', 'deep'].includes(s.stage),
    ),
    [sleepSegments],
  );

  const stageSummary = useMemo(() => {
    const sum = (stage: string) =>
      sleepSegments
        .filter((s) => s.stage === stage)
        .reduce((acc, s) => acc + s.end.getTime() - s.start.getTime(), 0);
    const remMs   = sum('rem');
    const lightMs = sum('core');
    const deepMs  = sum('deep');
    const awakeMs = sum('awake');
    const totalMs = remMs + lightMs + deepMs;
    const pct = (ms: number) => totalMs > 0 ? Math.round((ms / totalMs) * 100) : 0;
    return [
      { label: 'REM',   ms: remMs,   pct: pct(remMs),   color: P.sleep },
      { label: 'LIGHT', ms: lightMs, pct: pct(lightMs), color: P.water },
      { label: 'DEEP',  ms: deepMs,  pct: pct(deepMs),  color: P.fat   },
      { label: 'AWAKE', ms: awakeMs, pct: pct(awakeMs), color: P.carbs },
    ];
  }, [sleepSegments, P.sleep, P.water, P.fat, P.carbs]);

  const fullCycles = useMemo(
    () => sleepSegments.filter((s) => s.stage === 'rem').length,
    [sleepSegments],
  );

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const apiQuality: SleepQuality = quality === 'great' ? 'good' : quality;
      const sleepH = hours.rawHours > 0 ? hours.rawHours : (hkSleep?.sleep_hours ?? 0);
      const deepSleepH = (() => {
        const h = parseInt(deepH) || 0;
        const m = parseInt(deepM) || 0;
        return h > 0 || m > 0 ? h + m / 60 : (hkSleep?.deep_sleep_hours ?? undefined);
      })();
      const source = fromHealthKit ? 'healthkit' : 'manual';

      await logRecovery({
        sleep_hours:      sleepH > 0 ? sleepH : undefined,
        sleep_quality:    apiQuality,
        sleep_score:      qualityScore ?? undefined,
        deep_sleep_hours: deepSleepH,
        rem_sleep_hours:  hkSleep?.rem_sleep_hours ?? undefined,
        notes:            notes.trim() || undefined,
        source,
        date:             isToday ? undefined : activeDate,
      });

      if (sleepH > 0) {
        await health.syncHealth({
          source,
          date:             isToday ? undefined : activeDate,
          sleep_hours:      sleepH,
          sleep_quality:    apiQuality,
          deep_sleep_hours: deepSleepH,
          rem_sleep_hours:  hkSleep?.rem_sleep_hours ?? undefined,
          bedtime_iso:      hkSleep?.bedtime_iso ?? clockToIso(bedtime, activeDate, 'bedtime') ?? undefined,
          wakeup_iso:       hkSleep?.wakeup_iso  ?? clockToIso(wakeup,  activeDate, 'wakeup')  ?? undefined,
        });
      }

      posthog.capture('sleep_logged', {
        sleep_hours: sleepH,
        quality,
        source,
        is_today: isToday,
      });
      toast.success('Sleep logged', `${hours.label} · ${capital(quality)}`);
    } catch (err) {
      toast.error('Could not save', 'Please try again');
      const e = err instanceof Error ? err : new Error(String(err));
      posthog.capture('$exception', {
        $exception_list: [{ type: e.name, value: e.message, stacktrace: { type: 'raw', frames: e.stack ?? '' } }],
        $exception_source: 'sleep_logged',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <StatusBar style="light" />
      <StarFieldBackground />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={[sleepStyles.header, { paddingTop: insets.top + 4 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={10}
            activeOpacity={0.7}
            style={[sleepStyles.iconBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}
          >
            <Ionicons name="chevron-back" size={20} color={P.text} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <Text style={[sleepStyles.eyebrow, { color: P.textFaint }]}>SLEEP</Text>

            <View style={[sleepStyles.datePill, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
              <TouchableOpacity
                onPress={() => navigateDate(-1)}
                hitSlop={8}
                activeOpacity={0.6}
                style={sleepStyles.dateArrow}
              >
                <Ionicons name="chevron-back" size={16} color={P.textDim} />
              </TouchableOpacity>

              <View style={sleepStyles.dateLabelWrap}>
                {isToday && (
                  <View style={[sleepStyles.todayDot, { backgroundColor: P.sleep }]} />
                )}
                <Text style={[sleepStyles.dateLabel, { color: P.text }]}>
                  {formatNavDate(activeDate)}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => navigateDate(1)}
                hitSlop={8}
                activeOpacity={isToday ? 1 : 0.6}
                disabled={isToday}
                style={sleepStyles.dateArrow}
              >
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={isToday ? P.cardEdge : P.textDim}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ width: 38 }} />
        </View>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 28 }}>
          {!heroLoading && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Text style={{ color: P.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 1.8 }}>
                ASLEEP
              </Text>
              <Text style={{ color: P.textDim, fontSize: 13, fontWeight: '600', letterSpacing: -0.2 }}>
                {bedtime}
                <Text style={{ color: P.textFaint }}>{' → '}</Text>
                {wakeup}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={[sleepStyles.heroNum, { color: P.text }]}>
              {heroLoading ? '—' : String(hours.hours)}
            </Text>
            {!heroLoading && (
              <Text style={[sleepStyles.heroSub, { color: P.textDim, paddingBottom: 14, marginLeft: 2 }]}>
                h
              </Text>
            )}
            {!heroLoading && <View style={{ width: 12 }} />}
            <Text style={[sleepStyles.heroNum, { color: P.text }]}>
              {heroLoading ? '' : String(hours.minutes).padStart(2, '0')}
            </Text>
            {!heroLoading && (
              <Text style={[sleepStyles.heroSub, { color: P.textDim, paddingBottom: 14, marginLeft: 2 }]}>
                m
              </Text>
            )}
          </View>
        </View>

        {/* ── Apple Health banner ──────────────────────────────────────────── */}
        {fromHealthKit && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <View style={[sleepStyles.hkBanner, { backgroundColor: P.waterSoft, borderColor: P.water + '40' }]}>
              <Ionicons name="logo-apple" size={13} color="#EF4444" />
              <Text style={[sleepStyles.hkBannerText, { color: P.water }]}>
                Synced from Apple Health
              </Text>
              <View style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {/* ── Sleep Stages ─────────────────────────────────────────────────── */}
        {fromHealthKit && (segmentsLoading || hasSegments) && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <View style={sleepStyles.sectionHeader}>
              <Text style={[sleepStyles.sectionLabel, { color: P.textFaint }]}>SLEEP STAGES</Text>
              {!segmentsLoading && fullCycles > 0 && (
                <Text style={[sleepStyles.sectionSub, { color: P.textFaint }]}>
                  {fullCycles} full {fullCycles === 1 ? 'cycle' : 'cycles'}
                </Text>
              )}
            </View>
            <AnimatedCard delay={90} padding={16}>
              {segmentsLoading && !hasSegments ? (
                <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color={P.sleep} />
                </View>
              ) : (
                <SleepHypnogram
                  segments={sleepSegments}
                  windowStart={hkSleep?.bedtime_iso ? new Date(hkSleep.bedtime_iso) : undefined}
                  windowEnd={hkSleep?.wakeup_iso   ? new Date(hkSleep.wakeup_iso)   : undefined}
                />
              )}
              {hasSegments && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                  {stageSummary.map((st) =>
                    st.ms > 0 ? (
                      <View
                        key={st.label}
                        style={[sleepStyles.stagePill, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <View style={[sleepStyles.stageDot, { backgroundColor: st.color }]} />
                          <Text style={{ color: P.textFaint, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 }}>
                            {st.label}
                          </Text>
                        </View>
                        <Text style={{ color: P.text, fontSize: 13, fontWeight: '800', letterSpacing: -0.3 }}>
                          {formatStageTime(st.ms)}
                        </Text>
                        <Text style={{ color: P.textFaint, fontSize: 10, fontWeight: '600', marginTop: 1 }}>
                          {st.pct}%
                        </Text>
                      </View>
                    ) : null,
                  )}
                </View>
              )}
            </AnimatedCard>
          </View>
        )}

        {/* ── Bedtime / Wakeup (manual only) ───────────────────────────────── */}
        {!fromHealthKit && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <AnimatedCard delay={120} onPress={() => setPickerVisible(true)}>
              <FieldLabel>Sleep window</FieldLabel>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <MiniLabel>Bedtime</MiniLabel>
                  <Text style={{ color: P.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 }}>
                    {bedtime}
                  </Text>
                </View>
                <View style={{ width: 1, height: 36, backgroundColor: P.cardEdge }} />
                <View style={{ flex: 1 }}>
                  <MiniLabel>Wake up</MiniLabel>
                  <Text style={{ color: P.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 }}>
                    {wakeup}
                  </Text>
                </View>
                <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: P.sleepSoft }}>
                  <Ionicons name="time-outline" size={17} color={P.sleep} />
                </View>
              </View>
            </AnimatedCard>
          </View>
        )}

        <SleepTimePicker
          visible={pickerVisible}
          bedtime={bedtime}
          wakeup={wakeup}
          onConfirm={(b, w) => {
            setBedtime(b);
            setWakeup(w);
            setPickerVisible(false);
          }}
          onCancel={() => setPickerVisible(false)}
        />

        {/* ── Sleep Quality ────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
          <AnimatedCard
            delay={180}
            onPress={!fromHealthKit ? () => setQualityExpanded((v) => !v) : undefined}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <QualityRing quality={quality} score={qualityScore} size={72} strokeWidth={6} />
              <View style={{ flex: 1 }}>
                <Text style={[sleepStyles.heroEyebrow, { color: P.textFaint }]}>SLEEP QUALITY</Text>
                <Text style={{ color: P.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 3 }}>
                  {capital(quality)}
                </Text>
              </View>
              {fromHealthKit && hkSleep?.sleep_efficiency != null ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[sleepStyles.heroEyebrow, { color: P.textFaint }]}>EFFIC.</Text>
                  <Text style={{ color: P.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 }}>
                    {Math.round(hkSleep.sleep_efficiency)}%
                  </Text>
                </View>
              ) : !fromHealthKit ? (
                <Ionicons
                  name={qualityExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={P.textFaint}
                />
              ) : null}
            </View>

            {qualityExpanded && !fromHealthKit && (
              <View style={[sleepStyles.qualityRow, { marginTop: 14 }]}>
                {QUALITY.map((q) => {
                  const active = q.id === quality;
                  const color  = qualityColor(P, q.id);
                  return (
                    <Pressable
                      key={q.id}
                      onPress={() => setQuality(q.id)}
                      style={({ pressed }) => [
                        sleepStyles.qualityPill,
                        {
                          backgroundColor: active ? color : P.sunken,
                          borderColor:     active ? color : P.cardEdge,
                        },
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Ionicons name={q.icon} size={16} color={active ? '#fff' : color} />
                      <Text style={[sleepStyles.qualityLabel, { color: active ? '#fff' : P.text }]}>
                        {q.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </AnimatedCard>
        </View>

        {/* ── How did it feel? / Notes ─────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
          <AnimatedCard delay={240} onPress={() => setNotesExpanded((v) => !v)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: P.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 }}>
                  How did it feel?
                </Text>
                <Text style={{ color: P.textFaint, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                  Add dreams, disruptions, late caffeine
                </Text>
              </View>
              {notesExpanded ? (
                <Ionicons name="chevron-up" size={16} color={P.textFaint} />
              ) : (
                <View style={[sleepStyles.notesPill, { borderColor: P.cardEdge }]}>
                  <Text style={{ color: P.textDim, fontSize: 12, fontWeight: '700' }}>+ Notes</Text>
                </View>
              )}
            </View>
            {notesExpanded && (
              <View style={{ marginTop: 12 }}>
                <NotesField
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Dreams, disruptions, caffeine late?"
                />
              </View>
            )}
          </AnimatedCard>
        </View>

        {/* ── Deep sleep (manual only) ──────────────────────────────────────── */}
        {!fromHealthKit && (
          <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
            <AnimatedCard delay={300}>
              <FieldLabel>Deep sleep (optional)</FieldLabel>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <TextField
                    value={deepH}
                    onChangeText={setDeepH}
                    placeholder="0"
                    keyboardType="number-pad"
                    unit="hr"
                  />
                </View>
                <Text style={{ color: P.textFaint, fontSize: 18, fontWeight: '700', marginBottom: 2 }}>:</Text>
                <View style={{ flex: 1 }}>
                  <TextField
                    value={deepM}
                    onChangeText={setDeepM}
                    placeholder="00"
                    keyboardType="number-pad"
                    unit="min"
                  />
                </View>
              </View>
            </AnimatedCard>
          </View>
        )}

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <PrimaryButton
            label={isToday ? 'Save sleep log' : `Save for ${formatNavDate(activeDate)}`}
            icon="checkmark"
            onPress={handleSave}
            loading={saving}
            accent={P.sleep}
          />
          {!fromHealthKit && (
            <Text style={[sleepStyles.hint, { color: P.textFaint }]}>
              Connect Apple Health to sync sleep automatically.
            </Text>
          )}
        </View>
      </ScrollView>

      <AnnouncementModal
        visible={noSleepModalVisible}
        onClose={() => setNoSleepModalVisible(false)}
        icon="moon"
        iconColor={P.sleep}
        iconBg={P.sleepSoft}
        title="No Sleep Detected"
        description={`Apple Health didn't find any sleep data for ${formatNavDate(activeDate).toLowerCase()}. Enter your sleep time below to log it manually.`}
        primaryLabel="Log Manually"
        dismissLabel="Maybe Later"
      />
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function clockToIso(
  clock: string,
  wakeDate: string,
  role: 'bedtime' | 'wakeup',
): string | null {
  const parsed = parseClock(clock);
  if (!parsed) return null;
  const [y, mo, d] = wakeDate.split('-').map(Number);
  if (role === 'wakeup') {
    return new Date(y, (mo ?? 1) - 1, d ?? 1, parsed.h, parsed.m, 0, 0).toISOString();
  }
  const isPM = parsed.h >= 12;
  const date = isPM
    ? new Date(y, (mo ?? 1) - 1, (d ?? 1) - 1, parsed.h, parsed.m, 0, 0)
    : new Date(y, (mo ?? 1) - 1,  d ?? 1,        parsed.h, parsed.m, 0, 0);
  return date.toISOString();
}

function isoToClockString(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function parseClock(value: string): { h: number; m: number } | null {
  const m = value.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const mer = m[3];
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (mer === 'PM' && h < 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

function computeHours(bedtime: string, wake: string) {
  const b = parseClock(bedtime);
  const w = parseClock(wake);
  if (!b || !w) return { hours: 0, minutes: 0, rawHours: 0, label: '—' };
  const bedMin  = b.h * 60 + b.m;
  const wakeMin = w.h * 60 + w.m;
  let diff = wakeMin - bedMin;
  if (diff <= 0) diff += 24 * 60;
  const hours    = Math.floor(diff / 60);
  const minutes  = diff % 60;
  const rawHours = diff / 60;
  return { hours, minutes, rawHours, label: `${hours}h ${String(minutes).padStart(2, '0')}m` };
}

function estimateBedtime(sleepHours: number): { bedtime: string; wakeup: string } {
  const wakeMin       = 7 * 60;
  const totalSleepMin = Math.round(sleepHours * 60);
  let bedTotalMin     = wakeMin - totalSleepMin;
  if (bedTotalMin < 0) bedTotalMin += 24 * 60;
  const bH   = Math.floor(bedTotalMin / 60);
  const bM   = bedTotalMin % 60;
  const isPM = bH >= 12 && bH < 24;
  const bH12 = bH % 12 || 12;
  return {
    bedtime: `${bH12}:${String(bM).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`,
    wakeup:  '7:00 AM',
  };
}

function computeSleepQuality(hk: {
  sleep_hours:       number;
  deep_sleep_hours?: number | null;
  rem_sleep_hours?:  number | null;
  sleep_efficiency?: number | null;
}): { score: number; quality: Quality } {
  const h = hk.sleep_hours;

  // Duration (weight 4) — NSF recommendation 7–9 h
  let durationScore: number;
  if (h >= 7 && h <= 9)       durationScore = 1.00;
  else if (h >= 6.5)           durationScore = 0.80;
  else if (h >= 6)             durationScore = 0.55;
  else if (h >= 5)             durationScore = 0.30;
  else                         durationScore = 0.05;

  let weightedSum = durationScore * 4;
  let totalWeight = 4;

  // Efficiency (weight 3) — ≥85% clinically "good"
  if (hk.sleep_efficiency != null && hk.sleep_efficiency > 0) {
    const eff = hk.sleep_efficiency;
    const s = eff >= 92 ? 1.0 : eff >= 88 ? 0.85 : eff >= 83 ? 0.70 : eff >= 75 ? 0.50 : 0.20;
    weightedSum += s * 3;
    totalWeight += 3;
  }

  // Deep sleep ratio (weight 2) — healthy 13–23% of total
  if (hk.deep_sleep_hours != null && hk.deep_sleep_hours > 0 && h > 0) {
    const pct = (hk.deep_sleep_hours / h) * 100;
    const s = (pct >= 13 && pct <= 23) ? 1.0 : (pct >= 10 && pct <= 28) ? 0.65 : 0.30;
    weightedSum += s * 2;
    totalWeight += 2;
  }

  // REM ratio (weight 1) — healthy 20–25% of total
  if (hk.rem_sleep_hours != null && hk.rem_sleep_hours > 0 && h > 0) {
    const pct = (hk.rem_sleep_hours / h) * 100;
    const s = (pct >= 20 && pct <= 25) ? 1.0 : (pct >= 15 && pct <= 30) ? 0.65 : 0.30;
    weightedSum += s * 1;
    totalWeight += 1;
  }

  const raw = weightedSum / totalWeight;
  const score: number = Math.round(raw * 100);
  const quality: Quality = raw >= 0.80 ? 'great' : raw >= 0.60 ? 'good' : raw >= 0.35 ? 'fair' : 'poor';
  return { score, quality };
}

function qualityColor(P: ReturnType<typeof usePalette>, q: Quality): string {
  if (q === 'great') return P.protein;
  if (q === 'good')  return P.sleep;
  if (q === 'fair')  return P.carbs;
  return P.danger;
}

function qualityRingColor(P: ReturnType<typeof usePalette>, q: Quality): string {
  if (q === 'great' || q === 'good') return P.protein;
  if (q === 'fair') return P.carbs;
  return P.danger;
}

function qualityPct(q: Quality): number {
  return ({ poor: 40, fair: 65, good: 82, great: 95 } as const)[q];
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Styles ─────────────────────────────────────────────────────────────────
const sleepStyles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    gap:               12,
    marginBottom:      4,
  },
  iconBtn: {
    width:          40,
    height:         40,
    borderRadius:   14,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    StyleSheet.hairlineWidth,
  },
  eyebrow: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.8,
  },
  datePill: {
    flexDirection:     'row',
    alignItems:        'center',
    borderRadius:      999,
    borderWidth:       StyleSheet.hairlineWidth,
    paddingVertical:   8,
    paddingHorizontal: 6,
    gap:               2,
    shadowColor:       '#000',
    shadowOpacity:     0.05,
    shadowRadius:      6,
    shadowOffset:      { width: 0, height: 2 },
    ...Platform.select({ android: { elevation: 1 } }),
  },
  dateArrow: {
    width:          32,
    height:         32,
    borderRadius:   999,
    alignItems:     'center',
    justifyContent: 'center',
  },
  dateLabelWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 10,
    minWidth:          90,
    justifyContent:    'center',
  },
  todayDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  dateLabel: {
    fontSize:      15,
    fontWeight:    '700',
    letterSpacing: -0.3,
  },
  heroNum: {
    fontSize:      80,
    fontWeight:    '800',
    letterSpacing: -3.5,
    lineHeight:    84,
  },
  heroSub: {
    fontSize:   28,
    fontWeight: '800',
  },
  heroEyebrow: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2,
  },
  sectionHeader: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    marginBottom:      10,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.8,
  },
  sectionSub: {
    fontSize:   11,
    fontWeight: '600',
  },
  stagePill: {
    flex:              1,
    borderRadius:      12,
    borderWidth:       StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical:   10,
    alignItems:        'flex-start',
  },
  stageDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  hkBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 14,
    paddingVertical:   10,
    borderRadius:      12,
    borderWidth:       StyleSheet.hairlineWidth,
  },
  hkBannerText: {
    fontSize: 12, fontWeight: '700',
  },
  hkBannerSub: {
    fontSize: 11, fontWeight: '600', opacity: 0.7,
  },
  qualityRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2,
  },
  qualityPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 14,
    paddingVertical:   10,
    borderRadius:      999,
    borderWidth:       StyleSheet.hairlineWidth,
  },
  qualityLabel: {
    fontSize: 13, fontWeight: '800', letterSpacing: -0.2,
  },
  notesPill: {
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderRadius:      20,
    borderWidth:       StyleSheet.hairlineWidth,
  },
  hint: {
    marginTop: 12, fontSize: 11, fontWeight: '500', textAlign: 'center',
  },
});
