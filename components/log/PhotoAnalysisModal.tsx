import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput,
  StyleSheet, Animated, Dimensions, Easing,
  KeyboardAvoidingView, Platform, ScrollView, Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFood } from '@/hooks/use-food';
import type { PhotoPreview } from '@/context/food-context';
import { ZeroCaloriesError } from '@/context/food-context';
import type { MealLabel } from '@/components/log/ManualMealInputModal';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/components/ui/Toast';

const { width: SW, height: SH } = Dimensions.get('window');

const O   = '#F97316';
const O10 = 'rgba(249,115,22,0.10)';
const O20 = 'rgba(249,115,22,0.20)';

type Status = 'analyzing' | 'review' | 'error' | 'retry';

const MEAL_OPTIONS: { id: MealLabel; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch',     label: 'Lunch'     },
  { id: 'dinner',    label: 'Dinner'    },
  { id: 'snack',     label: 'Snack'     },
];

function deriveMealLabel(): MealLabel {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 17) return 'snack';
  if (h < 21) return 'dinner';
  return 'snack';
}

interface Props {
  visible:     boolean;
  imageUri:    string;
  base64Image: string;
  onClose:     () => void;
  onRetry?:    () => void;
}

// ── Scan overlay (line + corner brackets) ─────────────────────────────────────

const BRACKET_LEN  = 22;
const BRACKET_THCK = 2.5;

function ScanOverlay({ topInset }: { topInset: number }) {
  const translateY  = useRef(new Animated.Value(0)).current;
  const zoneTop     = topInset + 24;
  const zoneBottom  = SH * 0.30;          // leave room for the card
  const zoneHeight  = SH - zoneTop - zoneBottom;
  const LINE_H      = 56;                 // gradient height

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue:  zoneHeight - LINE_H,
          duration: 2000,
          easing:   Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue:  0,
          duration: 2000,
          easing:   Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top:    zoneTop,
        left:   28,
        right:  28,
        height: zoneHeight,
      }}
    >
      {/* Corner brackets */}
      {/* TL */}
      <View style={[cb.h, { top: 0,    left: 0  }]} />
      <View style={[cb.v, { top: 0,    left: 0  }]} />
      {/* TR */}
      <View style={[cb.h, { top: 0,    right: 0 }]} />
      <View style={[cb.v, { top: 0,    right: 0 }]} />
      {/* BL */}
      <View style={[cb.h, { bottom: 0, left: 0  }]} />
      <View style={[cb.v, { bottom: 0, left: 0  }]} />
      {/* BR */}
      <View style={[cb.h, { bottom: 0, right: 0 }]} />
      <View style={[cb.v, { bottom: 0, right: 0 }]} />

      {/* Animated scan line */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0, right: 0,
          height: LINE_H,
          transform: [{ translateY }],
        }}
      >
        {/* Simulated vertical glow using stacked views */}
        <View style={{ flex: 1, backgroundColor: 'rgba(249,115,22,0.04)' }} />
        <View style={{ flex: 0.7, backgroundColor: 'rgba(249,115,22,0.12)' }} />
        <View style={{ flex: 0.4, backgroundColor: 'rgba(249,115,22,0.30)' }} />
        <View style={{ height: 2.5, backgroundColor: O, shadowColor: O, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }} />
        <View style={{ flex: 0.4, backgroundColor: 'rgba(249,115,22,0.30)' }} />
        <View style={{ flex: 0.7, backgroundColor: 'rgba(249,115,22,0.12)' }} />
        <View style={{ flex: 1, backgroundColor: 'rgba(249,115,22,0.04)' }} />
      </Animated.View>
    </View>
  );
}

const cb = StyleSheet.create({
  h: { position: 'absolute', height: BRACKET_THCK, width: BRACKET_LEN, backgroundColor: O },
  v: { position: 'absolute', width: BRACKET_THCK,  height: BRACKET_LEN, backgroundColor: O },
});

// ── Pulsing status dot ─────────────────────────────────────────────────────────

