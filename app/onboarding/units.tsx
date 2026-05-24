import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ProgressBar } from '@/components/onboarding/progress-bar';

export default function UnitsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name: string; age: string; sex: string;
    height: string; weight: string; goal: string; activity: string;
  }>();
  const insets = useSafeAreaInsets();
  const [unit, setUnit] = useState<'metric' | 'imperial' | null>(null);

  // Derive display values from upstream params
  const weightKg    = Number(params.weight) || 70;
  const heightCm    = Number(params.height) || 172;
  const weightLb    = Math.round(weightKg * 2.20462);
  const totalIn     = Math.round(heightCm / 2.54);
  const heightFt    = Math.floor(totalIn / 12);
  const heightInRem = totalIn % 12;

  const fade   = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;
  const card1F = useRef(new Animated.Value(0)).current;
  const card2F = useRef(new Animated.Value(0)).current;
  const card1Y = useRef(new Animated.Value(28)).current;
  const card2Y = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    [[card1F, card1Y, 150], [card2F, card2Y, 240]].forEach(([f, y, delay]) => {
      Animated.parallel([
        Animated.timing(f as Animated.Value, { toValue: 1, duration: 400, delay: delay as number, useNativeDriver: true }),
        Animated.timing(y as Animated.Value, { toValue: 0, duration: 360, delay: delay as number, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canContinue = unit !== null;

  const CARDS = [
    {
      key:    'metric'   as const,
      label:  'Metric',
      tags:   ['kg', 'cm', 'km'],
      weight: `${weightKg} kg`,
      height: `${heightCm} cm`,
      anim:   { fade: card1F, y: card1Y },
    },
    {
      key:    'imperial' as const,
      label:  'Imperial',
      tags:   ['lb', 'ft·in', 'mph'],
      weight: `${weightLb} lb`,
      height: `${heightFt}'${heightInRem}"`,
      anim:   { fade: card2F, y: card2Y },
    },
  ];

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.progress}>
        <ProgressBar
          step={params.sex === 'female' ? 10 : 7}
          total={params.sex === 'female' ? 12 : 9}
          backHref={{
            pathname: params.sex === 'female' ? '/onboarding/life-stage' : '/onboarding/activity',
            params,
          }}
          isDark={false}
        />
      </View>

      <View style={{ flex: 1 }}>
      <Animated.View style={{ opacity: fade, transform: [{ translateY: slideY }] }}>
        <Text style={s.headline}>Your unit.</Text>
      </Animated.View>

      {/* ── Cards ── */}
      <View style={s.grid}>
        {CARDS.map((c) => {
          const active = unit === c.key;
          return (
            <Animated.View
              key={c.key}
              style={[s.cardWrap, { opacity: c.anim.fade, transform: [{ translateY: c.anim.y }] }]}
            >
              <TouchableOpacity
                style={[s.card, active && s.cardActive]}
                onPress={() => setUnit(c.key)}
                activeOpacity={0.82}
              >
                {/* Icon + checkmark row */}
                <View style={s.iconRow}>
                  <View style={[s.iconSquare, active ? s.iconSquareActive : s.iconSquareInactive]}>
                    <Ionicons name="options-outline" size={22} color="#F97316" />
                  </View>
                  {active && (
                    <View style={s.checkBadge}>
                      <Ionicons name="checkmark" size={12} color="#FFF" />
                    </View>
                  )}
                </View>

                {/* Label */}
                <Text style={[s.cardLabel, active && s.cardLabelActive]}>{c.label}</Text>

                {/* Tag pills */}
                <View style={s.tagsRow}>
                  {c.tags.map(t => (
                    <View key={t} style={[s.tag, active && s.tagActive]}>
                      <Text style={[s.tagText, active && s.tagTextActive]}>{t}</Text>
                    </View>
                  ))}
                </View>

                {/* Divider */}
                <View style={[s.divider, active && s.dividerActive]} />

                {/* "YOU ARE" stats */}
                <Text style={[s.youAre, active && s.youAreActive]}>YOU ARE</Text>

                <View style={s.statRow}>
                  <Text style={[s.statKey, active && s.statKeyActive]}>Weight</Text>
                  <Text style={[s.statVal, active && s.statValActive]}>{c.weight}</Text>
                </View>
                <View style={s.statRow}>
                  <Text style={[s.statKey, active && s.statKeyActive]}>Height</Text>
                  <Text style={[s.statVal, active && s.statValActive]}>{c.height}</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {/* Footer note */}
      <Animated.View style={{ opacity: fade }}>
        <Text style={s.note}>
          You can switch any time in <Text style={s.noteBold}>Profile {'→'} Preferences</Text>.
        </Text>
      </Animated.View>
      </View>

      <TouchableOpacity
        style={[s.cta, { opacity: canContinue ? 1 : 0.35 }]}
        activeOpacity={0.85}
        disabled={!canContinue}
        onPress={() => router.push({
          pathname: '/onboarding/name',
          params: { ...params, unit: unit! },
        })}
      >
        <Text style={s.ctaText}>Continue  →</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#FAFAF8', paddingHorizontal: 20 },
  progress: { marginBottom: 8 },
  headline: {
    fontSize: 42, fontWeight: '900', letterSpacing: -2,
    lineHeight: 48, color: '#111111', marginBottom: 24,
  },

  // ── Cards ──────────────────────────────────────────────────────────────────
  grid:     { flexDirection: 'row', gap: 12, marginBottom: 18 },
  cardWrap: { flex: 1 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  cardActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },

  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconSquare: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  iconSquareInactive: { backgroundColor: 'rgba(249,115,22,0.10)' },
  iconSquareActive:   { backgroundColor: '#2A1A0E' },

  checkBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#F97316',
    alignItems: 'center', justifyContent: 'center',
  },

  cardLabel:       { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, color: '#111111' },
  cardLabelActive: { color: '#FFFFFF' },

  tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag:     { backgroundColor: '#F2F0EC', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagActive: { backgroundColor: '#2A2A2A' },
  tagText:       { fontSize: 11, fontWeight: '600', color: '#555555' },
  tagTextActive: { color: '#888888' },

  divider:       { height: 1, backgroundColor: '#EBEBEB', marginVertical: 2 },
  dividerActive: { backgroundColor: '#2A2A2A' },

  youAre:       { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: '#AAAAAA' },
  youAreActive: { color: '#555555' },

  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  statKey:       { fontSize: 15, fontWeight: '400', color: '#AAAAAA' },
  statKeyActive: { color: '#666666' },
  statVal:       { fontSize: 18, fontWeight: '800', letterSpacing: -0.5, color: '#111111', fontVariant: ['tabular-nums'] },
  statValActive: { color: '#FFFFFF' },

  // ── Footer note ────────────────────────────────────────────────────────────
  note:     { fontSize: 13, color: '#AAAAAA', textAlign: 'center' },
  noteBold: { fontWeight: '700', color: '#888888' },

  // ── CTA ────────────────────────────────────────────────────────────────────
  cta:     { backgroundColor: '#111111', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
