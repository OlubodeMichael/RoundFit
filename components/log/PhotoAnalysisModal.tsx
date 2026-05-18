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
const IMAGE_H = Math.round(SH * 0.40);

const O   = '#F97316';
const O10 = 'rgba(249,115,22,0.10)';
const O20 = 'rgba(249,115,22,0.20)';

const C_PROTEIN = '#22C55E';
const C_FAT     = '#A855F7';
const C_CARBS   = '#EAB308';

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

function formatTime(): string {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function estimateWeight(cals: number): number {
  return Math.round(cals * 0.65);
}

function splitFoodName(name: string): { main: string; sub: string | null } {
  const lower = name.toLowerCase();
  for (const w of [' with ', ' & ', ' - ']) {
    const idx = lower.indexOf(w);
    if (idx > 0) return { main: name.slice(0, idx), sub: name.slice(idx + w.length) };
  }
  return { main: name, sub: null };
}

interface Props {
  visible:     boolean;
  imageUri:    string;
  base64Image: string;
  onClose:     () => void;
  onRetry?:    () => void;
}

function usePalette(isDark: boolean) {
  return {
    bg:          isDark ? '#111111'                   : '#F5F5F7',
    card:        isDark ? '#1A1A1A'                   : '#FFFFFF',
    surface:     isDark ? 'rgba(255,255,255,0.06)'    : 'rgba(0,0,0,0.04)',
    text:        isDark ? '#FFFFFF'                   : '#111111',
    textMid:     isDark ? 'rgba(255,255,255,0.50)'    : '#666666',
    textFaint:   isDark ? 'rgba(255,255,255,0.30)'    : '#999999',
    divider:     isDark ? 'rgba(255,255,255,0.07)'    : '#EBEBEB',
    handle:      isDark ? 'rgba(255,255,255,0.18)'    : 'rgba(0,0,0,0.12)',
    pillActive:  isDark ? '#2C2C2E'                   : '#1C1C1E',
    energyBg:    isDark ? 'rgba(255,255,255,0.04)'    : '#F7F7F8',
    discardBg:   isDark ? 'rgba(255,255,255,0.07)'    : '#F0F0F2',
    discardText: isDark ? 'rgba(255,255,255,0.55)'    : '#555555',
    badgeBg:     isDark ? 'rgba(255,255,255,0.07)'    : 'rgba(0,0,0,0.05)',
    badgeText:   isDark ? 'rgba(255,255,255,0.45)'    : '#888888',
    penBg:       isDark ? 'rgba(255,255,255,0.07)'    : 'rgba(0,0,0,0.05)',
    penIcon:     isDark ? 'rgba(255,255,255,0.50)'    : '#888888',
    inputBorder: isDark ? 'rgba(255,255,255,0.10)'    : '#DDDDDD',
    shadow:      isDark ? '#000000'                   : '#AAAAAA',
  };
}

// ── Scan overlay ──────────────────────────────────────────────────────────────

const BRACKET_THCK = 2.5;
const BRACKET_LEN  = 28;

function ScanOverlay() {
  const translateY = useRef(new Animated.Value(0)).current;
  const LINE_H = 48;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: IMAGE_H - LINE_H, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0,                duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 24, right: 24, bottom: 0 }}>
      <View style={[cb.h, { top: 0,    left: 0  }]} />
      <View style={[cb.v, { top: 0,    left: 0  }]} />
      <View style={[cb.h, { top: 0,    right: 0 }]} />
      <View style={[cb.v, { top: 0,    right: 0 }]} />
      <View style={[cb.h, { bottom: 0, left: 0  }]} />
      <View style={[cb.v, { bottom: 0, left: 0  }]} />
      <View style={[cb.h, { bottom: 0, right: 0 }]} />
      <View style={[cb.v, { bottom: 0, right: 0 }]} />
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, height: LINE_H, transform: [{ translateY }] }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(249,115,22,0.04)' }} />
        <View style={{ flex: 0.7, backgroundColor: 'rgba(249,115,22,0.12)' }} />
        <View style={{ flex: 0.4, backgroundColor: 'rgba(249,115,22,0.28)' }} />
        <View style={{ height: 2.5, backgroundColor: O, shadowColor: O, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }} />
        <View style={{ flex: 0.4, backgroundColor: 'rgba(249,115,22,0.28)' }} />
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

