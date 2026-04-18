import { useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
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
  FieldLabel,
  MiniLabel,
  NotesField,
  PrimaryButton,
  ScreenHeader,
  StatColumn,
  StatDivider,
  TextField,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';
import { useToast } from '@/components/ui/Toast';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type Quality = 'poor' | 'fair' | 'good' | 'great';

const QUALITY: { id: Quality; label: string; icon: IoniconName; tone: 'cool' | 'warm' }[] = [
  { id: 'poor',  label: 'Poor',  icon: 'cloud-outline',     tone: 'cool' },
  { id: 'fair',  label: 'Fair',  icon: 'partly-sunny-outline', tone: 'warm' },
  { id: 'good',  label: 'Good',  icon: 'sunny-outline',     tone: 'warm' },
  { id: 'great', label: 'Great', icon: 'sparkles-outline',  tone: 'cool' },
];

export default function SleepLogScreen() {
  const P      = usePalette();
  const router = useRouter();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();
  const toast  = useToast();

  // ── Sleep window ────────────────────────────────────────────
  const [bedtime, setBedtime] = useState('11:00 PM');
  const [wakeup,  setWakeup]  = useState('7:00 AM');
  const hours = useMemo(() => computeHours(bedtime, wakeup), [bedtime, wakeup]);

  // ── Form state ──────────────────────────────────────────────
  const [quality, setQuality] = useState<Quality>('good');
  const [deep,    setDeep]    = useState('');
  const [notes,   setNotes]   = useState('');
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // NOTE: No backend context wired yet — form just confirms for now.
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    toast.success('Sleep logged', `${hours.label} · ${capital(quality)}`);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Last night" title="Sleep" accent={P.sleep} />

        {/* ── Hero: hours summary ─────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <AnimatedCard delay={60}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
              <View style={[styles.moon, { backgroundColor: P.sleepSoft }]}>
                <Ionicons name="moon" size={22} color={P.sleep} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroEyebrow, { color: P.textFaint }]}>
                  TIME ASLEEP
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <Text style={[styles.heroBig, { color: P.text }]}>
                    {hours.hours}
                  </Text>
                  <Text style={[styles.heroUnit, { color: P.textDim }]}>h</Text>
                  <Text style={[styles.heroBig, { color: P.text, marginLeft: 6 }]}>
                    {hours.minutes}
                  </Text>
                  <Text style={[styles.heroUnit, { color: P.textDim }]}>m</Text>
                </View>
              </View>

              <View style={[styles.qualityDot, { backgroundColor: qualityColor(P, quality) + '22' }]}>
                <Text style={[styles.qualityDotText, { color: qualityColor(P, quality) }]}>
                  {qualityPct(quality)}%
                </Text>
              </View>
            </View>

            <View style={[styles.barTrack, { backgroundColor: P.sunken }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(hours.rawHours / 10, 1) * 100}%`,
                    backgroundColor: P.sleep,
                  },
                ]}
              />
            </View>

            <View style={[styles.heroFoot, { borderTopColor: P.hair }]}>
              <StatColumn label="Bedtime" value={bedtime} />
              <StatDivider />
              <StatColumn label="Wake"    value={wakeup}  />
              <StatDivider />
              <StatColumn label="Goal"    value="8h"      />
            </View>
          </AnimatedCard>
        </View>

        {/* ── Bedtime / Wakeup ────────────────────────────── */}
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

        {/* ── Quality ─────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={180}>
            <FieldLabel>Quality</FieldLabel>
            <View style={styles.qualityRow}>
              {QUALITY.map((q) => {
                const active = q.id === quality;
                const color  = qualityColor(P, q.id);
                return (
                  <Pressable
                    key={q.id}
                    onPress={() => setQuality(q.id)}
                    style={({ pressed }) => [
                      styles.qualityPill,
                      {
                        backgroundColor: active ? color : P.sunken,
                        borderColor:     active ? color : P.cardEdge,
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Ionicons
                      name={q.icon}
                      size={16}
                      color={active ? '#fff' : color}
                    />
                    <Text style={[
                      styles.qualityLabel,
                      { color: active ? '#fff' : P.text },
                    ]}>
                      {q.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </AnimatedCard>
        </View>

        {/* ── Deep sleep + notes ──────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={240}>
            <FieldLabel>Deep sleep (optional)</FieldLabel>
            <TextField
              value={deep}
              onChangeText={setDeep}
              placeholder="e.g. 1.5"
              keyboardType="decimal-pad"
              unit="hrs"
            />

            <View style={{ height: 14 }} />
            <FieldLabel>Notes</FieldLabel>
            <NotesField
              value={notes}
              onChangeText={setNotes}
              placeholder="Dreams, disruptions, caffeine late?"
            />
          </AnimatedCard>
        </View>

        {/* ── CTA ─────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <PrimaryButton
            label="Save sleep log"
            icon="checkmark"
            onPress={handleSave}
            loading={saving}
            accent={P.sleep}
          />
          <Text style={[styles.hint, { color: P.textFaint }]}>
            Hidden when HealthKit provides sleep data automatically.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
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

  const hours   = Math.floor(diff / 60);
  const minutes = diff % 60;
  const rawHours = diff / 60;

  return { hours, minutes, rawHours, label: `${hours}h ${String(minutes).padStart(2, '0')}m` };
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
const styles = StyleSheet.create({
  moon: {
    width:          52, height: 52, borderRadius: 18,
    alignItems:     'center',
    justifyContent: 'center',
  },
  heroEyebrow: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.5,
    marginBottom:  2,
  },
  heroBig: {
    fontSize:      38,
    fontWeight:    '800',
    letterSpacing: -1.4,
    lineHeight:    42,
  },
  heroUnit: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: 0.4,
  },
  qualityDot: {
    width:          54, height: 54, borderRadius: 18,
    alignItems:     'center',
    justifyContent: 'center',
  },
  qualityDotText: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: -0.3,
  },
  barTrack: {
    marginTop:    16,
    height:       6,
    borderRadius: 3,
    overflow:     'hidden',
  },
  barFill: {
    height:       '100%',
    borderRadius: 3,
  },
  heroFoot: {
    flexDirection:  'row',
    marginTop:      16,
    paddingTop:     14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  qualityRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
    marginTop:     2,
  },
  qualityPill: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    paddingHorizontal:14,
    paddingVertical:  10,
    borderRadius:     999,
    borderWidth:      StyleSheet.hairlineWidth,
  },
  qualityLabel: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },

  hint: {
    marginTop:  12,
    fontSize:   11,
    fontWeight: '500',
    textAlign:  'center',
  },
});
