import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { useToast } from '@/components/ui/Toast';
import { useProfile } from '@/hooks/use-profile';
import { resolveProteinTargetG } from '@/utils/nutrition';
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

// ── Modal ────────────────────────────────────────────────────────────────────

export interface DailyTargetsModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function DailyTargetsModal({ visible, onClose, onSaved }: DailyTargetsModalProps) {
  const P = usePalette();
  const { profile, updateProfile } = useProfile();
  const toast = useToast();

  const tdee = profile?.tdee ?? profile?.calorieBudget ?? 2000;

  // Effective protein target = manual value if set, else the goal-aware calc —
  // same source of truth the home screen uses, so the two always agree.
  const proteinDefault = profile
    ? resolveProteinTargetG(
        {
          sex:           profile.sex,
          age:           profile.age,
          heightCm:      profile.heightCm,
          weightKg:      profile.weightKg,
          activityLevel: profile.activityLevel,
          goal:          profile.goal,
        },
        profile.proteinTarget,
      )
    : 140;

  const [calories,      setCalories]      = useState<number>(profile?.calorieBudget ?? tdee);
  const [protein,       setProtein]       = useState<number>(proteinDefault);
  const [sleep,         setSleep]         = useState<number>(8);
  const [steps,         setSteps]         = useState<number>(10000);
  const [water,         setWater]         = useState<number>(profile?.waterGoalMl ?? 2000);
  const [savedSleep,    setSavedSleep]    = useState<number>(8);
  const [savedSteps,    setSavedSteps]    = useState<number>(10000);
  const [saving,        setSaving]        = useState(false);
  const [loaded,        setLoaded]        = useState(false);

  useEffect(() => {
    if (!visible) setLoaded(false);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const [sleepRaw, stepsRaw] = await Promise.all([
        AsyncStorage.getItem(SLEEP_KEY),
        AsyncStorage.getItem(STEPS_KEY),
      ]);
      const sleepVal = profile?.sleepTarget
        ?? (sleepRaw !== null ? parseFloat(sleepRaw) : 8);
      const stepsVal = profile?.stepsTarget
        ?? (stepsRaw !== null ? parseInt(stepsRaw, 10) : 10000);
      setCalories(profile?.calorieBudget ?? profile?.tdee ?? 2000);
      setProtein(proteinDefault);
      setWater(profile?.waterGoalMl ?? 2000);
      setSleep(sleepVal);
      setSteps(stepsVal);
      setSavedSleep(sleepVal);
      setSavedSteps(stepsVal);
      setLoaded(true);
    })();
  }, [visible, proteinDefault, profile?.calorieBudget, profile?.stepsTarget, profile?.sleepTarget, profile?.tdee, profile?.waterGoalMl]);

  const originalCalories = profile?.calorieBudget ?? tdee;
  const originalWater    = profile?.waterGoalMl ?? 2000;
  const isDirty = loaded && (
    calories !== originalCalories ||
    protein  !== proteinDefault   ||
    sleep    !== savedSleep       ||
    steps    !== savedSteps       ||
    water    !== originalWater
  );

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await updateProfile({ calorieBudget: calories, proteinTarget: protein, stepsTarget: steps, sleepTarget: sleep, waterGoalMl: water });
      if (!saved) {
        toast.error('Could not save targets', 'Please try again.');
        return;
      }
      await setLocalTargets(sleep, steps);
      notifyTodayTargetsChanged();
      toast.success('Targets saved', 'Your daily goals were updated.');
      onSaved?.();
      onClose();
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
  const proteinDisplay = String(protein);
  const sleepDisplay   = sleep.toFixed(1);
  const stepsDisplay   = steps.toLocaleString();
  const waterDisplay   = (water / 1000).toFixed(2).replace(/0$/, '').replace(/\.$/, '.0');
  const waterUnit      = 'L';

  if (!loaded) {
    return (
      <AppModal visible={visible} onClose={onClose} sheetHeight="full" dismissGestureArea="sheet">
        <View style={s.loadingWrap}>
          <ActivityIndicator color={O} />
        </View>
      </AppModal>
    );
  }

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      sheetHeight="full"
      dismissGestureArea="sheet"
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>GOALS</Text>
            <Text style={[s.modalTitle, { color: P.hi }]}>Daily targets</Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={[s.closeBtn, { backgroundColor: P.isDark ? '#252530' : '#ECEAE6' }]}
          >
            <Text style={[s.closeBtnText, { color: P.mid }]}>✕</Text>
          </Pressable>
        </View>
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

          <SectionLabel label="Protein" color={P.mid} />
          <TargetCard
            icon="barbell"
            iconBg="#F43F5E"
            label="PROTEIN TARGET"
            value={proteinDisplay}
            unit="grams"
            onIncrement={() => setProtein(p => clamp(p + 5, 30, 400))}
            onDecrement={() => setProtein(p => clamp(p - 5, 30, 400))}
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

          <SectionLabel label="Hydration" color={P.mid} />
          <TargetCard
            icon="water"
            iconBg="#38BDF8"
            label="DAILY WATER"
            value={waterDisplay}
            unit={waterUnit}
            onIncrement={() => setWater(w => clamp(w + 250, 500, 6000))}
            onDecrement={() => setWater(w => clamp(w - 250, 500, 6000))}
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

          <Text style={[s.footerNote, { color: P.mid }]}>
            Targets are personal goals; they guide your progress, not hard limits.
          </Text>
        </ScrollView>

      <View style={[s.footer, { borderTopColor: P.lo }]}>
        <TouchableOpacity
          style={[s.cancelBtn, { borderColor: P.lo }]}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Text style={[s.cancelText, { color: P.hi }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.submitBtn, (!isDirty || saving) && s.submitBtnDisabled]}
          onPress={handleSave}
          disabled={!isDirty || saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Text style={s.submitText}>Save targets</Text>
          }
        </TouchableOpacity>
      </View>
    </AppModal>
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
    gap: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: O,
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 26,
    letterSpacing: -0.6,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
  submitBtn: {
    flex: 1.4,
    height: 52,
    borderRadius: 14,
    backgroundColor: O,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  sectionLabel: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 0.9,
    marginTop:     20,
    marginBottom:  8,
    paddingHorizontal: 4,
  },

  footerNote: {
    textAlign:  'center',
    fontSize:   12,
    lineHeight: 17,
    marginTop:  20,
    paddingHorizontal: 16,
  },
});