// ── Pulse dot ─────────────────────────────────────────────────────────────────

function PulseDot() {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(scale,   { toValue: 1.6, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0,   duration: 700, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scale,   { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
      ]),
      Animated.delay(300),
    ]));
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: O, transform: [{ scale }], opacity }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: O }} />
    </View>
  );
}

// ── MacroBar ──────────────────────────────────────────────────────────────────

function MacroBar({ proteinG, fatG, carbsG }: { proteinG: number; fatG: number; carbsG: number }) {
  const pKcal = proteinG * 4;
  const fKcal = fatG * 9;
  const cKcal = carbsG * 4;
  const total = pKcal + fKcal + cKcal || 1;
  return (
    <View style={{ flexDirection: 'row', height: 5, borderRadius: 99, overflow: 'hidden', gap: 2, marginTop: 14, marginBottom: 16 }}>
      <View style={{ flex: pKcal / total, backgroundColor: C_PROTEIN, borderRadius: 99 }} />
      <View style={{ flex: fKcal / total, backgroundColor: C_FAT,     borderRadius: 99 }} />
      <View style={{ flex: cKcal / total, backgroundColor: C_CARBS,   borderRadius: 99 }} />
    </View>
  );
}

// ── MacroInput (edit mode) ────────────────────────────────────────────────────

function MacroInput({ label, value, color, bg, inputBorder, onChange }: {
  label: string; value: string; color: string; bg: string; inputBorder: string;
  onChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[mi.card, { backgroundColor: bg, borderTopColor: color, borderColor: focused ? color : inputBorder }]}>
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
      <Text style={[mi.unit, { color }]}>{' '}g</Text>
      <Text style={mi.label}>{label}</Text>
    </View>
  );
}

const mi = StyleSheet.create({
  card:  { flex: 1, borderRadius: 14, borderTopWidth: 2, borderWidth: 1, paddingTop: 10, paddingBottom: 8, alignItems: 'center' },
  input: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, width: '100%', textAlign: 'center', paddingVertical: 0 },
  unit:  { fontSize: 11, fontWeight: '600', opacity: 0.5, marginTop: -2 },
  label: { fontSize: 10, fontWeight: '700', color: '#888', letterSpacing: 0.5, marginTop: 3 },
});

// ── Main component ────────────────────────────────────────────────────────────

