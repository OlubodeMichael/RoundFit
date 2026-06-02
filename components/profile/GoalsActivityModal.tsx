import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { normaliseGoal, type UserProfile } from '@/context/auth-context';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const O = '#F97316';

type GoalValue = UserProfile['goal'];
type ActivityValue = UserProfile['activityLevel'];

interface GoalOption {
  label: string;
  value: GoalValue;
  icon: IoniconsName;
}

interface ActivityOption {
  label: string;
  sub: string;
  value: ActivityValue;
  icon: IoniconsName;
  bars: 1 | 2 | 3 | 4;
}

const GOAL_OPTIONS: GoalOption[] = [
  { label: 'Lose weight',  value: 'lose_weight',  icon: 'trending-down-outline' },
  { label: 'Build muscle', value: 'build_muscle', icon: 'barbell-outline'       },
  { label: 'Boost energy', value: 'boost_energy', icon: 'flash-outline'         },
  { label: 'Maintain',     value: 'maintain',     icon: 'pulse-outline'         },
];

const ACTIVITY_OPTIONS: ActivityOption[] = [
  { label: 'Sedentary',         sub: 'Little or no exercise', value: 'sedentary',         icon: 'bed-outline',     bars: 1 },
  { label: 'Lightly active',    sub: '1–3 days / week',       value: 'lightly_active',    icon: 'walk-outline',    bars: 2 },
  { label: 'Moderately active', sub: '3–5 days / week',       value: 'moderately_active', icon: 'bicycle-outline', bars: 3 },
  { label: 'Very active',       sub: '6–7 days / week',       value: 'very_active',       icon: 'fitness-outline', bars: 4 },
];

function parseActivity(value: UserProfile['activityLevel'] | undefined): ActivityValue {
  if (
    value === 'sedentary' ||
    value === 'lightly_active' ||
    value === 'moderately_active' ||
    value === 'very_active'
  ) {
    return value;
  }
  return 'lightly_active';
}

interface Palette {
  hi: string;
  mid: string;
  lo: string;
  sunken: string;
  accentSoft: string;
  edge: string;
  isDark: boolean;
}

function useModalPalette(isDark: boolean): Palette {
  return {
    hi:         isDark ? '#F4F4F5' : '#111111',
    mid:        isDark ? '#909096' : '#6B7280',
    lo:         isDark ? '#2A2A32' : '#EBEBEB',
    sunken:     isDark ? '#141519' : '#F3F3F5',
    accentSoft: isDark ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.07)',
    edge:       isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
    isDark,
  };
}

function selectionStyle(active: boolean, P: Palette): ViewStyle {
  if (active) {
    return {
      backgroundColor: P.accentSoft,
      borderColor: O,
      borderWidth: 2,
      ...Platform.select({
        ios: {
          shadowColor: O,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.22,
          shadowRadius: 10,
        },
        android: { elevation: 3 },
      }),
    };
  }
  return {
    backgroundColor: P.sunken,
    borderColor: P.edge,
    borderWidth: 2,
  };
}

function SectionEyebrow({ label, color, style }: { label: string; color: string; style?: object }) {
  return (
    <Text style={[s.sectionEyebrow, { color }, style]}>
      {label.toUpperCase()}
    </Text>
  );
}

function SelectionCheck({ visible, P }: { visible: boolean; P: Palette }) {
  if (!visible) return null;
  return (
    <View style={[s.checkBadge, { borderColor: P.isDark ? '#1C1D23' : '#FFFFFF' }]}>
      <Ionicons name="checkmark" size={11} color="#FFF" />
    </View>
  );
}

