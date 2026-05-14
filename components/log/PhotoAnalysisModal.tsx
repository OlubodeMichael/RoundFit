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
const IMAGE_H = Math.round(SH * 0.42);

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

// ── Theme palette ─────────────────────────────────────────────────────────────

function usePalette(isDark: boolean) {
  return {
    bg:             isDark ? '#111111'                   : '#F5F5F7',
    card:           isDark ? '#1A1A1A'                   : '#FFFFFF',
    surface:        isDark ? 'rgba(255,255,255,0.05)'    : 'rgba(0,0,0,0.04)',
    surfaceBorder:  isDark ? 'rgba(255,255,255,0.07)'    : 'rgba(0,0,0,0.08)',
    text:           isDark ? '#FFFFFF'                   : '#111111',
    textMid:        isDark ? 'rgba(255,255,255,0.50)'    : '#666666',
    textFaint:      isDark ? 'rgba(255,255,255,0.35)'    : '#999999',
    divider:        isDark ? 'rgba(255,255,255,0.07)'    : '#EEEEEE',
    iconBg:         isDark ? 'rgba(255,255,255,0.07)'    : 'rgba(0,0,0,0.05)',
    pillBg:         isDark ? 'rgba(255,255,255,0.07)'    : 'rgba(0,0,0,0.06)',
    handle:         isDark ? 'rgba(255,255,255,0.18)'    : 'rgba(0,0,0,0.12)',
    discardBg:      isDark ? 'rgba(255,255,255,0.07)'    : 'rgba(0,0,0,0.05)',
    discardBorder:  isDark ? 'rgba(255,255,255,0.10)'    : 'rgba(0,0,0,0.10)',
    discardText:    isDark ? 'rgba(255,255,255,0.55)'    : '#555555',
    inputBorder:    isDark ? 'rgba(255,255,255,0.10)'    : '#DDDDDD',
    badgeBg:        isDark ? 'rgba(255,255,255,0.06)'    : 'rgba(0,0,0,0.05)',
    badgeText:      isDark ? 'rgba(255,255,255,0.40)'    : '#888888',
    penBg:          isDark ? 'rgba(255,255,255,0.07)'    : 'rgba(0,0,0,0.06)',
    penBorder:      isDark ? 'rgba(255,255,255,0.08)'    : 'rgba(0,0,0,0.09)',
    penIcon:        isDark ? 'rgba(255,255,255,0.55)'    : '#888888',
    shadow:         isDark ? '#000000'                   : '#AAAAAA',
  };
}

// ── Scan overlay (always dark — over photo) ───────────────────────────────────

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
  }, []);
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: O, transform: [{ scale }], opacity }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: O }} />
    </View>
  );
}

// ── Nutrient row ──────────────────────────────────────────────────────────────

const MACRO_META: Record<string, { emoji: string; kcalPer: number }> = {
  Protein: { emoji: '🥩', kcalPer: 4 },
  Carbs:   { emoji: '🌾', kcalPer: 4 },
  Fat:     { emoji: '🫙', kcalPer: 9 },
};

function NutrientRow({ name, grams, iconBg, text, textMid, divider }: {
  name: string; grams: string;
  iconBg: string; text: string; textMid: string; divider: string;
}) {
  const meta = MACRO_META[name];
  const g    = parseInt(grams, 10) || 0;
  const kcal = Math.round(g * meta.kcalPer);
  return (
    <View style={nr.row}>
      <View style={[nr.iconWrap, { backgroundColor: iconBg }]}>
        <Text style={nr.emoji}>{meta.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[nr.name, { color: text }]}>{name}</Text>
        <Text style={[nr.grams, { color: textMid }]}>{g}g</Text>
      </View>
      <Text style={[nr.kcal, { color: textMid }]}>{kcal} kcal</Text>
    </View>
  );
}

