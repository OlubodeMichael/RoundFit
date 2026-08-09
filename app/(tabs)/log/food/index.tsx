import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { requireOptionalNativeModule } from 'expo-modules-core';

import { useRouter } from 'expo-router';
import { useFood, type BarcodePreview, type MealItem } from '@/hooks/use-food';
import { BarcodeScanPreview } from '@/components/log/BarcodeScanPreview';
import { AppModal } from '@/components/ui/AppModal';
import { ManualMealInputModal, type MealLabel, type ManualMealInput } from '@/components/log/ManualMealInputModal';
import { PhotoAnalysisModal } from '@/components/log/PhotoAnalysisModal';
import { Image } from 'expo-image';
import { persistCameraPhoto, prunePhotoCache } from '@/utils/photo-cache';
import { useToast } from '@/components/ui/Toast';
import { FoodLogActionsRow } from '@/components/log/food/FoodLogActionsRow';
import { FoodLogCaloriesCard } from '@/components/log/food/FoodLogCaloriesCard';
import { DayNavigator, usePalette, type Palette } from '@/lib/log-theme';
import {
  MEAL_ROW_GAP,
  MEAL_ROW_MIN_HEIGHT,
  MEAL_ROW_PADDING_LEFT,
  MEAL_ROW_PADDING_RIGHT,
  mealLogThumbStyles,
  mealRowDividerInset,
} from '@/lib/meal-log-row';

type CameraMode = 'photo' | 'scan';
type CameraRefLike = {
  takePictureAsync: (opts?: { quality?: number; skipProcessing?: boolean; base64?: boolean }) => Promise<{ uri?: string; base64?: string }>;
};
type BarcodeResult = { type: string; data: string };
type PendingBarcode = { code: string; preview: BarcodePreview };

const EXPO_CAMERA_NATIVE = 'ExpoCamera';
const FOOD_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128', 'code39'];

// ───────────────────────────────────────────────────────────────────────────────
// Meal grouping + theming
// ───────────────────────────────────────────────────────────────────────────────
type GroupKey = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';

const GROUP_ORDER: GroupKey[] = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];

// Ionicons rather than emoji: emoji glyph coverage varies by platform and OS
// version, and where it's missing these render as tofu (?) boxes. The icon font
// ships with the app, so it draws identically everywhere — and matches the
// Ionicons used throughout the rest of the screen.
const GROUP_META: Record<
  GroupKey,
  { title: string; icon: ComponentProps<typeof Ionicons>['name']; accent: keyof Palette }
> = {
  breakfast: { title: 'Breakfast', icon: 'cafe',       accent: 'carbs'    },
  lunch:     { title: 'Lunch',     icon: 'fast-food',  accent: 'protein'  },
  dinner:    { title: 'Dinner',    icon: 'restaurant', accent: 'fat'      },
  snack:     { title: 'Snack',     icon: 'nutrition',  accent: 'water'    },
  other:     { title: 'Other',     icon: 'pizza',      accent: 'calories' },
};

function groupFor(label: string): GroupKey {
  const k = label.trim().toLowerCase().replace(/\s+/g, '_');
  if (k.startsWith('break'))                 return 'breakfast';
  if (k.startsWith('lunch'))                 return 'lunch';
  if (k.startsWith('dinner'))                return 'dinner';
  if (k.startsWith('snack'))                 return 'snack';
  return 'other';
}

// ───────────────────────────────────────────────────────────────────────────────
// Camera helpers (unchanged from the original — keep the flow intact)
// ───────────────────────────────────────────────────────────────────────────────
let _camMod: any = null;
function getCamMod() {
  if (_camMod) return _camMod;
  if (!requireOptionalNativeModule(EXPO_CAMERA_NATIVE)) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('expo-camera');
    if (m?.CameraView && m?.Camera?.requestCameraPermissionsAsync) _camMod = m;
  } catch { /* not ready yet */ }
  return _camMod;
}

async function ensureCameraPermission(): Promise<boolean> {
  const m = getCamMod();
  if (!m) {
    Alert.alert('Rebuild required', 'Run npx expo run:ios and relaunch.');
    return false;
  }
  const existing = await m.Camera.getCameraPermissionsAsync();
  if (existing.granted) return true;
  const result = await m.Camera.requestCameraPermissionsAsync();
  if (!result.granted) {
    Alert.alert('Camera access needed', 'Allow camera access in Settings.');
    return false;
  }
  return true;
}

// ───────────────────────────────────────────────────────────────────────────────
// Screen
// ───────────────────────────────────────────────────────────────────────────────
function localCalendarFromDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function offsetDate(base: string, days: number): string {
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localCalendarFromDate(d);
}

function formatNavDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const today = localCalendarFromDate(new Date());
  if (iso === today) return 'Today';
  const yesterday = offsetDate(today, -1);
  if (iso === yesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function FoodLogScreen() {
  const P       = usePalette();
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const {
    meals: todayMeals,
    mealGoal,
    addMeal,
    previewBarcode,
    logBarcode,
    deleteMeal,
    refreshLogs,
    fetchForDate,
  } = useFood();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const today = localCalendarFromDate(new Date());
  const [viewDate, setViewDate] = useState(today);
  const [pastMeals, setPastMeals] = useState<MealItem[]>([]);

  const isToday = viewDate === today;
  const meals = isToday ? todayMeals : pastMeals;

  const totalCalories = useMemo(
    () => meals.reduce((sum, m) => sum + m.cals, 0),
    [meals],
  );
  const remaining = mealGoal - totalCalories;

  const loadViewDate = useCallback(async (date: string, force = false) => {
    if (date === today) {
      await refreshLogs();
      return;
    }
    const rows = await fetchForDate(date, force);
    setPastMeals(rows);
  }, [today, refreshLogs, fetchForDate]);

  useEffect(() => {
    setViewDate((prev) => (prev > today ? today : prev));
  }, [today]);

  const navigateDate = async (direction: -1 | 1) => {
    const next = offsetDate(viewDate, direction);
    if (next > today) return;
    setViewDate(next);
    try {
      await loadViewDate(next);
    } catch {
      toast.error('Could not load day', 'Please try again.');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadViewDate(viewDate, true);
    } catch {
      toast.error('Could not refresh', 'Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // ── Edit serving ────────────────────────────────────────────────────────
  const [editItem,    setEditItem]    = useState<MealItem | null>(null);
  const [editVisible, setEditVisible] = useState(false);

  const openEdit = (item: MealItem) => {
    setEditItem(item);
    setEditVisible(true);
  };
  const closeEdit = () => {
    setEditItem(null);
    setEditVisible(false);
  };

  const handleEditSubmit = async (entry: ManualMealInput) => {
    if (!editItem) return;
    try {
      // Delete the old entry then re-add with the new values
      await deleteMeal(editItem.id);
      await addMeal(entry);
      toast.success('Meal updated', entry.name);
    } catch {
      toast.error('Could not update meal', 'Please try again.');
    }
  };

  // ── Camera / modal state (preserved from original) ────────────────────────
  const cameraRef    = useRef<CameraRefLike | null>(null);
  const scanLock     = useRef(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const scanLoopRef  = useRef<Animated.CompositeAnimation | null>(null);

  const [cameraMode, setCameraMode]       = useState<CameraMode | null>(null);
  const [scanned, setScanned]             = useState<BarcodeResult | null>(null);
  const [CameraView, setCameraView]       = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [manualVisible, setManualVisible] = useState(false);
  const [manualPreset, setManualPreset]   = useState<MealLabel | undefined>(undefined);
  const [pendingPhoto, setPendingPhoto]   = useState<{ uri: string; base64: string } | null>(null);
  const [barcodeAdding, setBarcodeAdding] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<PendingBarcode | null>(null);
  const [scanLookupLoading, setScanLookupLoading] = useState(false);
  const [scanLookupError, setScanLookupError] = useState<string | null>(null);
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');

  useEffect(() => {
    if (cameraMode) {
      const m = getCamMod();
      if (m?.CameraView) setCameraView(() => m.CameraView);
    }
  }, [cameraMode]);

  // ── Camera card entrance ──────────────────────────────────────────────────
  // The card slides up over the log while the backdrop fades, so the meal list
  // stays visible behind it — the camera reads as something layered onto this
  // screen rather than a separate destination.
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(cardAnim, {
      toValue:         cameraMode ? 1 : 0,
      duration:        cameraMode ? 280 : 200,
      easing:          cameraMode ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [cameraMode, cardAnim]);

  const cardTranslateY = cardAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [CAMERA_CARD_HEIGHT + 40, 0],
  });

  // ── Grouped meals ─────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const buckets: Record<GroupKey, MealItem[]> = {
      breakfast: [], lunch: [], dinner: [], snack: [], other: [],
    };
    meals.forEach((m) => buckets[groupFor(m.meal)].push(m));
    return buckets;
  }, [meals]);

  const eatenPct = Math.min(totalCalories / Math.max(mealGoal, 1), 1);

  // ── Camera handlers ───────────────────────────────────────────────────────
  function startScanLine() {
    scanLoopRef.current?.stop();
    scanLineAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]),
    );
    scanLoopRef.current = loop;
    loop.start();
  }
  function stopScanLine() {
    scanLoopRef.current?.stop();
    scanLoopRef.current = null;
  }

  const openManual = (preset?: MealLabel) => {
    setManualPreset(preset);
    setManualVisible(true);
  };
  const closeManual = () => {
    setManualVisible(false);
    setManualPreset(undefined);
  };

  const handleManualSubmit = async (entry: Parameters<typeof addMeal>[0]) => {
    try {
      await addMeal(entry);
      toast.success('Food logged', entry.name);
    } catch {
      toast.error('Could not log meal', 'Please try again.');
    }
  };

  const handleDeleteMeal = async (id: string) => {
    const item = meals.find((m) => m.id === id);
    try {
      await deleteMeal(id);
      if (!isToday) {
        setPastMeals((prev) => prev.filter((m) => m.id !== id));
      }
      toast.success('Meal removed', item?.name);
    } catch {
      toast.error('Could not delete meal', 'Please try again.');
    }
  };

  const openPhoto = async () => {
    const ok = await ensureCameraPermission();
    if (!ok) return;
    setCameraMode('photo');
  };
  const openScan = async () => {
    const ok = await ensureCameraPermission();
    if (!ok) return;
    setPendingBarcode(null);
    scanLock.current = false;
    setScanned(null);
    setScanLookupError(null);
    setScanLookupLoading(false);
    setCameraMode('scan');
    setTimeout(startScanLine, 300);
  };
  const onBarcodeScanned = (result: BarcodeResult) => {
    if (scanLock.current) return;
    scanLock.current = true;
    stopScanLine();
    setScanned(result);
  };
  const resetScan = () => {
    scanLock.current = false;
    setScanned(null);
    setScanLookupError(null);
    setScanLookupLoading(false);
    startScanLine();
  };

  useEffect(() => {
    if (!scanned || cameraMode !== 'scan') return;

    let cancelled = false;
    setScanLookupError(null);
    setScanLookupLoading(true);

    void previewBarcode(scanned.data)
      .then((preview) => {
        if (cancelled) return;
        setScanLookupLoading(false);
        if (!preview) {
          setScanLookupError('Product not found in database.');
          return;
        }
        setPendingBarcode({ code: scanned.data, preview });
        stopScanLine();
        setScanned(null);
        scanLock.current = false;
        setCameraMode(null);
        setFlash('off');
      })
      .catch(() => {
        if (cancelled) return;
        setScanLookupLoading(false);
        setScanLookupError('Could not look up this product.');
      });

    return () => { cancelled = true; };
  }, [scanned, cameraMode, previewBarcode]);
  const capturePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8, skipProcessing: true, base64: true });
      if (!photo?.uri || !photo?.base64) return;
      const persistedUri = persistCameraPhoto(photo.uri);
      prunePhotoCache();
      setCameraMode(null);
      setPendingPhoto({ uri: persistedUri, base64: photo.base64 });
    } catch {
      toast.error('Capture failed', 'Could not take a photo.');
    }
  };
  const closeCamera = () => {
    stopScanLine();
    setScanned(null);
    setScanLookupError(null);
    setScanLookupLoading(false);
    scanLock.current = false;
    setCameraMode(null);
    setFlash('off');
  };

  const switchCameraMode = (newMode: CameraMode) => {
    if (newMode === cameraMode) return;
    setFlash('off');
    if (newMode === 'scan') {
      scanLock.current = false;
      setScanned(null);
      setScanLookupError(null);
      setScanLookupLoading(false);
      setCameraMode('scan');
      setTimeout(startScanLine, 300);
    } else {
      stopScanLine();
      scanLock.current = false;
      setScanned(null);
      setScanLookupError(null);
      setScanLookupLoading(false);
      setCameraMode('photo');
    }
  };

  const closeBarcodeConfirm = () => {
    setPendingBarcode(null);
  };

  const handleBarcodeAdd = async () => {
    if (!pendingBarcode) return;
    setBarcodeAdding(true);
    try {
      await logBarcode(pendingBarcode.code);
      setPendingBarcode(null);
      toast.success('Food logged', pendingBarcode.preview.name);
    } catch {
      toast.error('Lookup failed', 'Could not add this product.');
    } finally {
      setBarcodeAdding(false);
    }
  };

  const handleBarcodeScanAgain = () => {
    setPendingBarcode(null);
    void openScan();
  };
  const cycleFlash = () => setFlash((f) => f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off');
  const scanLineY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 220] });

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop:    insets.top + 12,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={P.text}
            colors={[P.calories]}
            progressBackgroundColor={P.card}
          />
        }
      >
        {/* ── HEADER ───────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={10}
            style={[styles.backBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={P.text} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.eyebrow, { color: P.textFaint, marginBottom: 10 }]}>
              FOOD LOG
            </Text>
            {/* Date pill navigator */}
            <DayNavigator
              label={formatNavDate(viewDate)}
              isToday={isToday}
              onPrev={() => navigateDate(-1)}
              onNext={() => navigateDate(1)}
              accentColor={P.calories}
            />
          </View>

          {/* Spacer to balance the back button */}
          <View style={{ width: 40 }} />
        </View>

        {/* ── SUMMARY + QUICK ACTIONS ──────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 18, gap: 16, marginBottom: 8 }}>
          <FoodLogCaloriesCard
            remaining={remaining}
            totalCalories={totalCalories}
            mealGoal={mealGoal}
            eatenPct={eatenPct}
            isToday={isToday}
          />
          <FoodLogActionsRow
            onPhoto={openPhoto}
            onManual={() => openManual()}
            onSearch={() => router.push('/(tabs)/log/food/search')}
          />
        </View>

        {/* ── MEAL GROUPS ──────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, gap: 14, marginTop: 24 }}>
          {GROUP_ORDER.map((key, idx) => {
            const items = grouped[key];
            if (key === 'other' && items.length === 0) return null;
            return (
              <MealGroup
                key={key}
                groupKey={key}
                items={items}
                P={P}
                delay={340 + idx * 70}
                onDelete={handleDeleteMeal}
                onAdd={(preset) => openManual(preset)}
                onEdit={openEdit}
              />
            );
          })}

          {meals.length === 0 && <EmptyState P={P} onAdd={() => openManual()} />}
        </View>
      </ScrollView>

      {/* ── CAMERA CARD ──────────────────────────────────────────
          Presented as a rounded card layered over the log rather than a
          fullscreen takeover: the meal list stays visible above it, so
          capturing reads as "add to this screen", and dismissing returns
          you exactly where you were. Capture behaviour is unchanged. */}
      <Modal
        visible={cameraMode !== null}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeCamera}
      >
        <View style={cameraStyles.root}>
          {/* Backdrop — tap anywhere outside the card to dismiss. */}
          <Animated.View style={[cameraStyles.backdrop, { opacity: cardAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeCamera} />
          </Animated.View>

          {/* Mode switch sits above the card, like a chip over the preview. */}
          <Animated.View
            style={[
              cameraStyles.modeRow,
              { bottom: CAMERA_CARD_HEIGHT + insets.bottom + 22, opacity: cardAnim },
            ]}
          >
            <View style={cameraStyles.modePill}>
              <Pressable
                onPress={() => switchCameraMode('photo')}
                style={[cameraStyles.modeBtn, cameraMode === 'photo' && cameraStyles.modeBtnActive]}
              >
                <Ionicons name="aperture-outline" size={16} color={cameraMode === 'photo' ? '#111' : 'rgba(255,255,255,0.75)'} />
                <Text style={[cameraStyles.modeBtnText, { color: cameraMode === 'photo' ? '#111' : 'rgba(255,255,255,0.75)' }]}>
                  AI Photo
                </Text>
              </Pressable>
              <Pressable
                onPress={() => switchCameraMode('scan')}
                style={[cameraStyles.modeBtn, cameraMode === 'scan' && cameraStyles.modeBtnActive]}
              >
                <Ionicons name="barcode-outline" size={16} color={cameraMode === 'scan' ? '#111' : 'rgba(255,255,255,0.75)'} />
                <Text style={[cameraStyles.modeBtnText, { color: cameraMode === 'scan' ? '#111' : 'rgba(255,255,255,0.75)' }]}>
                  Barcode
                </Text>
              </Pressable>
            </View>
          </Animated.View>

          <Animated.View
            style={[
              cameraStyles.card,
              {
                height: CAMERA_CARD_HEIGHT,
                bottom: insets.bottom + 10,
                transform: [{ translateY: cardTranslateY }],
              },
            ]}
          >
            {CameraView ? (
              <CameraView
                ref={cameraMode === 'photo' ? cameraRef : undefined}
                style={cameraStyles.view}
                facing="back"
                flash={cameraMode === 'photo' ? flash : 'off'}
                enableTorch={cameraMode === 'scan' && flash !== 'off'}
                {...(cameraMode === 'scan' ? {
                  barcodeScannerSettings: { barcodeTypes: FOOD_BARCODE_TYPES },
                  onBarcodeScanned: scanned ? undefined : onBarcodeScanned,
                } : {})}
              />
            ) : (
              <View style={[cameraStyles.view, cameraStyles.fallback]}>
                <Text style={cameraStyles.fallbackText}>Camera loading…</Text>
              </View>
            )}

            {cameraMode === 'scan' && (
              <View style={cameraStyles.overlay} pointerEvents="none">
                <View style={cameraStyles.overlayTop} />
                <View style={cameraStyles.overlayMid}>
                  <View style={cameraStyles.overlaySide} />
                  <View style={cameraStyles.window}>
                    <View style={[cameraStyles.corner, cameraStyles.cornerTL]} />
                    <View style={[cameraStyles.corner, cameraStyles.cornerTR]} />
                    <View style={[cameraStyles.corner, cameraStyles.cornerBL]} />
                    <View style={[cameraStyles.corner, cameraStyles.cornerBR]} />
                    {!scanned && <Animated.View style={[cameraStyles.scanLine, { transform: [{ translateY: scanLineY }] }]} />}
                  </View>
                  <View style={cameraStyles.overlaySide} />
                </View>
                <View style={cameraStyles.overlayBottom} />
              </View>
            )}

            {cameraMode === 'photo' && (
              <View style={photoGuide.overlay} pointerEvents="none">
                <View style={photoGuide.frame}>
                  <View style={[photoGuide.corner, photoGuide.tl]} />
                  <View style={[photoGuide.corner, photoGuide.tr]} />
                  <View style={[photoGuide.corner, photoGuide.bl]} />
                  <View style={[photoGuide.corner, photoGuide.br]} />
                </View>
                <Text style={photoGuide.hint}>Center your meal in the frame</Text>
              </View>
            )}

            {/* Status line — scan hint, lookup progress, or lookup failure. */}
            {cameraMode === 'scan' && (
              <View style={cameraStyles.statusSlot} pointerEvents="box-none">
                {scanned ? (
                  <View style={cameraStyles.lookupCard}>
                    {scanLookupLoading ? (
                      <>
                        <ActivityIndicator color="#FF7849" />
                        <Text style={cameraStyles.lookupText}>Looking up product…</Text>
                      </>
                    ) : scanLookupError ? (
                      <>
                        <Text style={cameraStyles.lookupError}>{scanLookupError}</Text>
                        <TouchableOpacity style={cameraStyles.againBtn} onPress={resetScan}>
                          <Text style={cameraStyles.againText}>Scan again</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                ) : (
                  <View style={cameraStyles.hint}>
                    <Ionicons name="barcode-outline" size={16} color="rgba(255,255,255,0.8)" />
                    <Text style={cameraStyles.hintText}>Point at a barcode or QR code</Text>
                  </View>
                )}
              </View>
            )}

            {/* Controls ride on the preview: dismiss left, shutter centre,
                flash right — all within thumb reach at the card's base. */}
            <View style={cameraStyles.cardControls} pointerEvents="box-none">
              <TouchableOpacity style={cameraStyles.circle} onPress={closeCamera}>
                <Ionicons name="chevron-back" size={22} color="#FFF" />
              </TouchableOpacity>

              {cameraMode === 'photo' ? (
                <TouchableOpacity style={cameraStyles.captureOuter} onPress={capturePhoto}>
                  <View style={cameraStyles.captureInner} />
                </TouchableOpacity>
              ) : (
                <View style={cameraStyles.captureSpacer} />
              )}

              <TouchableOpacity
                style={[cameraStyles.circle, flash !== 'off' && { backgroundColor: 'rgba(255,120,73,0.55)' }]}
                onPress={cycleFlash}
              >
                <Ionicons
                  name={flash === 'on' ? 'flash' : flash === 'auto' ? 'flash-outline' : 'flash-off-outline'}
                  size={20}
                  color="#FFF"
                />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* ── INPUT MODALS (preserved) ─────────────────────────── */}
      <ManualMealInputModal
        visible={manualVisible}
        onClose={closeManual}
        onSubmit={handleManualSubmit}
        presetLabel={manualPreset}
      />

      {pendingPhoto && (
        <PhotoAnalysisModal
          visible={!!pendingPhoto}
          imageUri={pendingPhoto.uri}
          base64Image={pendingPhoto.base64}
          onClose={() => setPendingPhoto(null)}
          onRetry={() => { void openPhoto(); }}
        />
      )}

      <AppModal
        visible={pendingBarcode != null}
        onClose={closeBarcodeConfirm}
        sheetHeight={0.42}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
          <Text style={[styles.barcodeSheetEyebrow, { color: P.calories }]}>BARCODE</Text>
          <Text style={[styles.barcodeSheetTitle, { color: P.text }]}>Add to log?</Text>
          {pendingBarcode && (
            <BarcodeScanPreview
              variant="sheet"
              preview={pendingBarcode.preview}
              loading={false}
              error={null}
              adding={barcodeAdding}
              onAdd={handleBarcodeAdd}
              onScanAgain={handleBarcodeScanAgain}
            />
          )}
        </View>
      </AppModal>

      {/* ── EDIT MODAL ───────────────────────────────────────── */}
      {editItem && (
        <ManualMealInputModal
          visible={editVisible}
          onClose={closeEdit}
          onSubmit={handleEditSubmit}
          presetLabel={groupFor(editItem.meal) === 'breakfast' ? 'breakfast'
            : groupFor(editItem.meal) === 'lunch'    ? 'lunch'
            : groupFor(editItem.meal) === 'dinner'   ? 'dinner'
            : groupFor(editItem.meal) === 'snack'    ? 'snack'
            : undefined}
          initialValues={{
            name:     editItem.name,
            calories: editItem.cals,
            protein:  editItem.protein,
            carbs:    editItem.carbs,
            fat:      editItem.fat,
            imageUrl: editItem.imageUrl,
          }}
        />
      )}
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// AnimatedCard — entrance stagger. Identical pattern to the Home screen.
// ───────────────────────────────────────────────────────────────────────────────
function AnimatedCard({
  children, delay = 0, padding = 20, style,
}: { children: React.ReactNode; delay?: number; padding?: number; style?: any }) {
  const P = usePalette();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 620,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, delay]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Animated.View
      style={[
        {
          backgroundColor: P.card,
          borderRadius: 24,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: P.cardEdge,
          padding,
          shadowColor: '#000',
          shadowOpacity: P.isDark ? 0.35 : 0.06,
          shadowRadius: P.isDark ? 18 : 12,
          shadowOffset: { width: 0, height: 6 },
          ...Platform.select({ android: { elevation: 2 } }),
          opacity: anim,
          transform: [{ translateY }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Meal group — header + swipeable rows
// ───────────────────────────────────────────────────────────────────────────────
const GROUP_TO_LABEL: Partial<Record<GroupKey, MealLabel>> = {
  breakfast: 'breakfast',
  lunch:     'lunch',
  dinner:    'dinner',
  snack:     'snack',
};

function MealGroup({
  groupKey, items, P, delay, onDelete, onAdd, onEdit,
}: {
  groupKey: GroupKey; items: MealItem[]; P: Palette;
  delay: number;
  onDelete: (id: string) => void;
  onAdd: (preset?: MealLabel) => void;
  onEdit: (item: MealItem) => void;
}) {
  const meta       = GROUP_META[groupKey];
  const accent     = P[meta.accent] as string;
  const total      = items.reduce((a, m) => a + m.cals, 0);
  const presetForGroup = GROUP_TO_LABEL[groupKey];

  return (
    <AnimatedCard delay={delay} padding={0}>
      {/* Clip children to card radius without clipping the outer shadow */}
      <View style={{ borderRadius: 24, overflow: 'hidden' }}>
        {/* Header */}
        <View style={[styles.groupHead, { borderBottomColor: P.hair }]}>
          <View
            style={[
              styles.groupIcon,
              { backgroundColor: P[`${meta.accent}Soft` as keyof Palette] as string },
            ]}
          >
            <Ionicons name={meta.icon} size={22} color={accent} />
          </View>
          <View style={styles.groupHeadCopy}>
            <Text style={[styles.groupTitle, { color: P.text }]}>{meta.title}</Text>
            <Text style={[styles.groupSub, { color: P.textFaint }]}>
              {items.length === 0
                ? 'Nothing logged yet'
                : `${items.length} ${items.length === 1 ? 'item' : 'items'} · ${total} kcal`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onAdd(presetForGroup)}
            hitSlop={8}
            style={[styles.groupAdd, { borderColor: P.cardEdge }]}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} color={accent} />
          </TouchableOpacity>
        </View>

        {/* Rows */}
        {items.length === 0 ? (
          <Pressable onPress={() => onAdd(presetForGroup)} style={({ pressed }) => [styles.emptyRow, pressed && { backgroundColor: P.sunken }]}>
            <View style={[styles.emptyDot, { backgroundColor: P.hair }]} />
            <Text style={[styles.emptyText, { color: P.textFaint }]}>Tap to add</Text>
          </Pressable>
        ) : (
          items.map((item, i) => (
            <View key={item.id}>
              {i > 0 && (
                <View
                  style={[
                    styles.rowDivider,
                    {
                      backgroundColor: P.hair,
                      marginLeft: mealRowDividerInset(
                        MEAL_ROW_PADDING_LEFT,
                        MEAL_ROW_GAP,
                        Boolean(item.imageUrl),
                      ),
                    },
                  ]}
                />
              )}
              <MealRow
                item={item}
                P={P}
                onDelete={() => onDelete(item.id)}
                onEdit={() => onEdit(item)}
              />
            </View>
          ))
        )}
      </View>
    </AnimatedCard>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Swipeable row
// ───────────────────────────────────────────────────────────────────────────────
function MealMacroLine({
  item,
  P,
}: {
  item: Pick<MealItem, 'protein' | 'carbs' | 'fat'>;
  P: Palette;
}) {
  const segments: { key: string; color: string; label: string }[] = [];
  if (typeof item.protein === 'number') {
    segments.push({ key: 'protein', color: P.protein, label: `Protein ${item.protein}g` });
  }
  if (typeof item.carbs === 'number') {
    segments.push({ key: 'carbs', color: P.carbs, label: `Carbs ${item.carbs}g` });
  }
  if (typeof item.fat === 'number') {
    segments.push({ key: 'fat', color: P.fat, label: `Fat ${item.fat}g` });
  }
  if (segments.length === 0) return null;

  return (
    <Text style={[styles.mealMacro, { color: P.textFaint }]} numberOfLines={1}>
      {segments.map((seg, i) => (
        <Text key={seg.key}>
          {i > 0 ? <Text style={{ color: P.textFaint }}> · </Text> : null}
          <Text style={{ color: seg.color }}>{seg.label}</Text>
        </Text>
      ))}
    </Text>
  );
}

function MealRow({
  item, P, onDelete, onEdit,
}: {
  item: MealItem;
  P: Palette; onDelete: () => void; onEdit: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const translate = dragX.interpolate({
      inputRange: [-96, 0],
      outputRange: [0, 96],
      extrapolate: 'clamp',
    });
    const opacity = dragX.interpolate({
      inputRange: [-96, -40, 0],
      outputRange: [1, 0.6, 0],
      extrapolate: 'clamp',
    });
    return (
      <Animated.View style={[styles.deleteWrap, { backgroundColor: P.danger, opacity, transform: [{ translateX: translate }] }]}>
        <Ionicons name="trash" size={18} color="#fff" />
        <Text style={styles.deleteText}>Delete</Text>
      </Animated.View>
    );
  };

  const handleDelete = () => {
    swipeRef.current?.close();
    onDelete();
  };

  const firstFood = item.name.split(',')[0]?.trim() || item.name;
  const extras    = item.name.split(',').slice(1).map((s) => s.trim()).filter(Boolean);
  const hasMacros = typeof item.protein === 'number' || typeof item.carbs === 'number' || typeof item.fat === 'number';

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      rightThreshold={56}
      onSwipeableOpen={(direction) => { if (direction === 'right') handleDelete(); }}
    >
      <Pressable
        onPress={onEdit}
        style={({ pressed }) => [
          styles.mealRow,
          !item.imageUrl && styles.mealRowTextOnly,
          { backgroundColor: P.card },
          pressed && { backgroundColor: P.sunken },
        ]}
      >
        {item.imageUrl ? (
          <View style={mealLogThumbStyles.thumbPhoto}>
            <Image
              source={item.imageUrl}
              style={mealLogThumbStyles.thumbImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          </View>
        ) : null}

        <View style={styles.mealCopy}>
          <Text style={[styles.mealName, { color: P.text }]} numberOfLines={1}>
            {firstFood}
          </Text>
          <Text style={[styles.mealMeta, { color: P.textFaint }]} numberOfLines={1}>
            {item.time}
            {extras.length > 0 && <Text style={{ color: P.textFaint }}> · +{extras.length} more</Text>}
          </Text>
          {hasMacros ? <MealMacroLine item={item} P={P} /> : null}
        </View>

        <View style={styles.mealStat}>
          <Text style={[styles.mealCals, { color: P.text }]}>
            {item.cals.toLocaleString()}
          </Text>
          <Text style={[styles.mealUnit, { color: P.textFaint }]}>kcal</Text>
        </View>
      </Pressable>
    </Swipeable>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Empty state — shown when no meals exist at all
// ───────────────────────────────────────────────────────────────────────────────
function EmptyState({ P, onAdd }: { P: Palette; onAdd: () => void }) {
  return (
    <AnimatedCard delay={480}>
      <View style={{ alignItems: 'center', paddingVertical: 8, gap: 10 }}>
        <Ionicons name="restaurant" size={36} color={P.calories} />
        <Text style={[styles.emptyTitle, { color: P.text }]}>Nothing logged yet</Text>
        <Text style={[styles.emptyBody, { color: P.textFaint, textAlign: 'center' }]}>
          Snap a photo, scan a barcode, or type a meal to get your day started.
        </Text>
        <TouchableOpacity
          onPress={onAdd}
          activeOpacity={0.8}
          style={[styles.emptyCta, { backgroundColor: P.calories }]}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.emptyCtaText}>Log a meal</Text>
        </TouchableOpacity>
      </View>
    </AnimatedCard>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Styles
// ───────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },

  // Group
  groupHead: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18, paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupIcon: {
    width:          44,
    height:         44,
    borderRadius:   14,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  groupHeadCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  groupTitle: {
    fontSize: 20, fontWeight: '800', letterSpacing: -0.4, lineHeight: 24,
  },
  groupSub: {
    fontSize: 13, fontWeight: '500', lineHeight: 17,
  },
  groupAdd: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },

  // Meal row
  rowDivider: {
    height: StyleSheet.hairlineWidth,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MEAL_ROW_GAP,
    paddingLeft: MEAL_ROW_PADDING_LEFT,
    paddingRight: MEAL_ROW_PADDING_RIGHT,
    paddingVertical: 12,
    minHeight: MEAL_ROW_MIN_HEIGHT,
  },
  mealRowTextOnly: {
    minHeight: undefined,
    paddingVertical: 14,
  },
  mealCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
    justifyContent: 'center',
  },
  mealName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.25,
    lineHeight: 20,
  },
  mealMeta: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  mealMacro: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 2,
  },
  mealStat: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  mealCals: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  mealUnit: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // Delete action (revealed on swipe)
  deleteWrap: {
    width: 96,
    justifyContent: 'center', alignItems: 'center',
    gap: 4,
  },
  deleteText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  // Empty row (per-group)
  emptyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingVertical: 16,
  },
  emptyDot: {
    width: 6, height: 6, borderRadius: 3,
  },
  emptyText: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.3,
  },

  // Empty state (whole day)
  emptyTitle: {
    fontSize: 16, fontWeight: '800', letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 13, fontWeight: '500', lineHeight: 18,
    paddingHorizontal: 12,
  },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  emptyCtaText: {
    color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.1,
  },

  barcodeSheetEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  barcodeSheetTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
});

// ───────────────────────────────────────────────────────────────────────────────
// Camera styles
// ───────────────────────────────────────────────────────────────────────────────
const SCAN_W = 260;
const SCAN_H = 220;

/**
 * Height of the inline camera card.
 *
 * 68% of the screen keeps the meal list visible above it — the point of the
 * inline treatment — while the floor guarantees room for the scan reticle
 * (220pt) plus the status line and control row beneath it on small devices.
 */
const CAMERA_CARD_HEIGHT = Math.max(
  480,
  Math.round(Dimensions.get('window').height * 0.68),
);

const cameraStyles = StyleSheet.create({
  root:     { flex: 1 },
  view:     { flex: 1 },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', paddingHorizontal: 20 },
  fallbackText: { color: '#FFF', fontSize: 15, textAlign: 'center' },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  /** The preview card itself — inset and heavily rounded so it reads as
   *  content layered on the log, not a separate screen. */
  card: {
    position:     'absolute',
    left:         12,
    right:        12,
    borderRadius: 34,
    overflow:     'hidden',
    backgroundColor: '#000',
  },

  /** Overlaid on the preview's lower edge: dismiss, shutter, flash. */
  cardControls: {
    position:       'absolute',
    left:           18,
    right:          18,
    bottom:         18,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  /** Holds the shutter's slot open in scan mode so the row stays balanced. */
  captureSpacer: { width: 72, height: 72 },

  statusSlot: {
    position:   'absolute',
    left:       18,
    right:      18,
    bottom:     108,
    alignItems: 'center',
  },

  modeRow: {
    position:   'absolute',
    left:       12,
    right:      12,
    alignItems: 'center',
  },
  modePill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  modeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 22, paddingVertical: 11,
    borderRadius: 999,
  },
  modeBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  modeBtnText: {
    fontSize: 15, fontWeight: '700',
  },
  circle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  captureOuter: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  captureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF' },

  overlay:       { ...StyleSheet.absoluteFillObject },
  overlayTop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.60)' },
  overlayMid:    { flexDirection: 'row', height: SCAN_H },
  overlaySide:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.60)' },
  // Weighted rather than even: the reticle has to clear the status line and
  // control row that sit on the card's lower edge, which a true vertical
  // centre would collide with on shorter screens.
  overlayBottom: { flex: 1.9, backgroundColor: 'rgba(0,0,0,0.60)' },
  window:        { width: SCAN_W, height: SCAN_H, overflow: 'hidden' },

  corner:    { position: 'absolute', width: 22, height: 22, borderColor: '#FF7849', borderWidth: 3 },
  cornerTL:  { top: 0,    left: 0,    borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR:  { top: 0,    right: 0,   borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL:  { bottom: 0, left: 0,    borderRightWidth: 0, borderTopWidth: 0,    borderBottomLeftRadius: 4 },
  cornerBR:  { bottom: 0, right: 0,   borderLeftWidth: 0,  borderTopWidth: 0,    borderBottomRightRadius: 4 },

  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 2,
    backgroundColor: '#FF7849',
    shadowColor: '#FF7849', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 6,
  },

  hint:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  hintText:   { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '500' },

  lookupCard: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(15,15,15,0.92)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,120,73,0.35)',
  },
  lookupText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
  },
  lookupError: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  againBtn:   { alignItems: 'center', paddingVertical: 6 },
  againText:  { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
});

// ───────────────────────────────────────────────────────────────────────────────
// Photo guide overlay
// ───────────────────────────────────────────────────────────────────────────────
// Sized to fit the inline card alongside the control row below it.
const GUIDE = 260;

const photoGuide = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            18,
    // Keeps the framing guide clear of the shutter row on the card's edge.
    paddingBottom:  96,
  },
  frame: {
    width:    GUIDE,
    height:   GUIDE,
  },
  corner: {
    position:    'absolute',
    width:        40,
    height:       40,
    borderColor:  'rgba(255,255,255,0.92)',
    borderWidth:  0,
  },
  tl: {
    top: 0, left: 0,
    borderTopWidth: 3, borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  tr: {
    top: 0, right: 0,
    borderTopWidth: 3, borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  bl: {
    bottom: 0, left: 0,
    borderBottomWidth: 3, borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  br: {
    bottom: 0, right: 0,
    borderBottomWidth: 3, borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  hint: {
    color:         'rgba(255,255,255,0.75)',
    fontSize:      13,
    fontWeight:    '500',
    letterSpacing: 0.2,
  },
});
