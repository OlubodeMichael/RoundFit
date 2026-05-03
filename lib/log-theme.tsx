import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useTheme } from '@/hooks/use-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ─── Palette ────────────────────────────────────────────────────────────────
// The "Obsidian" system shared by Home, Food Log, and every Log sub-screen.
// Dominant charcoal surface, coral accents, muted macro colors for sections.
export function usePalette() {
  const { isDark } = useTheme();
  if (isDark) {
    return {
      bg:           '#0A0B0F',
      card:         '#1C1D23',           // lifted from #141519 — distinguishable from page bg
      cardEdge:     'rgba(255,255,255,0.10)', // up from 0.06 — hairline borders perceptible
      sunken:       '#0E0F13',
      raised:       '#1C1D23',           // matched to new card value
      text:         '#F4F4F5',
      textDim:      '#C4C4C8',           // up from #A1A1AA — secondary labels pass WCAG AA
      textFaint:    '#909096',           // up from #71717A — tertiary text is now readable
      hair:         'rgba(255,255,255,0.10)',

      calories:     '#FF7849',
      caloriesSoft: 'rgba(255,120,73,0.22)',   // up from 0.14 — icon pill bgs clearly tinted
      caloriesTrack:'rgba(255,120,73,0.22)',   // up from 0.12

      protein:      '#34D399',
      proteinSoft:  'rgba(52,211,153,0.22)',   // up from 0.14
      carbs:        '#FBBF24',
      carbsSoft:    'rgba(251,191,36,0.22)',   // up from 0.14
      fat:          '#A78BFA',
      fatSoft:      'rgba(167,139,250,0.22)',  // up from 0.14

      water:        '#38BDF8',
      waterSoft:    'rgba(56,189,248,0.22)',   // up from 0.14
      sleep:        '#818CF8',
      sleepSoft:    'rgba(129,140,248,0.22)',  // up from 0.14
      weight:       '#60A5FA',
      weightSoft:   'rgba(96,165,250,0.22)',
      workout:      '#22D3EE',
      workoutSoft:  'rgba(34,211,238,0.22)',   // up from 0.14
      body:         '#FB7185',
      bodySoft:     'rgba(251,113,133,0.22)',  // up from 0.14

      danger:       '#F97066',
      dangerSoft:   'rgba(249,112,102,0.22)',  // up from 0.14
      sage:         '#34D399',

      isDark:       true,
    };
  }
  return {
    bg:           '#F6F6F8',
    card:         '#FFFFFF',
    cardEdge:     'rgba(15,23,42,0.06)',
    sunken:       '#F1F1F4',
    raised:       '#FFFFFF',
    text:         '#09090B',
    textDim:      '#52525B',
    textFaint:    '#A1A1AA',
    hair:         'rgba(15,23,42,0.08)',

    calories:     '#EA580C',
    caloriesSoft: 'rgba(234,88,12,0.10)',
    caloriesTrack:'rgba(234,88,12,0.10)',

    protein:      '#10B981',
    proteinSoft:  'rgba(16,185,129,0.10)',
    carbs:        '#D97706',
    carbsSoft:    'rgba(217,119,6,0.10)',
    fat:          '#7C3AED',
    fatSoft:      'rgba(124,58,237,0.10)',

    water:        '#0EA5E9',
    waterSoft:    'rgba(14,165,233,0.10)',
    sleep:        '#4F46E5',
    sleepSoft:    'rgba(79,70,229,0.10)',
    weight:       '#2563EB',
    weightSoft:   'rgba(37,99,235,0.10)',
    workout:      '#0891B2',
    workoutSoft:  'rgba(8,145,178,0.10)',
    body:         '#E11D48',
    bodySoft:     'rgba(225,29,72,0.10)',

    danger:       '#DC2626',
    dangerSoft:   'rgba(220,38,38,0.08)',
    sage:         '#059669',

    isDark:       false,
  };
}

export type Palette = ReturnType<typeof usePalette>;

