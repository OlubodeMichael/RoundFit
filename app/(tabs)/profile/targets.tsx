import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '@/components/ui/Toast';
import { useProfile } from '@/hooks/use-profile';
import { setLocalTargets } from '@/utils/local-targets';
import { notifyTodayTargetsChanged } from '@/utils/today-sync';
import { useTheme } from '@/hooks/use-theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const SLEEP_KEY = '@roundfit/sleep_target_hours';
const STEPS_KEY = '@roundfit/steps_target';
const O = '#F97316';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// ── Palette ────────────────────────────────────────────────────────────────

function usePalette() {
  const { isDark } = useTheme();
  return isDark ? {
    bg:     '#0A0B0F',
    card:   '#1C1D23',
    edge:   'rgba(255,255,255,0.08)',
    hi:     '#F4F4F5',
    mid:    '#909096',
    lo:     '#2A2A32',
    isDark: true,
  } : {
    bg:     '#F7F7F5',
    card:   '#FFFFFF',
    edge:   'rgba(0,0,0,0.06)',
    hi:     '#111111',
    mid:    '#999999',
    lo:     '#EBEBEB',
    isDark: false,
  };
}

// ── TargetCard ─────────────────────────────────────────────────────────────

interface TargetCardProps {
  icon:        IoniconsName;
  iconBg:      string;
  label:       string;
  value:       string;
  unit:        string;
  hint?:       string;
  onIncrement: () => void;
  onDecrement: () => void;
  card:        string;
  lo:          string;
  mid:         string;
  hi:          string;
  isDark:      boolean;
}

