import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  AnimatedCard,
  FieldLabel,
  MiniLabel,
  NotesField,
  PrimaryButton,
  StatColumn,
  StatDivider,
  TextField,
  usePalette,
} from '@/lib/log-theme';
import { SleepHypnogram } from '@/components/log/SleepHypnogram';
import { useToast } from '@/components/ui/Toast';
import { useHealth } from '@/hooks/use-health';
import { useRecovery } from '@/hooks/use-recovery';
import { apiFetch } from '@/utils/api';
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

export default function SleepLogScreen() {
  const P               = usePalette();
  const router          = useRouter();
  const insets          = useSafeAreaInsets();
  const toast           = useToast();
  const health          = useHealth();
  const { logRecovery } = useRecovery();

  // ── Date navigation ────────────────────────────────────────────────────────
  const today = localDateString();
  const [activeDate, setActiveDate] = useState(today);
  const isToday = activeDate === today;

  const navigateDate = (dir: -1 | 1) => {
    const next = offsetDate(activeDate, dir);
    if (next > today) return;
    setActiveDate(next);
  };

  // ── Per-date health data ───────────────────────────────────────────────────
  // Today comes from context; other dates fetched on demand.
  const [dateHealthData, setDateHealthData] = useState<HealthData | null>(null);
  const [loadingDate,    setLoadingDate]    = useState(false);

  const hkSleep = useMemo(() => {
    const hk = isToday ? health.today : dateHealthData;
    return hk && typeof hk.sleep_hours === 'number' && hk.sleep_hours > 0 ? hk : null;
  }, [isToday, health.today, dateHealthData]);

  useEffect(() => {
    if (isToday) {
      setDateHealthData(null);
      return;
    }
    let cancelled = false;
    setLoadingDate(true);
    apiFetch(`/health/today?date=${activeDate}`)
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (ok && body.health_data) {
          setDateHealthData(body.health_data as HealthData);
        } else {
          setDateHealthData(null);
        }
      })
      .catch(() => { if (!cancelled) setDateHealthData(null); })
      .finally(() => { if (!cancelled) setLoadingDate(false); });
    return () => { cancelled = true; };
  }, [activeDate, isToday]);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [fromHealthKit, setFromHealthKit] = useState(false);
  const [bedtime,  setBedtime] = useState('11:00 PM');
  const [wakeup,   setWakeup]  = useState('7:00 AM');
  const [quality,  setQuality] = useState<Quality>('good');
  const [deepH,    setDeepH]   = useState('');
  const [deepM,    setDeepM]   = useState('');
  const [notes,    setNotes]   = useState('');
  const [saving,   setSaving]  = useState(false);

  // ── Sleep stage segments (for hypnogram chart) ─────────────────────────────
  const [sleepSegments, setSleepSegments] = useState<SleepSegment[]>([]);

  useEffect(() => {
    let cancelled = false;
    const hk = getHealthKitModule();
    if (!hk) return;
    readSleepSegmentsForNight(hk, activeDate).then((segs) => {
      if (!cancelled) setSleepSegments(segs);
    });
    return () => { cancelled = true; };
  }, [activeDate]);

  // Reset + re-populate whenever the active date (or its health data) changes
  const populateFromHealthKit = useCallback((hk: HealthData) => {
    setFromHealthKit(true);
    setQuality(sleepHoursToQuality({
      sleep_hours:      hk.sleep_hours!,
      deep_sleep_hours: hk.deep_sleep_hours,
      rem_sleep_hours:  hk.rem_sleep_hours,
      sleep_efficiency: hk.sleep_efficiency,
    }));
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
    // Reset form each time date switches
    setFromHealthKit(false);
    setBedtime('11:00 PM');
    setWakeup('7:00 AM');
    setQuality('good');
    setDeepH('');
    setDeepM('');
    setNotes('');
  }, [activeDate]);

  useEffect(() => {
    if (hkSleep && !fromHealthKit) {
      populateFromHealthKit(hkSleep);
    }
  }, [hkSleep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed hours (always from clock inputs so edits update hero live) ────
  const hours = useMemo(() => computeHours(bedtime, wakeup), [bedtime, wakeup]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const apiQuality: SleepQuality = quality === 'great' ? 'good' : quality;
      const sleepH = hours.rawHours > 0 ? hours.rawHours : (hkSleep?.sleep_hours ?? 0);
      await logRecovery({
        sleep_hours:      sleepH > 0 ? sleepH : undefined,
        sleep_quality:    apiQuality,
        deep_sleep_hours: (() => {
          const h = parseInt(deepH) || 0;
          const m = parseInt(deepM) || 0;
          return h > 0 || m > 0 ? h + m / 60 : (hkSleep?.deep_sleep_hours ?? undefined);
        })(),
        rem_sleep_hours:  hkSleep?.rem_sleep_hours ?? undefined,
        notes:            notes.trim() || undefined,
        source:           fromHealthKit ? 'healthkit' : 'manual',
        date:             isToday ? undefined : activeDate,
      });
      toast.success('Sleep logged', `${hours.label} · ${capital(quality)}`);
    } catch {
      toast.error('Could not save', 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  // ── Hero foot ──────────────────────────────────────────────────────────────
  const heroFoot = hkSleep ? (
    <>
      <StatColumn label="Deep"   value={formatHoursShort(hkSleep.deep_sleep_hours ?? 0)} />
      <StatDivider />
      <StatColumn label="REM"    value={formatHoursShort(hkSleep.rem_sleep_hours ?? 0)} />
      <StatDivider />
      <StatColumn label="Effic." value={`${Math.round(hkSleep.sleep_efficiency ?? 0)}%`} />
    </>
  ) : (
    <>
      <StatColumn label="Bedtime" value={bedtime} />
      <StatDivider />
      <StatColumn label="Wake"    value={wakeup}  />
      <StatDivider />
      <StatColumn label="Goal"    value="8h"      />
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header with date navigator ───────────────────────────────────── */}
        <View style={[sleepStyles.header, { paddingTop: insets.top + 4 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={10}
            activeOpacity={0.7}
            style={[sleepStyles.backBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}
          >
            <Ionicons name="chevron-back" size={20} color={P.text} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <Text style={[sleepStyles.eyebrow, { color: P.textFaint }]}>SLEEP LOG</Text>

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

          <View style={{ width: 40 }} />
        </View>

        {/* ── Hero: hours summary ──────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <AnimatedCard delay={60}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
              <View style={[sleepStyles.moon, { backgroundColor: P.sleepSoft }]}>
                <Ionicons name="moon" size={22} color={P.sleep} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[sleepStyles.heroEyebrow, { color: P.textFaint }]}>TIME ASLEEP</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <Text style={[sleepStyles.heroBig, { color: P.text }]}>{hours.hours}</Text>
                  <Text style={[sleepStyles.heroUnit, { color: P.textDim }]}>h</Text>
                  <Text style={[sleepStyles.heroBig, { color: P.text, marginLeft: 6 }]}>{hours.minutes}</Text>
                  <Text style={[sleepStyles.heroUnit, { color: P.textDim }]}>m</Text>
                </View>
              </View>
              <View style={[sleepStyles.qualityDot, { backgroundColor: qualityColor(P, quality) + '22' }]}>
                <Text style={[sleepStyles.qualityDotText, { color: qualityColor(P, quality) }]}>
                  {qualityPct(quality)}%
                </Text>
              </View>
            </View>

            <View style={[sleepStyles.barTrack, { backgroundColor: P.sunken }]}>
              <View
                style={[
                  sleepStyles.barFill,
                  {
                    width: `${Math.min(hours.rawHours / 9, 1) * 100}%`,
                    backgroundColor: loadingDate ? P.cardEdge : P.sleep,
                  },
                ]}
              />
            </View>

            <View style={[sleepStyles.heroFoot, { borderTopColor: P.hair }]}>
              {heroFoot}
            </View>
          </AnimatedCard>
        </View>

        {/* ── Apple Health sync banner ─────────────────────────────────────── */}
        {fromHealthKit && (
          <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
            <View style={[sleepStyles.hkBanner, { backgroundColor: P.waterSoft, borderColor: P.water + '40' }]}>
              <Ionicons name="logo-apple" size={13} color={P.water} />
              <Text style={[sleepStyles.hkBannerText, { color: P.water }]}>
                Synced from Apple Health
              </Text>
              <View style={{ flex: 1 }} />
              <Text style={[sleepStyles.hkBannerSub, { color: P.water }]}>Edit below</Text>
            </View>
          </View>
        )}

        {/* ── Hypnogram chart ──────────────────────────────────────────────── */}
        {fromHealthKit && sleepSegments.some(
          (s) => s.stage === 'awake' || s.stage === 'rem' || s.stage === 'core' || s.stage === 'deep',
        ) && (
          <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
            <AnimatedCard delay={90} padding={16}>
              <Text style={[sleepStyles.heroEyebrow, { color: P.textFaint, marginBottom: 12 }]}>
                SLEEP STAGES
              </Text>
              <SleepHypnogram
                segments={sleepSegments}
                windowStart={hkSleep?.bedtime_iso ? new Date(hkSleep.bedtime_iso) : undefined}
                windowEnd={hkSleep?.wakeup_iso   ? new Date(hkSleep.wakeup_iso)   : undefined}
              />
            </AnimatedCard>
          </View>
        )}

        {/* ── Bedtime / Wakeup ─────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={120}>
            <FieldLabel>Sleep window</FieldLabel>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
              <View style={{ flex: 1 }}>
                <MiniLabel>Bedtime</MiniLabel>
                <TextField
                  value={bedtime}
                  onChangeText={setBedtime}
                  placeholder="11:00 PM"
                  autoCapitalize="characters"
                />
              </View>
              <View style={{ flex: 1 }}>
                <MiniLabel>Wake up</MiniLabel>
                <TextField
                  value={wakeup}
                  onChangeText={setWakeup}
                  placeholder="7:00 AM"
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </AnimatedCard>
        </View>

        {/* ── Quality ──────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={180}>
            <FieldLabel>Quality</FieldLabel>
            <View style={sleepStyles.qualityRow}>
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
          </AnimatedCard>
        </View>

        {/* ── Deep sleep + notes ───────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={240}>
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
            <View style={{ height: 14 }} />
            <FieldLabel>Notes</FieldLabel>
            <NotesField
              value={notes}
              onChangeText={setNotes}
              placeholder="Dreams, disruptions, caffeine late?"
            />
          </AnimatedCard>
        </View>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
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
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

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

function sleepHoursToQuality(hk: {
  sleep_hours:      number;
  deep_sleep_hours?: number | null;
  rem_sleep_hours?:  number | null;
  sleep_efficiency?: number | null;
}): Quality {
  const h = hk.sleep_hours;

  // ── Duration score (weight 4) ───────────────────────────────────────────
  // NSF recommendation: 7–9 h for adults
  let durationScore: number;
  if (h >= 7 && h <= 9)  durationScore = 1.0;
  else if (h >= 6.5)     durationScore = 0.75;
  else if (h >= 6)       durationScore = 0.50;
  else if (h >= 5)       durationScore = 0.25;
  else                   durationScore = 0.0;

  let weightedSum = durationScore * 4;
  let totalWeight = 4;

  // ── Efficiency score (weight 3) ─────────────────────────────────────────
  // ≥85% is clinically "good"; <75% is poor
  if (hk.sleep_efficiency != null && hk.sleep_efficiency > 0) {
    const eff = hk.sleep_efficiency;
    const effScore = eff >= 90 ? 1.0 : eff >= 85 ? 0.75 : eff >= 75 ? 0.50 : 0.20;
    weightedSum += effScore * 3;
    totalWeight += 3;
  }

  // ── Deep sleep ratio (weight 2) ─────────────────────────────────────────
  // Healthy range: 13–23% of total sleep
  if (hk.deep_sleep_hours != null && hk.deep_sleep_hours > 0 && h > 0) {
    const pct = (hk.deep_sleep_hours / h) * 100;
    let deepScore: number;
    if (pct >= 13 && pct <= 23)   deepScore = 1.0;
    else if (pct >= 10 || pct <= 28) deepScore = 0.65;
    else                          deepScore = 0.30;
    weightedSum += deepScore * 2;
    totalWeight += 2;
  }

  // ── REM ratio (weight 1) ────────────────────────────────────────────────
  // Healthy range: 20–25% of total sleep
  if (hk.rem_sleep_hours != null && hk.rem_sleep_hours > 0 && h > 0) {
    const pct = (hk.rem_sleep_hours / h) * 100;
    let remScore: number;
    if (pct >= 20 && pct <= 25)   remScore = 1.0;
    else if (pct >= 15 || pct <= 30) remScore = 0.65;
    else                          remScore = 0.30;
    weightedSum += remScore * 1;
    totalWeight += 1;
  }

  const score = weightedSum / totalWeight;
  if (score >= 0.80) return 'great';
  if (score >= 0.60) return 'good';
  if (score >= 0.35) return 'fair';
  return 'poor';
}

function formatHoursShort(h: number): string {
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh === 0) return `${mm}m`;
  if (mm === 0) return `${hh}h`;
  return `${hh}h ${mm}m`;
}

function qualityColor(P: ReturnType<typeof usePalette>, q: Quality): string {
  if (q === 'great') return P.protein;
  if (q === 'good')  return P.sleep;
  if (q === 'fair')  return P.carbs;
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
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 20,
    gap:            12,
    marginBottom:   4,
  },
  backBtn: {
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
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    paddingHorizontal: 10,
    minWidth:       90,
    justifyContent: 'center',
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
  moon: {
    width: 52, height: 52, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  heroEyebrow: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 2,
  },
  heroBig: {
    fontSize: 38, fontWeight: '800', letterSpacing: -1.4, lineHeight: 42,
  },
  heroUnit: {
    fontSize: 13, fontWeight: '800', letterSpacing: 0.4,
  },
  qualityDot: {
    width: 54, height: 54, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  qualityDotText: {
    fontSize: 13, fontWeight: '800', letterSpacing: -0.3,
  },
  barTrack: {
    marginTop: 16, height: 6, borderRadius: 3, overflow: 'hidden',
  },
  barFill: {
    height: '100%', borderRadius: 3,
  },
  heroFoot: {
    flexDirection: 'row',
    marginTop: 16, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  hkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
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
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
  },
  qualityLabel: {
    fontSize: 13, fontWeight: '800', letterSpacing: -0.2,
  },
  hint: {
    marginTop: 12, fontSize: 11, fontWeight: '500', textAlign: 'center',
  },
});