// ─── AnimatedCard ───────────────────────────────────────────────────────────
// Staggered entrance (translate-Y + fade) used across every surface.
export function AnimatedCard({
  children,
  delay = 0,
  padding = 20,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  padding?: number;
  style?: ViewStyle | ViewStyle[];
}) {
  const P    = usePalette();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue:        1,
      duration:       620,
      delay,
      easing:         Easing.out(Easing.cubic),
      useNativeDriver:true,
    }).start();
  }, [anim, delay]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Animated.View
      style={[
        {
          backgroundColor: P.card,
          borderRadius:    24,
          borderWidth:     StyleSheet.hairlineWidth,
          borderColor:     P.cardEdge,
          padding,
          shadowColor:     '#000',
          shadowOpacity:   P.isDark ? 0.35 : 0.06,
          shadowRadius:    P.isDark ? 18 : 12,
          shadowOffset:    { width: 0, height: 6 },
          ...Platform.select({ android: { elevation: 2 } }),
          opacity:         anim,
          transform:       [{ translateY }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ─── ScreenHeader ───────────────────────────────────────────────────────────
// Back chevron + eyebrow + big title. Used by every Log sub-screen.
export function ScreenHeader({
  eyebrow,
  title,
  accent,
  right,
  onBack,
}: {
  eyebrow?: string;
  title:    string;
  accent?:  string;
  right?:   React.ReactNode;
  onBack?:  () => void;
}) {
  const P      = usePalette();
  const router = useRouter();
  const back   = onBack ?? (() => router.back());

  return (
    <View style={s.header}>
      <TouchableOpacity
        onPress={back}
        hitSlop={10}
        style={[s.backBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={20} color={P.text} />
      </TouchableOpacity>

      <View style={{ flex: 1, marginLeft: 14 }}>
        {!!eyebrow && (
          <Text style={[s.eyebrow, { color: P.textFaint }]}>
            {eyebrow.toUpperCase()}
          </Text>
        )}
        <Text style={[s.title, { color: P.text }]} numberOfLines={1}>
          {title}
          <Text style={{ color: accent ?? P.calories }}>.</Text>
        </Text>
      </View>

      {right}
    </View>
  );
}

// ─── FieldLabel ─────────────────────────────────────────────────────────────
export function FieldLabel({ children }: { children: React.ReactNode }) {
  const P = usePalette();
  return (
    <Text style={[s.fieldLabel, { color: P.textFaint }]}>
      {String(children).toUpperCase()}
    </Text>
  );
}

// ─── TextField ──────────────────────────────────────────────────────────────
export function TextField(props: TextInputProps & { unit?: string }) {
  const P = usePalette();
  const { unit, style, ...rest } = props;
  return (
    <View style={[s.field, { borderColor: P.cardEdge, backgroundColor: P.sunken }]}>
      <TextInput
        placeholderTextColor={P.textFaint}
        style={[s.fieldInput, { color: P.text }, style]}
        {...rest}
      />
      {!!unit && (
        <Text style={[s.fieldUnit, { color: P.textFaint }]}>{unit}</Text>
      )}
    </View>
  );
}

// ─── PrimaryButton ──────────────────────────────────────────────────────────
export function PrimaryButton({
  label,
  icon,
  onPress,
  loading,
  disabled,
  accent,
}: {
  label:     string;
  icon?:     IoniconName;
  onPress:   () => void;
  loading?:  boolean;
  disabled?: boolean;
  accent?:   string;
}) {
  const P   = usePalette();
  const acc = accent ?? P.calories;
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        s.cta,
        { backgroundColor: disabled ? P.raised : acc },
        pressed && !disabled && { opacity: 0.9, transform: [{ scale: 0.99 }] },
      ]}
    >
      {!!icon && !loading && <Ionicons name={icon} size={18} color="#fff" />}
      <Text style={s.ctaText}>{loading ? 'Saving…' : label}</Text>
    </Pressable>
  );
}

// ─── ScreenScaffold ─────────────────────────────────────────────────────────
// Standard container: safe area top padding, bg color, consistent spacing.
// Consumers pass their own ScrollView/children inside.
export function useScreenPadding() {
  const insets = useSafeAreaInsets();
  return {
    paddingTop:    insets.top + 12,
    paddingBottom: insets.bottom + 48,
  };
}

// ─── MiniLabel ──────────────────────────────────────────────────────────────
// Secondary field caption (e.g. "Bedtime"/"Wake" pairs). Lighter weight +
// smaller tracking than FieldLabel.
export function MiniLabel({ children }: { children: React.ReactNode }) {
  const P = usePalette();
  return (
    <Text style={[s.miniLabel, { color: P.textFaint }]}>
      {String(children)}
    </Text>
  );
}

// ─── NotesField ─────────────────────────────────────────────────────────────
// Multiline notes textarea in a sunken container. Used on sleep, body, and
// workout logs.
export function NotesField({
  value,
  onChangeText,
  placeholder = 'Notes',
  minHeight = 70,
}: {
  value:         string;
  onChangeText:  (v: string) => void;
  placeholder?:  string;
  minHeight?:    number;
}) {
  const P = usePalette();
  return (
    <View style={[s.textArea, { borderColor: P.cardEdge, backgroundColor: P.sunken }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={P.textFaint}
        multiline
        style={{
          color:           P.text,
          fontSize:        14,
          fontWeight:      '500',
          minHeight,
          textAlignVertical: 'top',
        }}
      />
    </View>
  );
}

// ─── DotMeter ───────────────────────────────────────────────────────────────
// N small dots, the first `active` filled — used for soreness intensity and
// workout intensity pickers.
export function DotMeter({
  total,
  active,
  color,
  inverted = false,
}: {
  total:     number;
  active:    number;
  color:     string;
  /** When the meter lives inside an active/filled cell, swap the fill + track colors. */
  inverted?: boolean;
}) {
  const P = usePalette();
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 5, height: 5, borderRadius: 3,
            backgroundColor: i < active
              ? (inverted ? '#fff' : color)
              : (inverted ? 'rgba(255,255,255,0.25)' : P.cardEdge),
          }}
        />
      ))}
    </View>
  );
}