function IntensityBars({ count, active, P }: { count: number; active: boolean; P: Palette }) {
  return (
    <View style={s.barsRow}>
      {[1, 2, 3, 4].map((n) => {
        const filled = n <= count;
        const h = filled ? 6 + n * 3 : 6;
        return (
          <View
            key={n}
            style={[
              s.bar,
              {
                height: h,
                backgroundColor: filled
                  ? (active ? O : (P.isDark ? '#505058' : '#C0C0C8'))
                  : (P.isDark ? '#252530' : '#E5E5EA'),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function GoalTile({
  option,
  active,
  onPress,
  P,
}: {
  option: GoalOption;
  active: boolean;
  onPress: () => void;
  P: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={option.label}
      style={({ pressed }) => [
        s.goalTile,
        selectionStyle(active, P),
        pressed && s.pressed,
      ]}
    >
      <SelectionCheck visible={active} P={P} />
      <View
        style={[
          s.goalIconWrap,
          { backgroundColor: active ? 'rgba(249,115,22,0.18)' : (P.isDark ? '#1C1D23' : '#FFFFFF') },
        ]}
      >
        <Ionicons name={option.icon} size={18} color={active ? O : P.mid} />
      </View>
      <Text
        style={[
          s.goalLabel,
          { color: active ? P.hi : P.mid },
          active && s.goalLabelActive,
        ]}
        numberOfLines={2}
      >
        {option.label}
      </Text>
    </Pressable>
  );
}

function ActivityCard({
  option,
  active,
  onPress,
  P,
}: {
  option: ActivityOption;
  active: boolean;
  onPress: () => void;
  P: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${option.label}, ${option.sub}`}
      style={({ pressed }) => [
        s.activityCard,
        selectionStyle(active, P),
        pressed && s.pressed,
      ]}
    >
      <SelectionCheck visible={active} P={P} />
      <View style={s.activityTop}>
        <View
          style={[
            s.activityIconWrap,
            { backgroundColor: active ? 'rgba(249,115,22,0.18)' : (P.isDark ? '#1C1D23' : '#FFFFFF') },
          ]}
        >
          <Ionicons name={option.icon} size={17} color={active ? O : P.mid} />
        </View>
        <IntensityBars count={option.bars} active={active} P={P} />
      </View>
      <Text style={[s.activityLabel, { color: active ? P.hi : P.mid }, active && s.activityLabelActive]}>
        {option.label}
      </Text>
      <Text style={[s.activitySub, { color: P.mid }]}>{option.sub}</Text>
    </Pressable>
  );
}

export interface GoalsActivityModalProps {
  visible: boolean;
  onClose: () => void;
}

export function GoalsActivityModal({ visible, onClose }: GoalsActivityModalProps) {
  const { isDark } = useTheme();
  const P = useModalPalette(isDark);
  const { profile, updateProfile } = useProfile();

  const [saving, setSaving] = useState(false);
  const [goal, setGoal] = useState<GoalValue>(() => normaliseGoal(profile?.goal ?? 'maintain'));
  const [activityLevel, setActivityLevel] = useState<ActivityValue>(() =>
    parseActivity(profile?.activityLevel),
  );

  useEffect(() => {
    if (!visible || !profile) return;
    setGoal(normaliseGoal(profile.goal ?? 'maintain'));
    setActivityLevel(parseActivity(profile.activityLevel));
  }, [visible, profile]);

  const isDirty = useMemo(() => {
    if (!profile) return false;
    return goal !== profile.goal || activityLevel !== profile.activityLevel;
  }, [profile, goal, activityLevel]);

  const canSave = isDirty && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await updateProfile({ goal, activityLevel });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      sheetHeight={0.82}
      dismissGestureArea="sheet"
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>PREFERENCES</Text>
            <Text style={[s.modalTitle, { color: P.hi }]}>Goals & activity</Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
            style={[s.closeBtn, { backgroundColor: P.isDark ? '#252530' : '#ECEAE6' }]}
          >
            <Text style={[s.closeBtnText, { color: P.mid }]}>✕</Text>
          </Pressable>
        </View>

        <SectionEyebrow label="Your goal" color={P.mid} />
        <View style={s.goalGrid}>
          {GOAL_OPTIONS.map((opt) => (
            <View key={opt.value} style={s.goalCell}>
              <GoalTile
                option={opt}
                active={goal === opt.value}
                onPress={() => setGoal(opt.value)}
                P={P}
              />
            </View>
          ))}
        </View>

        <SectionEyebrow label="Activity level" color={P.mid} style={s.activitySection} />
        <View style={s.activityList}>
          {ACTIVITY_OPTIONS.map((opt) => (
            <ActivityCard
              key={opt.value}
              option={opt}
              active={activityLevel === opt.value}
              onPress={() => setActivityLevel(opt.value)}
              P={P}
            />
          ))}
        </View>
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
          style={[s.submitBtn, !canSave && s.submitBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Text style={s.submitText}>Save changes</Text>
          }
        </TouchableOpacity>
      </View>
    </AppModal>
  );
}

const s = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
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
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  activitySection: {
    marginTop: 22,
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  goalCell: {
    width: '47.5%',
    flexGrow: 1,
  },
  goalTile: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
    minHeight: 108,
    justifyContent: 'space-between',
    gap: 12,
    overflow: 'visible',
  },
  goalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 21,
  },
  goalLabelActive: {
    fontWeight: '700',
  },
  activityList: {
    gap: 10,
  },
  activityCard: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
    overflow: 'visible',
  },
  activityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 12,
  },
  activityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityLabel: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  activityLabelActive: {
    fontWeight: '700',
  },
  activitySub: {
    fontSize: 14,
    lineHeight: 19,
  },
  barsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 20,
    justifyContent: 'flex-end',
    paddingRight: 4,
  },
  bar: {
    width: 6,
    borderRadius: 3,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: O,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
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
});