function PulseDot() {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1.6, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,   duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1,   duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1,   duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(300),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: 10, height: 10,
          borderRadius: 5,
          backgroundColor: O,
          transform: [{ scale }],
          opacity,
        }}
      />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: O }} />
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PhotoAnalysisModal({ visible, imageUri, base64Image, onClose, onRetry }: Props) {
  const insets                    = useSafeAreaInsets();
  const { isDark }                = useTheme();
  const { previewPhoto, addMeal } = useFood();
  const toast                     = useToast();

  const [status,   setStatus]   = useState<Status>('analyzing');
  const [dots,     setDots]     = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [editName,    setEditName]    = useState('');
  const [editMeal,    setEditMeal]    = useState<MealLabel>(deriveMealLabel());
  const [editCals,    setEditCals]    = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs,   setEditCarbs]   = useState('');
  const [editFat,     setEditFat]     = useState('');

  const cardY = useRef(new Animated.Value(400)).current;

  const populate = (p: PhotoPreview) => {
    setEditName(p.name);
    setEditMeal(deriveMealLabel());
    setEditCals(String(p.cals));
    setEditProtein(String(p.protein));
    setEditCarbs(String(p.carbs));
    setEditFat(String(p.fat));
  };

  useEffect(() => {
    if (!visible) {
      cardY.setValue(400);
      setStatus('analyzing');
      setDots('');
      setIsSaving(false);
      return;
    }

    Animated.timing(cardY, {
      toValue: 0, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();

    let cancelled = false;
    (async () => {
      try {
        const preview = await previewPhoto(base64Image);
        if (cancelled) return;
        if (!preview) { setStatus('error'); return; }
        populate(preview);
        setStatus('review');
      } catch (err) {
        if (cancelled) return;
        setStatus(err instanceof ZeroCaloriesError ? 'retry' : 'error');
      }
    })();

    return () => { cancelled = true; };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status !== 'analyzing') return;
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 420);
    return () => clearInterval(id);
  }, [status]);

  const handleAddToLog = async () => {
    setIsSaving(true);
    try {
      await addMeal({
        name:     editName.trim() || 'Meal',
        label:    editMeal,
        calories: parseInt(editCals,    10) || 0,
        protein:  parseInt(editProtein, 10) || undefined,
        carbs:    parseInt(editCarbs,   10) || undefined,
        fat:      parseInt(editFat,     10) || undefined,
      });
      toast.success('Food logged', editName.trim() || 'Meal');
      onClose();
    } catch {
      toast.error('Failed to log', 'Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={status !== 'analyzing' ? onClose : undefined}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.root}>

          {/* Background image */}
          <Image source={imageUri} style={s.image} contentFit="cover" cachePolicy="memory-disk" />
          <View style={s.gradientTop} />
          <View style={s.gradientBottom} />

          {/* Scan overlay — only during analysis */}
          {status === 'analyzing' && <ScanOverlay topInset={insets.top} />}

          {/* Close button */}
          {status !== 'analyzing' && (
            <TouchableOpacity
              style={[s.closeBtn, { top: insets.top + 12 }]}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color="#FFF" />
            </TouchableOpacity>
          )}

          {/* Bottom card */}
          <Animated.View
            style={[s.card, { paddingBottom: insets.bottom + 20, transform: [{ translateY: cardY }] }]}
          >
            <View style={s.handle} />

            {/* ── Analyzing ── */}
            {status === 'analyzing' && (
              <View style={s.analyzeContent}>
                <View style={s.analyzeRow}>
                  <PulseDot />
                  <Text style={s.analyzeTitle}>Scanning your food{dots}</Text>
                </View>
                <Text style={s.analyzeCaption}>AI is identifying the meal</Text>
              </View>
            )}

            {/* ── Review & edit ── */}
            {status === 'review' && (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.reviewContent}
              >
                <View style={s.reviewHeader}>
                  <View style={s.successBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#22C55E" />
                    <Text style={s.successText}>AI identified your meal</Text>
                  </View>
                  <Text style={s.reviewHint}>Review and edit before logging</Text>
                </View>

                {/* Food name */}
                <View style={s.fieldBlock}>
                  <Text style={s.fieldLabel}>FOOD NAME</Text>
                  <TextInput
                    style={s.nameInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Meal name"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    selectionColor={O}
                    returnKeyType="done"
                    maxLength={80}
                  />
                </View>

                <View style={s.divider} />

                {/* Meal type */}
                <View style={s.fieldBlock}>
                  <Text style={s.fieldLabel}>MEAL</Text>
                  <View style={s.mealRow}>
                    {MEAL_OPTIONS.map((opt) => {
                      const active = editMeal === opt.id;
                      return (
                        <Pressable
                          key={opt.id}
                          style={[s.mealPill, active && s.mealPillActive]}
                          onPress={() => setEditMeal(opt.id)}
                        >
                          <Text style={[s.mealPillText, active && s.mealPillTextActive]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={s.divider} />

                {/* Calories */}
                <View style={s.fieldBlock}>
                  <Text style={s.fieldLabel}>CALORIES</Text>
                  <View style={s.calsRow}>
                    <TextInput
                      style={s.calsInput}
                      value={editCals}
                      onChangeText={(v) => setEditCals(v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      selectionColor={O}
                      returnKeyType="done"
                      maxLength={5}
                    />
                    <Text style={s.calsUnit}>kcal</Text>
                  </View>
                </View>

                <View style={s.divider} />

                {/* Macros */}
                <View style={s.fieldBlock}>
                  <Text style={s.fieldLabel}>NUTRITION</Text>
                  <View style={s.macroGrid}>
                    <MacroInput label="Protein" value={editProtein} color="#F97316" bg={O10}                    onChange={setEditProtein} />
                    <MacroInput label="Carbs"   value={editCarbs}   color="#FB923C" bg="rgba(251,146,60,0.10)"  onChange={setEditCarbs}   />
                    <MacroInput label="Fat"     value={editFat}     color="#FDBA74" bg="rgba(253,186,116,0.10)" onChange={setEditFat}     />
                  </View>
                </View>

                <View style={s.divider} />

                {/* Actions */}
                <View style={s.actionRow}>
                  <TouchableOpacity style={s.discardBtn} onPress={onClose} activeOpacity={0.75}>
                    <Text style={s.discardBtnText}>Discard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.logBtn, isSaving && { opacity: 0.6 }]}
                    onPress={handleAddToLog}
                    activeOpacity={0.85}
                    disabled={isSaving}
                  >
                    <Text style={s.logBtnText}>{isSaving ? 'Saving…' : 'Add to Log'}</Text>
                    {!isSaving && <Ionicons name="arrow-forward" size={16} color="#FFF" />}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {/* ── Retry ── */}
            {status === 'retry' && (
              <View style={s.errorContent}>
                <View style={[s.errorIcon, { backgroundColor: O10 }]}>
                  <Ionicons name="camera-outline" size={28} color={O} />
                </View>
                <Text style={s.analyzeTitle}>Could not calculate calories</Text>
                <Text style={[s.analyzeCaption, { marginBottom: 20, paddingHorizontal: 16 }]}>
                  The photo wasn't clear enough. Try again with better lighting or a closer shot.
                </Text>
                <TouchableOpacity
                  style={s.logBtn}
                  onPress={() => { onClose(); onRetry?.(); }}
                  activeOpacity={0.85}
                >
                  <Text style={s.logBtnText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Error ── */}
            {status === 'error' && (
              <View style={s.errorContent}>
                <View style={s.errorIcon}>
                  <Ionicons name="alert-circle-outline" size={28} color="#EF4444" />
                </View>
                <Text style={s.analyzeTitle}>Could not identify food</Text>
                <Text style={[s.analyzeCaption, { marginBottom: 20 }]}>
                  Try a clearer photo or add the meal manually.
                </Text>
                <TouchableOpacity
                  style={[s.logBtn, { backgroundColor: '#374151' }]}
                  onPress={onClose}
                  activeOpacity={0.85}
                >
                  <Text style={s.logBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── MacroInput ────────────────────────────────────────────────────────────────

function MacroInput({
  label, value, color, bg, onChange,
}: { label: string; value: string; color: string; bg: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[mi.card, { backgroundColor: bg, borderTopColor: color, borderColor: focused ? color : 'transparent' }]}>
      <TextInput
        style={[mi.input, { color }]}
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        selectionColor={color}
        returnKeyType="done"
        maxLength={4}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        textAlign="center"
      />
      <Text style={mi.unit}>g</Text>
      <Text style={mi.label}>{label}</Text>
    </View>
  );
}

const mi = StyleSheet.create({
  card:  { flex: 1, borderRadius: 14, borderTopWidth: 2, borderWidth: 1, paddingTop: 10, paddingBottom: 8, alignItems: 'center' },
  input: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, width: '100%', textAlign: 'center', paddingVertical: 0 },
  unit:  { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.40)', marginTop: -2 },
  label: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5, marginTop: 3 },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#000' },
  image: { ...StyleSheet.absoluteFillObject, width: SW, height: SH },

  gradientTop: {
    ...StyleSheet.absoluteFillObject,
    height: SH * 0.40,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  gradientBottom: {
    ...StyleSheet.absoluteFillObject,
    top: SH * 0.40,
    backgroundColor: 'rgba(0,0,0,0.60)',
  },

  closeBtn: {
    position: 'absolute',
    left: 20,
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#111111',
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 24,
  },

  handle: {
    alignSelf: 'center',
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 4,
  },

  // ── Analyzing ──
  analyzeContent: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 10,
  },
  analyzeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  analyzeTitle:   { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  analyzeCaption: { color: 'rgba(255,255,255,0.50)', fontSize: 13, fontWeight: '500', textAlign: 'center' },

  // ── Review ──
  reviewContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },

  reviewHeader: { paddingVertical: 10, gap: 4 },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  successText: { color: '#22C55E', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  reviewHint:  { color: 'rgba(255,255,255,0.30)', fontSize: 11, fontWeight: '500' },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 12 },

  fieldBlock: { gap: 8 },
  fieldLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  nameInput: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },

  mealRow:            { flexDirection: 'row', gap: 8 },
  mealPill:           { flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center' },
  mealPillActive:     { backgroundColor: O20, borderWidth: 1, borderColor: O },
  mealPillText:       { color: 'rgba(255,255,255,0.50)', fontSize: 12, fontWeight: '600' },
  mealPillTextActive: { color: O },

  calsRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  calsInput: { color: '#FFFFFF', fontSize: 42, fontWeight: '800', letterSpacing: -1.5, paddingVertical: 0, minWidth: 80 },
  calsUnit:  { color: 'rgba(255,255,255,0.35)', fontSize: 16, fontWeight: '600' },

  macroGrid: { flexDirection: 'row', gap: 8 },

  actionRow: { flexDirection: 'row', gap: 10, paddingTop: 4, paddingBottom: 4 },
  discardBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  discardBtnText: { color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '700' },

  logBtn: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    backgroundColor: O,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: O,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  logBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  // ── Error / Retry ──
  errorContent: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  errorIcon: {
    width: 60, height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