// ─── Tip ────────────────────────────────────────────────────────────────────
// Small icon + body-copy row. Used for instructional hints (scan/photo/weight).
export function Tip({
  icon,
  children,
  tint,
}: {
  icon:      IoniconName;
  children:  React.ReactNode;
  /** Accent color for the icon puck. Defaults to the calories accent. */
  tint?:     string;
}) {
  const P     = usePalette();
  const color = tint ?? P.calories;
  const soft  = color + '22';
  return (
    <View style={s.tipRow}>
      <View style={[s.tipIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={[s.tipText, { color: P.textDim }]}>{children}</Text>
    </View>
  );
}

// ─── StatColumn ─────────────────────────────────────────────────────────────
// Centered label + value stack. Pair with `<StatDivider />` between columns.
export function StatColumn({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'dim' | 'positive';
}) {
  const P    = usePalette();
  const ink  = tone === 'positive' ? P.sage
            : tone === 'dim'      ? P.textDim
            :                       P.text;
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Text style={[s.statLabel, { color: P.textFaint }]}>{label.toUpperCase()}</Text>
      <Text style={[s.statValue, { color: ink }]}>{value}</Text>
    </View>
  );
}

export function StatDivider() {
  const P = usePalette();
  return <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: P.hair }} />;
}

const s = StyleSheet.create({
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal:20,
    marginBottom:     14,
  },
  backBtn: {
    width:           40, height: 40, borderRadius: 14,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     StyleSheet.hairlineWidth,
  },
  eyebrow: {
    fontSize:       10,
    fontWeight:     '700',
    letterSpacing:  1.8,
    marginBottom:   2,
  },
  title: {
    fontSize:       24,
    fontWeight:     '800',
    letterSpacing:  -0.6,
  },

  fieldLabel: {
    fontSize:       10,
    fontWeight:     '800',
    letterSpacing:  1.4,
    marginBottom:   8,
  },
  field: {
    flexDirection:    'row',
    alignItems:       'center',
    borderWidth:      StyleSheet.hairlineWidth,
    borderRadius:     14,
    paddingHorizontal:14,
    height:           50,
  },
  fieldInput: {
    flex:       1,
    fontSize:   15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  fieldUnit: {
    fontSize:      12,
    fontWeight:    '700',
    letterSpacing: 0.6,
    marginLeft:    8,
  },

  cta: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'center',
    gap:              8,
    paddingVertical:  16,
    borderRadius:     16,
  },
  ctaText: {
    color:          '#fff',
    fontSize:       15,
    fontWeight:     '800',
    letterSpacing:  -0.2,
  },

  miniLabel: {
    fontSize:       10,
    fontWeight:     '700',
    letterSpacing:  1.2,
    marginBottom:   6,
  },

  textArea: {
    borderWidth:      StyleSheet.hairlineWidth,
    borderRadius:     14,
    paddingHorizontal:14,
    paddingVertical:  12,
  },

  tipRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  tipIcon: {
    width:          30, height: 30, borderRadius: 10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  tipText: {
    flex:       1,
    fontSize:   12,
    fontWeight: '600',
    lineHeight: 17,
  },

  statLabel: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.4,
  },
  statValue: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },
});