function TargetCard({
  icon, iconBg, label, value, unit, hint,
  onIncrement, onDecrement,
  card, lo, mid, hi, isDark,
}: TargetCardProps) {
  const btnBg = isDark ? '#252530' : '#F0EFEC';
  return (
    <View style={[tc.card, { backgroundColor: card, borderColor: lo }]}>
      <View style={tc.cardHeader}>
        <View style={[tc.iconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={15} color="#FFF" />
        </View>
        <Text style={[tc.label, { color: mid }]}>{label}</Text>
      </View>

      <View style={tc.row}>
        <TouchableOpacity
          style={[tc.btn, { backgroundColor: btnBg, borderColor: lo }]}
          onPress={onDecrement}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={tc.btnGlyph}>−</Text>
        </TouchableOpacity>

        <View style={tc.center}>
          <Text style={[tc.value, { color: hi }]}>{value}</Text>
          <Text style={[tc.unit, { color: mid }]}>{unit}</Text>
        </View>

        <TouchableOpacity
          style={[tc.btn, { backgroundColor: btnBg, borderColor: lo }]}
          onPress={onIncrement}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={tc.btnGlyph}>+</Text>
        </TouchableOpacity>
      </View>

      {hint ? (
        <Text style={[tc.hint, { color: mid }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const tc = StyleSheet.create({
  card: {
    borderRadius:      18,
    borderWidth:       1,
    paddingHorizontal: 20,
    paddingTop:        16,
    paddingBottom:     20,
    gap:               18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  iconBox: {
    width:          30,
    height:         30,
    borderRadius:   9,
    alignItems:     'center',
    justifyContent: 'center',
  },
  label: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 1.2,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  btn: {
    width:          56,
    height:         56,
    borderRadius:   28,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  btnGlyph: {
    fontSize:           26,
    fontWeight:         '300',
    color:              O,
    lineHeight:         30,
    includeFontPadding: false,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:             2,
  },
  value: {
    fontFamily:         'Syne_700Bold',
    fontSize:           42,
    lineHeight:         48,
    textAlign:          'center',
    includeFontPadding: false,
  },
  unit: {
    fontSize:      13,
    fontWeight:    '500',
    letterSpacing: 0.4,
  },
  hint: {
    fontSize:   12,
    textAlign:  'center',
    lineHeight: 16,
    opacity:    0.7,
  },
});

// ── Screen ─────────────────────────────────────────────────────────────────

export default function TargetsScreen() {
  const P = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useProfile();
  const toast = useToast();

  const tdee = profile?.tdee ?? profile?.calorieBudget ?? 2000;

  const [calories,      setCalories]      = useState<number>(profile?.calorieBudget ?? tdee);
  const [sleep,         setSleep]         = useState<number>(8);
  const [steps,         setSteps]         = useState<number>(10000);
  const [savedSleep,    setSavedSleep]    = useState<number>(8);
  const [savedSteps,    setSavedSteps]    = useState<number>(10000);
  const [saving,        setSaving]        = useState(false);
  const [loaded,        setLoaded]        = useState(false);

  useEffect(() => {
    (async () => {
      const [sleepRaw, stepsRaw] = await Promise.all([
        AsyncStorage.getItem(SLEEP_KEY),
        AsyncStorage.getItem(STEPS_KEY),
      ]);
      const sleepVal = sleepRaw !== null ? parseFloat(sleepRaw) : 8;
      // Prefer the server value; fall back to AsyncStorage, then default 10000
      const stepsVal = profile?.stepsTarget
        ?? (stepsRaw !== null ? parseInt(stepsRaw, 10) : 10000);
      setSleep(sleepVal);
      setSteps(stepsVal);
      setSavedSleep(sleepVal);
      setSavedSteps(stepsVal);
      setLoaded(true);
    })();
  }, [profile?.stepsTarget]);

  const originalCalories = profile?.calorieBudget ?? tdee;
  const isDirty = loaded && (
    calories !== originalCalories ||
    sleep    !== savedSleep       ||
    steps    !== savedSteps
  );

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await updateProfile({ calorieBudget: calories, stepsTarget: steps });
      if (!saved) {
        toast.error('Could not save targets', 'Please try again.');
        return;
      }
      await setLocalTargets(sleep, steps);
      notifyTodayTargetsChanged();
      toast.success('Targets saved', 'Your daily goals were updated.');
      router.back();
    } catch {
      toast.error('Could not save targets', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const calorieHint = profile?.tdee
    ? `Calculated goal: ${profile.tdee.toLocaleString()} kcal based on your profile`
    : undefined;

  const calorieDisplay = calories.toLocaleString();
  const sleepDisplay   = sleep.toFixed(1);
  const stepsDisplay   = steps.toLocaleString();

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={O} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.root, { backgroundColor: P.bg }]}>

        {/* ── Header ── */}
        <View style={[s.header, { paddingTop: insets.top + 14, borderBottomColor: P.lo }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[s.headerAction, { color: P.mid }]}>Cancel</Text>
          </TouchableOpacity>

          <Text style={[s.headerTitle, { color: P.hi }]}>Daily Targets</Text>

          <TouchableOpacity
            onPress={handleSave}
            disabled={!isDirty || saving}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {saving
              ? <ActivityIndicator size="small" color={O} />
              : <Text style={[s.headerAction, { color: isDirty ? O : P.mid, fontFamily: 'Syne_700Bold' }]}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 96 }]}
          showsVerticalScrollIndicator={false}
        >
          <SectionLabel label="Calories" color={P.mid} />
          <TargetCard
            icon="flame"
            iconBg="#FF7849"
            label="DAILY CALORIES"
            value={calorieDisplay}
            unit="kcal"
            hint={calorieHint}
            onIncrement={() => setCalories(c => clamp(c + 50, 1200, 5000))}
            onDecrement={() => setCalories(c => clamp(c - 50, 1200, 5000))}
            card={P.card}
            lo={P.lo}
            mid={P.mid}
            hi={P.hi}
            isDark={P.isDark}
          />

          <SectionLabel label="Sleep" color={P.mid} />
          <TargetCard
            icon="moon"
            iconBg="#818CF8"
            label="SLEEP TARGET"
            value={sleepDisplay}
            unit="hours"
            onIncrement={() => setSleep(s => clamp(Math.round((s + 0.5) * 2) / 2, 4, 12))}
            onDecrement={() => setSleep(s => clamp(Math.round((s - 0.5) * 2) / 2, 4, 12))}
            card={P.card}
            lo={P.lo}
            mid={P.mid}
            hi={P.hi}
            isDark={P.isDark}
          />

          <SectionLabel label="Activity" color={P.mid} />
          <TargetCard
            icon="footsteps"
            iconBg="#38BDF8"
            label="DAILY STEPS"
            value={stepsDisplay}
            unit="steps"
            onIncrement={() => setSteps(s => clamp(s + 500, 1000, 30000))}
            onDecrement={() => setSteps(s => clamp(s - 500, 1000, 30000))}
            card={P.card}
            lo={P.lo}
            mid={P.mid}
            hi={P.hi}
            isDark={P.isDark}
          />

          <Text style={[s.footer, { color: P.mid }]}>
            Targets are personal goals — they guide your progress, not hard limits.
          </Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function SectionLabel({ label, color }: { label: string; color: string }) {
  return (
    <Text style={[s.sectionLabel, { color }]}>
      {label.toUpperCase()}
    </Text>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingBottom:     14,
    borderBottomWidth: 1,
  },
  headerTitle:  { fontFamily: 'Syne_700Bold', fontSize: 16 },
  headerAction: { fontSize: 15 },

  scroll: {
    paddingHorizontal: 20,
    paddingTop:        8,
    gap:               6,
  },

  sectionLabel: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 0.9,
    marginTop:     20,
    marginBottom:  8,
    paddingHorizontal: 4,
  },

  footer: {
    textAlign:  'center',
    fontSize:   12,
    lineHeight: 17,
    marginTop:  20,
    paddingHorizontal: 16,
  },
});
