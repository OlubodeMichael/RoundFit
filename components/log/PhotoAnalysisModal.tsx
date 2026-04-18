import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, Image, TouchableOpacity,
  StyleSheet, Animated, Dimensions, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFood } from '@/hooks/use-food';
import type { MealItem } from '@/hooks/use-food';
import { ZeroCaloriesError } from '@/context/food-context';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/components/ui/Toast';

const { width: SW, height: SH } = Dimensions.get('window');

const O    = '#F97316';
const O10  = 'rgba(249,115,22,0.10)';
const O35  = 'rgba(249,115,22,0.35)';

type Status = 'analyzing' | 'done' | 'error' | 'retry';

interface Props {
  visible:     boolean;
  imageUri:    string;
  base64Image: string;
  onClose:     () => void;
  /** Called after dismiss when the user taps Try Again (e.g. reopen camera). */
  onRetry?:    () => void;
}

// ── Pulsing ring ──────────────────────────────────────────────────────────────

function PulseRing({ delay, size }: { delay: number; size: number }) {
  const scale   = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 0.4, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.8, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width:  size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: O,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PhotoAnalysisModal({ visible, imageUri, base64Image, onClose, onRetry }: Props) {
  const insets         = useSafeAreaInsets();
  const { isDark }     = useTheme();
  const { analyzePhoto } = useFood();
  const toast            = useToast();

  const [status, setStatus] = useState<Status>('analyzing');
  const [result, setResult] = useState<MealItem | null>(null);
  const [dots,   setDots]   = useState('');

  // ── Card slide-up ──────────────────────────────────────────────────────────
  const cardY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (!visible) {
      cardY.setValue(300);
      setStatus('analyzing');
      setResult(null);
      setDots('');
      return;
    }

    // Slide card in
    Animated.timing(cardY, {
      toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();

    // Run analysis
    let cancelled = false;
    (async () => {
      try {
        const item = await analyzePhoto(base64Image);
        if (cancelled) return;
        setResult(item);
        setStatus(item ? 'done' : 'error');
        if (item) {
          toast.success('Food logged', item.name);
        } else {
          toast.error('Analysis failed', 'Please try another photo.');
        }
      } catch (err) {
        if (cancelled) return;
        const isZero = err instanceof ZeroCaloriesError;
        setStatus(isZero ? 'retry' : 'error');
        if (isZero) {
          toast.warning('No food detected', 'Try a clearer photo of your meal.');
        } else {
          toast.error('Analysis failed', 'Please try again.');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Animated dots ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'analyzing') return;
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 420);
    return () => clearInterval(id);
  }, [status]);

  const bg  = isDark ? '#0C0C0C' : '#0C0C0C'; // always dark for drama
  const hi  = '#FFFFFF';
  const mid = 'rgba(255,255,255,0.55)';

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={status !== 'analyzing' ? onClose : undefined}
    >
      <View style={[s.root, { backgroundColor: bg }]}>

        {/* ── Food image ── */}
        <Image source={{ uri: imageUri }} style={s.image} resizeMode="cover" />

        {/* ── Dark gradient overlay ── */}
        <View style={s.gradientTop} />
        <View style={s.gradientBottom} />

        {/* ── Close button (only when done / error) ── */}
        {status !== 'analyzing' && (
          <TouchableOpacity
            style={[s.closeBtn, { top: insets.top + 12 }]}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color="#FFF" />
          </TouchableOpacity>
        )}

        {/* ── Bottom card ── */}
        <Animated.View
          style={[s.card, { paddingBottom: insets.bottom + 24, transform: [{ translateY: cardY }] }]}
        >
          {status === 'analyzing' && (
            <View style={s.analyzeContent}>
              {/* Pulse rings */}
              <View style={s.pulseWrap}>
                <PulseRing delay={0}    size={120} />
                <PulseRing delay={400}  size={120} />
                <PulseRing delay={800}  size={120} />
                {/* Center orb */}
                <View style={s.orb}>
                  <Text style={s.orbLabel}>AI</Text>
                </View>
              </View>

              <Text style={s.analyzeTitle}>Analyzing your food{dots}</Text>
              <Text style={s.analyzeCaption}>GPT-4 Vision is identifying the meal</Text>
            </View>
          )}

          {status === 'done' && result && (
            <View style={s.resultContent}>
              {/* Success badge */}
              <View style={s.successBadge}>
                <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
                <Text style={s.successText}>Food identified</Text>
              </View>

              {/* Food items list */}
              <View style={s.foodList}>
                {result.name.split(', ').filter(Boolean).map((food, i) => (
                  <View key={i} style={s.foodRow}>
                    <View style={[s.foodDot, { backgroundColor: i === 0 ? O : 'rgba(255,255,255,0.35)' }]} />
                    <Text style={[s.foodItem, { fontSize: i === 0 ? 18 : 15, opacity: i === 0 ? 1 : 0.7 }]} numberOfLines={1}>
                      {food}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Calories pill */}
              <View style={[s.calPill, { backgroundColor: O10, borderColor: O35 }]}>
                <Text style={[s.calNum, { color: O }]}>{result.cals}</Text>
                <Text style={[s.calUnit, { color: O }]}> cal</Text>
              </View>

              {/* Macros */}
              <View style={s.macroRow}>
                {typeof result.protein === 'number' && (
                  <MacroChip label="Protein" value={`${result.protein}g`} color={O} bg={O10} />
                )}
                {typeof result.carbs === 'number' && (
                  <MacroChip label="Carbs" value={`${result.carbs}g`} color="#FB923C" bg="rgba(251,146,60,0.10)" />
                )}
                {typeof result.fat === 'number' && (
                  <MacroChip label="Fat" value={`${result.fat}g`} color="#FDBA74" bg="rgba(253,186,116,0.10)" />
                )}
              </View>

              {/* Added notice + done button */}
              <Text style={[s.addedNote, { color: mid }]}>Added to your food log</Text>
              <TouchableOpacity style={s.doneBtn} onPress={onClose} activeOpacity={0.85}>
                <Text style={s.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'retry' && (
            <View style={s.errorContent}>
              <View style={[s.errorIcon, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
                <Ionicons name="camera-outline" size={28} color={O} />
              </View>
              <Text style={[s.analyzeTitle, { color: hi }]}>Could not calculate calories</Text>
              <Text style={[s.analyzeCaption, { marginBottom: 24 }]}>
                The photo was not clear enough to estimate nutrition. Try again with better lighting or a closer shot.
              </Text>
              <TouchableOpacity
                style={s.doneBtn}
                onPress={() => {
                  onClose();
                  onRetry?.();
                }}
                activeOpacity={0.85}
              >
                <Text style={s.doneBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'error' && (
            <View style={s.errorContent}>
              <View style={s.errorIcon}>
                <Ionicons name="alert-circle-outline" size={28} color="#EF4444" />
              </View>
              <Text style={[s.analyzeTitle, { color: hi }]}>Could not identify food</Text>
              <Text style={[s.analyzeCaption, { marginBottom: 24 }]}>
                Try a clearer photo or add the meal manually.
              </Text>
              <TouchableOpacity style={s.doneBtn} onPress={onClose} activeOpacity={0.85}>
                <Text style={s.doneBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

      </View>
    </Modal>
  );
}

// ── MacroChip ─────────────────────────────────────────────────────────────────

function MacroChip({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipLabel, { color }]}>{label}</Text>
      <Text style={[s.chipVal,   { color }]}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD_RADIUS = 28;

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#000' },
  image: { ...StyleSheet.absoluteFillObject, width: SW, height: SH },

  gradientTop: {
    ...StyleSheet.absoluteFillObject,
    height: SH * 0.35,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  gradientBottom: {
    ...StyleSheet.absoluteFillObject,
    top: SH * 0.35,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  closeBtn: {
    position: 'absolute',
    left: 20,
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Card ──
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111111',
    borderTopLeftRadius:  CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
    paddingTop: 12,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },

  // ── Analyzing ──
  analyzeContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 20,
  },

  pulseWrap: {
    width: 120, height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },

  orb: {
    width: 52, height: 52,
    borderRadius: 26,
    backgroundColor: O,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: O,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 8,
  },
  orbLabel: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },

  analyzeTitle:   { color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  analyzeCaption: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '500', textAlign: 'center' },

  // ── Result ──
  resultContent: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 8,
    gap: 14,
  },

  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  successText: { color: '#22C55E', fontSize: 13, fontWeight: '700' },

  foodList: { width: '100%', gap: 8 },
  foodRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  foodDot:  { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  foodItem: { color: '#FFFFFF', fontWeight: '700', letterSpacing: -0.2, flex: 1 },

  calPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
  },
  calNum:  { fontSize: 20, fontWeight: '800' },
  calUnit: { fontSize: 13, fontWeight: '600' },

  macroRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  chipLabel:{ fontSize: 11, fontWeight: '700' },
  chipVal:  { fontSize: 13, fontWeight: '700' },

  addedNote: { fontSize: 12, fontWeight: '500' },

  doneBtn: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: O,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  doneBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  // ── Error ──
  errorContent: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 16,
    gap: 10,
  },
  errorIcon: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