export function PhotoAnalysisModal({ visible, imageUri, base64Image, onClose, onRetry }: Props) {
  const insets                        = useSafeAreaInsets();
  const { isDark }                    = useTheme();
  const P                             = usePalette(isDark);
  const { previewPhoto, addMeal, mealGoal } = useFood();
  const toast                         = useToast();

  const [status,        setStatus]        = useState<Status>('analyzing');
  const [dots,          setDots]          = useState('');
  const [isSaving,      setIsSaving]      = useState(false);
  const [isEditing,     setIsEditing]     = useState(false);
  const [microExpanded, setMicroExpanded] = useState(false);
  const [logTime,       setLogTime]       = useState('');

  const [editName,    setEditName]    = useState('');
  const [editMeal,    setEditMeal]    = useState<MealLabel>(deriveMealLabel());
  const [editCals,    setEditCals]    = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs,   setEditCarbs]   = useState('');
  const [editFat,     setEditFat]     = useState('');

  const populate = (p: PhotoPreview) => {
    setEditName(p.name);
    setEditMeal(deriveMealLabel());
    setEditCals(String(p.cals));
    setEditProtein(String(p.protein));
    setEditCarbs(String(p.carbs));
    setEditFat(String(p.fat));
    setLogTime(formatTime());
  };

  useEffect(() => {
    if (!visible) {
      setStatus('analyzing');
      setDots('');
      setIsSaving(false);
      setIsEditing(false);
      setMicroExpanded(false);
      return;
    }
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

  const cals      = parseInt(editCals,    10) || 0;
  const protein   = parseInt(editProtein, 10) || 0;
  const fat       = parseInt(editFat,     10) || 0;
  const carbs     = parseInt(editCarbs,   10) || 0;
  const hasMacros = protein > 0 || fat > 0 || carbs > 0;
  const dailyPct  = mealGoal > 0 ? Math.round((cals / mealGoal) * 100) : 0;
  const estWeight = estimateWeight(cals);
  const { main: foodMain, sub: foodSub } = splitFoodName(editName || 'Meal');

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={status !== 'analyzing' ? onClose : undefined}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[s.root, { backgroundColor: '#000' }]}>

          {/* ── Photo ── */}
          <View style={s.imageBox}>
            <Image source={imageUri} style={s.image} contentFit="cover" cachePolicy="memory-disk" />
            <View style={s.imageDim} />
            {status === 'analyzing' && <ScanOverlay />}
            {status !== 'analyzing' && (
              <TouchableOpacity
                style={[s.closeBtn, { top: insets.top + 12 }]}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#FFF" />
              </TouchableOpacity>
            )}
            {status === 'review' && (
              <TouchableOpacity
                style={[s.retakeChip, { top: insets.top + 12 }]}
                onPress={() => { onClose(); onRetry?.(); }}
                activeOpacity={0.8}
              >
                <Ionicons name="camera-outline" size={13} color="#FFF" />
                <Text style={s.retakeChipText}>Retake</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Bottom sheet ── */}
          <View style={[s.card, { backgroundColor: P.card, paddingBottom: insets.bottom + 16, shadowColor: P.shadow }]}>
            <View style={[s.handle, { backgroundColor: P.handle }]} />

            {/* ── Analyzing ── */}
            {status === 'analyzing' && (
              <View style={s.centerContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <PulseDot />
                  <Text style={[s.analyzeTitle, { color: P.text }]}>Scanning your food{dots}</Text>
                </View>
                <Text style={[s.analyzeCaption, { color: P.textMid }]}>AI is identifying the meal</Text>
              </View>
            )}

            {/* ── Review ── */}
            {status === 'review' && !isEditing && (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.reviewContent}>

                {/* AI badge + edit pen */}
                <View style={s.headerRow}>
                  <View style={[s.aiBadge, { backgroundColor: P.badgeBg }]}>
                    <Ionicons name="sparkles" size={10} color={P.badgeText} />
                    <Text style={[s.aiBadgeText, { color: P.badgeText }]}>AI DETECTED</Text>
                    <View style={[s.aiBadgeSep, { backgroundColor: P.badgeText }]} />
                    <Text style={[s.aiBadgeText, { color: P.badgeText }]}>94%</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.penBtn, { backgroundColor: P.penBg }]}
                    onPress={() => setIsEditing(true)}
                    hitSlop={8}
                  >
                    <Ionicons name="pencil" size={14} color={P.penIcon} />
                  </TouchableOpacity>
                </View>

                {/* Food name */}
                <Text style={[s.foodMain, { color: P.text }]} numberOfLines={2}>{foodMain}</Text>
                {foodSub ? (
                  <Text style={[s.foodSub, { color: P.textMid }]} numberOfLines={1}>{foodSub}</Text>
                ) : null}

                {/* Meta: serving · weight · time */}
                <Text style={[s.metaLine, { color: P.textFaint }]}>
                  {'1 serving  ·  '}~{estWeight} g{'  ·  '}{logTime}
                </Text>

                {/* Meal type tabs */}
                <View style={[s.mealTabsWrap, { backgroundColor: P.surface }]}>
                  {MEAL_OPTIONS.map((opt) => {
                    const active = editMeal === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        style={[s.mealTab, active && [s.mealTabActive, { backgroundColor: P.pillActive }]]}
                        onPress={() => setEditMeal(opt.id)}
                      >
                        <Text style={[s.mealTabText, { color: active ? '#FFFFFF' : P.textMid }]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Energy + macros card */}
                <View style={[s.energyCard, { backgroundColor: P.energyBg }]}>
                  <Text style={[s.energyLabel, { color: P.textFaint }]}>TOTAL ENERGY</Text>

                  <View style={s.energyRow}>
                    <View style={s.energyNumWrap}>
                      <Text style={[s.energyNum, { color: P.text }]}>{cals}</Text>
                      <Text style={[s.energyUnit, { color: P.textMid }]}>kcal</Text>
                    </View>
                    {dailyPct > 0 && (
                      <View style={s.dailyRow}>
                        <View style={[s.dailyDot, { backgroundColor: O }]} />
                        <Text style={[s.dailyPctText, { color: P.textMid }]}>{dailyPct}% of daily</Text>
                      </View>
                    )}
                  </View>

                  {hasMacros && <MacroBar proteinG={protein} fatG={fat} carbsG={carbs} />}

                  {hasMacros && (
                    <View style={s.macroGrid}>
                      {protein > 0 && (
                        <View style={s.macroCol}>
                          <View style={s.macroDotRow}>
                            <View style={[s.macroDot, { backgroundColor: C_PROTEIN }]} />
                            <Text style={[s.macroName, { color: P.textMid }]}>Protein</Text>
                          </View>
                          <Text style={[s.macroGrams, { color: P.text }]}>
                            {protein}<Text style={[s.macroGUnit, { color: P.textMid }]}> g</Text>
                          </Text>
                          <Text style={[s.macroKcal, { color: P.textFaint }]}>{protein * 4} kcal</Text>
                        </View>
                      )}
                      {fat > 0 && (
                        <View style={[s.macroCol, s.macroColBordered, { borderLeftColor: P.divider }]}>
                          <View style={s.macroDotRow}>
                            <View style={[s.macroDot, { backgroundColor: C_FAT }]} />
                            <Text style={[s.macroName, { color: P.textMid }]}>Fat</Text>
                          </View>
                          <Text style={[s.macroGrams, { color: P.text }]}>
                            {fat}<Text style={[s.macroGUnit, { color: P.textMid }]}> g</Text>
                          </Text>
                          <Text style={[s.macroKcal, { color: P.textFaint }]}>{fat * 9} kcal</Text>
                        </View>
                      )}
                      {carbs > 0 && (
                        <View style={[s.macroCol, s.macroColBordered, { borderLeftColor: P.divider }]}>
                          <View style={s.macroDotRow}>
                            <View style={[s.macroDot, { backgroundColor: C_CARBS }]} />
                            <Text style={[s.macroName, { color: P.textMid }]}>Carbs</Text>
                          </View>
                          <Text style={[s.macroGrams, { color: P.text }]}>
                            {carbs}<Text style={[s.macroGUnit, { color: P.textMid }]}> g</Text>
                          </Text>
                          <Text style={[s.macroKcal, { color: P.textFaint }]}>{carbs * 4} kcal</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Micronutrients accordion */}
                <TouchableOpacity
                  style={[s.microRow, { borderTopColor: P.divider, borderBottomColor: microExpanded ? 'transparent' : P.divider }]}
                  onPress={() => setMicroExpanded(!microExpanded)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.microText, { color: P.textMid }]}>See micronutrients</Text>
                  <Ionicons name={microExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={P.textFaint} />
                </TouchableOpacity>
                {microExpanded && (
                  <View style={[s.microContent, { borderBottomColor: P.divider }]}>
                    <Text style={[s.microEmpty, { color: P.textFaint }]}>Micronutrient data coming soon.</Text>
                  </View>
                )}

                {/* Actions */}
                <View style={s.actionRow}>
                  <TouchableOpacity
                    style={[s.discardBtn, { backgroundColor: P.discardBg }]}
                    onPress={onClose}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.discardBtnText, { color: P.discardText }]}>Discard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.logBtn, isSaving && { opacity: 0.6 }]}
                    onPress={handleAddToLog}
                    activeOpacity={0.85}
                    disabled={isSaving}
                  >
                    <Text style={s.logBtnText}>{isSaving ? 'Saving…' : 'Add to log'}</Text>
                    {!isSaving && <Ionicons name="arrow-forward" size={16} color="#FFF" />}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {/* ── Edit mode ── */}
            {status === 'review' && isEditing && (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.reviewContent}>
                <View style={s.editHeader}>
                  <Text style={[s.editTitle, { color: P.text }]}>Edit details</Text>
                  <TouchableOpacity style={s.doneBtn} onPress={() => setIsEditing(false)}>
                    <Text style={s.doneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.fieldBlock}>
                  <Text style={[s.fieldLabel, { color: P.textFaint }]}>FOOD NAME</Text>
                  <TextInput
                    style={[s.nameInput, { color: P.text, borderBottomColor: P.inputBorder }]}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Meal name"
                    placeholderTextColor={P.textFaint}
                    selectionColor={O}
                    returnKeyType="done"
                    maxLength={80}
                  />
                </View>

                <View style={[s.divider, { backgroundColor: P.divider }]} />

                <View style={s.fieldBlock}>
                  <Text style={[s.fieldLabel, { color: P.textFaint }]}>CALORIES</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <TextInput
                      style={[s.calsInput, { color: P.text }]}
                      value={editCals}
                      onChangeText={(v) => setEditCals(v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      selectionColor={O}
                      returnKeyType="done"
                      maxLength={5}
                    />
                    <Text style={[s.calsUnit, { color: P.textFaint }]}>kcal</Text>
                  </View>
                </View>

                <View style={[s.divider, { backgroundColor: P.divider }]} />

                <View style={s.fieldBlock}>
                  <Text style={[s.fieldLabel, { color: P.textFaint }]}>NUTRITION</Text>
                  <View style={s.macroInputGrid}>
                    <MacroInput label="Protein" value={editProtein} color={C_PROTEIN} bg="rgba(34,197,94,0.08)"  inputBorder={P.inputBorder} onChange={setEditProtein} />
                    <MacroInput label="Fat"     value={editFat}     color={C_FAT}     bg="rgba(168,85,247,0.08)" inputBorder={P.inputBorder} onChange={setEditFat}     />
                    <MacroInput label="Carbs"   value={editCarbs}   color={C_CARBS}   bg="rgba(234,179,8,0.08)"  inputBorder={P.inputBorder} onChange={setEditCarbs}   />
                  </View>
                </View>

                <View style={[s.divider, { backgroundColor: P.divider }]} />

                <View style={s.actionRow}>
                  <TouchableOpacity
                    style={[s.discardBtn, { backgroundColor: P.discardBg }]}
                    onPress={onClose}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.discardBtnText, { color: P.discardText }]}>Discard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.logBtn, isSaving && { opacity: 0.6 }]}
                    onPress={handleAddToLog}
                    activeOpacity={0.85}
                    disabled={isSaving}
                  >
                    <Text style={s.logBtnText}>{isSaving ? 'Saving…' : 'Add to log'}</Text>
                    {!isSaving && <Ionicons name="arrow-forward" size={16} color="#FFF" />}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {/* ── Retry ── */}
            {status === 'retry' && (
              <View style={s.centerContent}>
                <View style={[s.statusIcon, { backgroundColor: O10 }]}>
                  <Ionicons name="camera-outline" size={28} color={O} />
                </View>
                <Text style={[s.analyzeTitle, { color: P.text }]}>No food detected</Text>
                <Text style={[s.analyzeCaption, { color: P.textMid }]}>
                  Make sure food is clearly visible in the frame and try again.
                </Text>
                <View style={[s.actionRow, { alignSelf: 'stretch' }]}>
                  <TouchableOpacity style={[s.discardBtn, { backgroundColor: P.discardBg }]} onPress={onClose} activeOpacity={0.75}>
                    <Text style={[s.discardBtnText, { color: P.discardText }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.logBtn} onPress={() => { onClose(); onRetry?.(); }} activeOpacity={0.85}>
                    <Ionicons name="camera" size={16} color="#FFF" />
                    <Text style={s.logBtnText}>Retake Photo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Error ── */}
            {status === 'error' && (
              <View style={s.centerContent}>
                <View style={[s.statusIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                  <Ionicons name="alert-circle-outline" size={28} color="#EF4444" />
                </View>
                <Text style={[s.analyzeTitle, { color: P.text }]}>Could not identify food</Text>
                <Text style={[s.analyzeCaption, { color: P.textMid }]}>
                  Try a clearer photo or add the meal manually.
                </Text>
                <TouchableOpacity
                  style={[s.logBtn, { backgroundColor: '#374151', alignSelf: 'stretch' }]}
                  onPress={onClose}
                  activeOpacity={0.85}
                >
                  <Text style={s.logBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:     { flex: 1 },
  imageBox: { height: IMAGE_H, width: SW, overflow: 'hidden', backgroundColor: '#000' },
  image:    { width: SW, height: IMAGE_H },
  imageDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },

  closeBtn: {
    position: 'absolute', left: 20,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  retakeChip: {
    position: 'absolute', right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  retakeChipText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  card: {
    flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 10, marginTop: -24,
    shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.10, shadowRadius: 18, elevation: 20,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 8 },

  reviewContent: { paddingHorizontal: 20, paddingBottom: 8 },

  // Header
  headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  aiBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  aiBadgeSep:  { width: 3, height: 3, borderRadius: 1.5, opacity: 0.6 },
  aiBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  penBtn:      { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  // Food name
  foodMain: { fontFamily: 'Syne_700Bold', fontSize: 28, fontWeight: '800', letterSpacing: -0.7, lineHeight: 34, marginBottom: 2 },
  foodSub:  { fontSize: 16, fontWeight: '500', letterSpacing: -0.2, marginBottom: 4 },
  metaLine: { fontSize: 12, fontWeight: '500', marginBottom: 14 },

  // Meal tabs (segment control)
  mealTabsWrap: { flexDirection: 'row', borderRadius: 12, padding: 3, marginBottom: 16 },
  mealTab:      { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  mealTabActive: {
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  mealTabText: { fontSize: 12, fontWeight: '600' },

  // Energy + macro card
  energyCard:    { borderRadius: 16, padding: 16, marginBottom: 4 },
  energyLabel:   { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  energyRow:     { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  energyNumWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  energyNum:     { fontSize: 52, fontWeight: '800', letterSpacing: -2.5, lineHeight: 56 },
  energyUnit:    { fontSize: 17, fontWeight: '600', marginBottom: 5 },
  dailyRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  dailyDot:      { width: 7, height: 7, borderRadius: 3.5 },
  dailyPctText:  { fontSize: 13, fontWeight: '600' },

  // Macro columns
  macroGrid:       { flexDirection: 'row' },
  macroCol:        { flex: 1, paddingVertical: 4, paddingHorizontal: 10 },
  macroColBordered: { borderLeftWidth: 1 },
  macroDotRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  macroDot:        { width: 7, height: 7, borderRadius: 3.5 },
  macroName:       { fontSize: 11, fontWeight: '500' },
  macroGrams:      { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  macroGUnit:      { fontSize: 13, fontWeight: '500' },
  macroKcal:       { fontSize: 11, fontWeight: '500', marginTop: 1 },

  // Micronutrients
  microRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, marginBottom: 12 },
  microText:    { fontSize: 14, fontWeight: '600' },
  microContent: { paddingBottom: 12, borderBottomWidth: 1, marginBottom: 4, marginTop: -12 },
  microEmpty:   { fontSize: 12, fontWeight: '500', textAlign: 'center', paddingVertical: 8 },

  // Actions
  actionRow:      { flexDirection: 'row', gap: 10, paddingTop: 4, paddingBottom: 4 },
  discardBtn:     { flex: 1, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  discardBtnText: { fontSize: 15, fontWeight: '700' },
  logBtn: {
    flex: 2, height: 54, borderRadius: 16, backgroundColor: O,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    shadowColor: O, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  logBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  // Edit mode
  editHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 16 },
  editTitle:    { fontFamily: 'Syne_700Bold', fontSize: 17, fontWeight: '800' },
  doneBtn:      { backgroundColor: O20, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  doneBtnText:  { color: O, fontSize: 13, fontWeight: '700' },
  fieldBlock:   { gap: 8 },
  fieldLabel:   { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  nameInput:    { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, paddingVertical: 4, borderBottomWidth: 1 },
  calsInput:    { fontSize: 42, fontWeight: '800', letterSpacing: -1.5, paddingVertical: 0, minWidth: 80 },
  calsUnit:     { fontSize: 16, fontWeight: '600' },
  macroInputGrid: { flexDirection: 'row', gap: 8 },
  divider:      { height: 1, marginVertical: 12 },

  // States
  centerContent:  { alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, gap: 12 },
  analyzeTitle:   { fontFamily: 'Syne_700Bold', fontSize: 18, fontWeight: '700' },
  analyzeCaption: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  statusIcon:     { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