const nr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emoji:    { fontSize: 20 },
  name:     { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  grams:    { fontSize: 12, fontWeight: '500', marginTop: 1 },
  kcal:     { fontSize: 13, fontWeight: '600' },
});

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
      <Text style={[mi.unit, { color }]}>{' '}g</Text>
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
  const insets              = useSafeAreaInsets();
  const { isDark }          = useTheme();
  const P                   = usePalette(isDark);
  const { previewPhoto, addMeal } = useFood();
  const toast               = useToast();

  const [status,    setStatus]    = useState<Status>('analyzing');
  const [dots,      setDots]      = useState('');
  const [isSaving,  setIsSaving]  = useState(false);
  const [isEditing, setIsEditing] = useState(false);

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
  };

  useEffect(() => {
    if (!visible) {
      setStatus('analyzing');
      setDots('');
      setIsSaving(false);
      setIsEditing(false);
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

  const hasProtein = parseInt(editProtein) > 0;
  const hasFat     = parseInt(editFat)     > 0;
  const hasCarbs   = parseInt(editCarbs)   > 0;
  const nutriCount = [hasProtein, hasFat, hasCarbs].filter(Boolean).length;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={status !== 'analyzing' ? onClose : undefined}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[s.root, { backgroundColor: P.bg }]}>

          {/* ── Image box (always dark — it's a photo) ── */}
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
            {/* Retake pill — visible once food is identified */}
            {status === 'review' && (
              <TouchableOpacity
                style={s.retakeChip}
                onPress={() => { onClose(); onRetry?.(); }}
                activeOpacity={0.8}
              >
                <Ionicons name="camera-outline" size={13} color="#FFF" />
                <Text style={s.retakeChipText}>Retake</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Card ── */}
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

            {/* ── Review (display) ── */}
            {status === 'review' && !isEditing && (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.reviewContent}>

                {/* Food name + pen */}
                <View style={s.nameRow}>
                  <View style={{ flex: 1 }}>
                    <View style={s.successBadge}>
                      <Ionicons name="checkmark-circle" size={12} color="#22C55E" />
                      <Text style={s.successText}>AI identified your meal</Text>
                    </View>
                    <Text style={[s.foodName, { color: P.text }]} numberOfLines={2}>{editName || 'Meal'}</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.penBtn, { backgroundColor: P.penBg, borderColor: P.penBorder }]}
                    onPress={() => setIsEditing(true)}
                    hitSlop={8}
                  >
                    <Ionicons name="pencil" size={15} color={P.penIcon} />
                  </TouchableOpacity>
                </View>

                {/* Meal pills */}
                <View style={s.mealRow}>
                  {MEAL_OPTIONS.map((opt) => {
                    const active = editMeal === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        style={[s.mealPill, { backgroundColor: active ? O20 : P.pillBg }, active && s.mealPillActive]}
                        onPress={() => setEditMeal(opt.id)}
                      >
                        <Text style={[s.mealPillText, { color: active ? O : P.textMid }]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Nutrition card */}
                <View style={[s.nutriCard, { backgroundColor: P.surface, borderColor: P.surfaceBorder }]}>
                  <View style={s.nutriHeader}>
                    <View>
                      <Text style={[s.nutriTitle, { color: P.text }]}>Total nutrition</Text>
                      <Text style={[s.nutriCals,  { color: P.textMid }]}>{editCals} kcal</Text>
                    </View>
                    {nutriCount > 0 && (
                      <View style={[s.nutriBadge, { backgroundColor: P.badgeBg }]}>
                        <Ionicons name="restaurant-outline" size={11} color={P.badgeText} />
                        <Text style={[s.nutriBadgeText, { color: P.badgeText }]}>{nutriCount} nutrients</Text>
                      </View>
                    )}
                  </View>

                  {nutriCount > 0 && <View style={[s.nutriDivider, { backgroundColor: P.divider }]} />}

                  {hasProtein && (
                    <>
                      <NutrientRow name="Protein" grams={editProtein} iconBg={P.iconBg} text={P.text} textMid={P.textMid} divider={P.divider} />
                      {(hasFat || hasCarbs) && <View style={[s.nutriDivider, { backgroundColor: P.divider }]} />}
                    </>
                  )}
                  {hasFat && (
                    <>
                      <NutrientRow name="Fat" grams={editFat} iconBg={P.iconBg} text={P.text} textMid={P.textMid} divider={P.divider} />
                      {hasCarbs && <View style={[s.nutriDivider, { backgroundColor: P.divider }]} />}
                    </>
                  )}
                  {hasCarbs && (
                    <NutrientRow name="Carbs" grams={editCarbs} iconBg={P.iconBg} text={P.text} textMid={P.textMid} divider={P.divider} />
                  )}
                </View>

                {/* Actions */}
                <View style={s.actionRow}>
                  <TouchableOpacity style={[s.discardBtn, { backgroundColor: P.discardBg, borderColor: P.discardBorder }]} onPress={onClose} activeOpacity={0.75}>
                    <Text style={[s.discardBtnText, { color: P.discardText }]}>Discard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.logBtn, isSaving && { opacity: 0.6 }]} onPress={handleAddToLog} activeOpacity={0.85} disabled={isSaving}>
                    <Text style={s.logBtnText}>{isSaving ? 'Saving…' : 'Add to Log'}</Text>
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
                  <View style={s.macroGrid}>
                    <MacroInput label="Protein" value={editProtein} color="#F97316" bg={O10}                    inputBorder={P.inputBorder} onChange={setEditProtein} />
                    <MacroInput label="Carbs"   value={editCarbs}   color="#FB923C" bg="rgba(251,146,60,0.10)"  inputBorder={P.inputBorder} onChange={setEditCarbs}   />
                    <MacroInput label="Fat"     value={editFat}     color="#FDBA74" bg="rgba(253,186,116,0.10)" inputBorder={P.inputBorder} onChange={setEditFat}     />
                  </View>
                </View>

                <View style={[s.divider, { backgroundColor: P.divider }]} />

                <View style={s.actionRow}>
                  <TouchableOpacity style={[s.discardBtn, { backgroundColor: P.discardBg, borderColor: P.discardBorder }]} onPress={onClose} activeOpacity={0.75}>
                    <Text style={[s.discardBtnText, { color: P.discardText }]}>Discard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.logBtn, isSaving && { opacity: 0.6 }]} onPress={handleAddToLog} activeOpacity={0.85} disabled={isSaving}>
                    <Text style={s.logBtnText}>{isSaving ? 'Saving…' : 'Add to Log'}</Text>
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
                  <TouchableOpacity style={[s.discardBtn, { backgroundColor: P.discardBg, borderColor: P.discardBorder }]} onPress={onClose} activeOpacity={0.75}>
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
                <TouchableOpacity style={[s.logBtn, { backgroundColor: '#374151', alignSelf: 'stretch' }]} onPress={onClose} activeOpacity={0.85}>
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

// ── Static styles (layout only — colours applied inline) ─────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  imageBox: { height: IMAGE_H, width: SW, overflow: 'hidden', backgroundColor: '#000' },
  image:    { width: SW, height: IMAGE_H },
  imageDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.12)' },
  closeBtn: {
    position: 'absolute', left: 20,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  retakeChip: {
    position: 'absolute', bottom: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  retakeChipText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  card: {
    flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 10, marginTop: -20,
    shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 4 },

  reviewContent: { paddingHorizontal: 20, paddingBottom: 8 },

  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 8, paddingBottom: 14 },
  successBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 4, backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, marginBottom: 6,
  },
  successText: { color: '#22C55E', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  foodName:    { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, lineHeight: 28 },
  penBtn:      { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24, borderWidth: 1 },

  mealRow:        { flexDirection: 'row', gap: 8, marginBottom: 16 },
  mealPill:       { flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center' },
  mealPillActive: { borderWidth: 1, borderColor: O },
  mealPillText:   { fontSize: 12, fontWeight: '600' },

  nutriCard:      { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16 },
  nutriHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nutriTitle:     { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  nutriCals:      { fontSize: 12, fontWeight: '500', marginTop: 2 },
  nutriBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  nutriBadgeText: { fontSize: 11, fontWeight: '600' },
  nutriDivider:   { height: 1, marginVertical: 2 },

  editHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 16 },
  editTitle:   { fontSize: 17, fontWeight: '800' },
  doneBtn:     { backgroundColor: O20, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  doneBtnText: { color: O, fontSize: 13, fontWeight: '700' },

  fieldBlock: { gap: 8 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  nameInput:  { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, paddingVertical: 4, borderBottomWidth: 1 },
  calsInput:  { fontSize: 42, fontWeight: '800', letterSpacing: -1.5, paddingVertical: 0, minWidth: 80 },
  calsUnit:   { fontSize: 16, fontWeight: '600' },
  macroGrid:  { flexDirection: 'row', gap: 8 },
  divider:    { height: 1, marginVertical: 12 },

  centerContent: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, gap: 12 },
  analyzeTitle:  { fontSize: 18, fontWeight: '700' },
  analyzeCaption: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  statusIcon:    { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },

  actionRow:      { flexDirection: 'row', gap: 10, paddingTop: 4, paddingBottom: 4 },
  discardBtn:     { flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  discardBtnText: { fontSize: 15, fontWeight: '700' },
  logBtn: {
    flex: 2, height: 52, borderRadius: 14, backgroundColor: O,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    shadowColor: O, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  logBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
