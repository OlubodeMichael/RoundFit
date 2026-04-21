import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { requireOptionalNativeModule } from 'expo-modules-core';

import { useRouter } from 'expo-router';
import { useFood, type MealItem } from '@/hooks/use-food';
import { ManualMealInputModal, type MealLabel, type ManualMealInput } from '@/components/log/ManualMealInputModal';
import { PhotoAnalysisModal } from '@/components/log/PhotoAnalysisModal';
import { useToast } from '@/components/ui/Toast';
import { usePalette, type Palette } from '@/lib/log-theme';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];
type CameraMode = 'photo' | 'scan';
type CameraRefLike = {
  takePictureAsync: (opts?: { quality?: number; skipProcessing?: boolean; base64?: boolean }) => Promise<{ uri?: string; base64?: string }>;
};
type BarcodeResult = { type: string; data: string };

const EXPO_CAMERA_NATIVE = 'ExpoCamera';
const FOOD_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128', 'code39'];

// ───────────────────────────────────────────────────────────────────────────────
// Meal grouping + theming
// ───────────────────────────────────────────────────────────────────────────────
type GroupKey = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';

const GROUP_ORDER: GroupKey[] = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];

const GROUP_META: Record<GroupKey, { title: string; icon: IoniconsName; accent: keyof Palette }> = {
  breakfast: { title: 'Breakfast', icon: 'cafe',        accent: 'carbs'    },
  lunch:     { title: 'Lunch',     icon: 'restaurant',  accent: 'protein'  },
  dinner:    { title: 'Dinner',    icon: 'moon',        accent: 'fat'      },
  snack:     { title: 'Snack',     icon: 'nutrition',   accent: 'water'    },
  other:     { title: 'Other',     icon: 'fast-food',   accent: 'calories' },
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
    meals, mealGoal, totalCalories, remaining,
    addMeal, logBarcode, deleteMeal, refreshLogs, activeDate,
  } = useFood();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const today = localCalendarFromDate(new Date());
  const isToday = activeDate === today;

  const navigateDate = async (direction: -1 | 1) => {
    const next = offsetDate(activeDate, direction);
    if (next > today) return; // no future dates
    await refreshLogs(next);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshLogs(activeDate);
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
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');

  useEffect(() => {
    if (cameraMode) {
      const m = getCamMod();
      if (m?.CameraView) setCameraView(() => m.CameraView);
    }
  }, [cameraMode]);

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
    scanLock.current = false;
    setScanned(null);
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
    startScanLine();
  };
  const capturePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7, skipProcessing: true, base64: true });
      if (!photo?.uri || !photo?.base64) return;
      setCameraMode(null);
      setPendingPhoto({ uri: photo.uri, base64: photo.base64 });
    } catch {
      toast.error('Capture failed', 'Could not take a photo.');
    }
  };
  const closeCamera = () => {
    stopScanLine();
    setScanned(null);
    scanLock.current = false;
    setCameraMode(null);
    setFlash('off');
  };
  const cycleFlash = () => setFlash((f) => f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off');
  const scanLineY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 220] });

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop:    insets.top + 12,
          paddingBottom: insets.bottom + 64,
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
            <View style={[styles.datePill, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
              <TouchableOpacity
                onPress={() => navigateDate(-1)}
                hitSlop={8}
                activeOpacity={0.6}
                style={styles.dateArrow}
              >
                <Ionicons name="chevron-back" size={16} color={P.textDim} />
              </TouchableOpacity>

              <View style={styles.dateLabelWrap}>
                {isToday && (
                  <View style={[styles.todayDot, { backgroundColor: P.calories }]} />
                )}
                <Text style={[styles.dateLabel, { color: P.text }]}>
                  {formatNavDate(activeDate)}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => navigateDate(1)}
                hitSlop={8}
                activeOpacity={isToday ? 1 : 0.6}
                disabled={isToday}
                style={styles.dateArrow}
              >
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={isToday ? P.cardEdge : P.textDim}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Spacer to balance the back button */}
          <View style={{ width: 40 }} />
        </View>

        {/* ── SUMMARY CARD ─────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 18, marginBottom: 16 }}>
          <AnimatedCard delay={80}>
            <View style={styles.summaryRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.summaryEyebrow, { color: P.textFaint }]}>
                  CALORIES REMAINING
                </Text>
                <Text style={[styles.summaryBig, { color: P.text }]}>
                  {Math.max(0, remaining).toLocaleString()}
                </Text>
              </View>
              <View style={[styles.summaryPill, { backgroundColor: P.caloriesSoft }]}>
                <Ionicons name="flame" size={13} color={P.calories} />
                <Text style={[styles.summaryPillText, { color: P.calories }]}>
                  {Math.round(eatenPct * 100)}%
                </Text>
              </View>
            </View>

            <View style={[styles.progressTrack, { backgroundColor: P.sunken }]}>
              <View style={[styles.progressFill, { width: `${eatenPct * 100}%`, backgroundColor: P.calories }]} />
            </View>

            <View style={[styles.summaryFoot, { borderTopColor: P.hair }]}>
              <SummaryStat
                label={isToday ? 'EATEN' : 'ATE'}
                value={totalCalories.toLocaleString()}
                ink={P.text}
                sub={P.textFaint}
              />
              <View style={[styles.vDiv, { backgroundColor: P.hair }]} />
              <SummaryStat label="REMAINING" value={Math.max(0, remaining).toLocaleString()} ink={P.sage} sub={P.textFaint} />
              <View style={[styles.vDiv, { backgroundColor: P.hair }]} />
              <SummaryStat label="GOAL"      value={mealGoal.toLocaleString()}      ink={P.textDim}  sub={P.textFaint} />
            </View>
          </AnimatedCard>
        </View>

        {/* ── QUICK ACTIONS ────────────────────────────────────── */}
        <View style={styles.actions}>
          <ActionCard
            label="Photo"
            caption="AI detect"
            icon="camera"
            accent={P.calories}
            accentSoft={P.caloriesSoft}
            P={P}
            delay={160}
            onPress={openPhoto}
            primary
          />
          <ActionCard
            label="Manual"
            caption="Type entry"
            icon="create"
            accent={P.protein}
            accentSoft={P.proteinSoft}
            P={P}
            delay={220}
            onPress={() => openManual()}
          />
          <ActionCard
            label="Scan"
            caption="Barcode"
            icon="barcode"
            accent={P.water}
            accentSoft={P.waterSoft}
            P={P}
            delay={280}
            onPress={openScan}
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

      {/* ── CAMERA MODAL (unchanged behaviour, restyled shell) ─── */}
      <Modal visible={cameraMode !== null} transparent={false} animationType="slide" onRequestClose={closeCamera}>
        <View style={cameraStyles.root}>
          {CameraView ? (
            <CameraView
              ref={cameraMode === 'photo' ? cameraRef : undefined}
              style={cameraStyles.view}
              facing="back"
              flash={flash}
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

          <View style={[cameraStyles.topBar, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity style={cameraStyles.circle} onPress={closeCamera}>
              <Ionicons name="close" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={cameraStyles.title}>
              {cameraMode === 'scan' ? 'Scan barcode' : 'Snap your meal'}
            </Text>
            {cameraMode === 'photo' ? (
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
            ) : (
              <View style={cameraStyles.circle} />
            )}
          </View>

          {cameraMode === 'photo' && (
            <View style={[cameraStyles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
              <View style={cameraStyles.circle} />
              <TouchableOpacity style={cameraStyles.captureOuter} onPress={capturePhoto}>
                <View style={cameraStyles.captureInner} />
              </TouchableOpacity>
              <View style={cameraStyles.circle} />
            </View>
          )}

          {cameraMode === 'scan' && (
            <View style={[cameraStyles.scanBottom, { paddingBottom: insets.bottom + 24 }]}>
              {scanned ? (
                <>
                  <View style={cameraStyles.resultCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={cameraStyles.resultType}>{scanned.type.toUpperCase()}</Text>
                      <Text style={cameraStyles.resultCode} numberOfLines={1}>{scanned.data}</Text>
                    </View>
                    <TouchableOpacity
                      style={[cameraStyles.addBtn, barcodeLoading && { opacity: 0.6 }]}
                      disabled={barcodeLoading}
                      onPress={async () => {
                        if (!scanned) return;
                        setBarcodeLoading(true);
                        try {
                          await logBarcode(scanned.data);
                          closeCamera();
                          toast.success('Food logged', 'Added from barcode');
                        } catch {
                          toast.error('Lookup failed', 'Could not find this product.');
                        } finally {
                          setBarcodeLoading(false);
                        }
                      }}
                    >
                      <Ionicons name={barcodeLoading ? 'hourglass-outline' : 'add'} size={18} color="#FFF" />
                      <Text style={cameraStyles.addBtnText}>{barcodeLoading ? 'Looking up…' : 'Add food'}</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={cameraStyles.againBtn} onPress={resetScan}>
                    <Text style={cameraStyles.againText}>Scan again</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={cameraStyles.hint}>
                  <Ionicons name="barcode-outline" size={18} color="rgba(255,255,255,0.7)" />
                  <Text style={cameraStyles.hintText}>Point at a barcode or QR code</Text>
                </View>
              )}
            </View>
          )}
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
// Summary stat — tiny column
// ───────────────────────────────────────────────────────────────────────────────
function SummaryStat({ label, value, ink, sub }: { label: string; value: string; ink: string; sub: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Text style={[styles.statLabel, { color: sub }]}>{label}</Text>
      <Text style={[styles.statValue, { color: ink }]}>{value}</Text>
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Action card — quick-add chips
// ───────────────────────────────────────────────────────────────────────────────
function ActionCard({
  label, caption, icon, accent, accentSoft, P, delay, onPress, primary,
}: {
  label: string; caption: string; icon: IoniconsName;
  accent: string; accentSoft: string; P: Palette;
  delay: number; onPress: () => void; primary?: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 560, delay,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [anim, delay]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  return (
    <Animated.View style={{ flex: 1, opacity: anim, transform: [{ translateY }] }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.action,
          {
            backgroundColor: primary ? accent : P.card,
            borderColor: primary ? accent : P.cardEdge,
          },
          pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
        ]}
      >
        <View style={[
          styles.actionIcon,
          { backgroundColor: primary ? 'rgba(255,255,255,0.18)' : accentSoft },
        ]}>
          <Ionicons name={icon} size={18} color={primary ? '#fff' : accent} />
        </View>
        <Text style={[styles.actionLabel, { color: primary ? '#fff' : P.text }]}>
          {label}
        </Text>
        <Text style={[
          styles.actionCaption,
          { color: primary ? 'rgba(255,255,255,0.75)' : P.textFaint },
        ]}>
          {caption}
        </Text>
      </Pressable>
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
  const accentSoft = P[`${String(meta.accent)}Soft` as keyof Palette] as string;
  const total      = items.reduce((a, m) => a + m.cals, 0);
  const presetForGroup = GROUP_TO_LABEL[groupKey];

  return (
    <AnimatedCard delay={delay} padding={0}>
      {/* Header */}
      <View style={[styles.groupHead, { borderBottomColor: P.hair }]}>
        <View style={[styles.groupIcon, { backgroundColor: accentSoft }]}>
          <Ionicons name={meta.icon} size={16} color={accent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
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
          <Ionicons name="add" size={15} color={accent} />
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
            {i > 0 && <View style={[styles.rowDivider, { backgroundColor: P.hair }]} />}
            <MealRow
              item={item}
              accent={accent}
              accentSoft={accentSoft}
              icon={meta.icon}
              P={P}
              onDelete={() => onDelete(item.id)}
              onEdit={() => onEdit(item)}
            />
          </View>
        ))
      )}
    </AnimatedCard>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Swipeable row
// ───────────────────────────────────────────────────────────────────────────────
function MealRow({
  item, accent, accentSoft, icon, P, onDelete, onEdit,
}: {
  item: MealItem; accent: string; accentSoft: string; icon: IoniconsName;
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
        style={({ pressed }) => [styles.mealRow, { backgroundColor: P.card }, pressed && { backgroundColor: P.sunken }]}
      >
        <View style={[styles.thumb, { backgroundColor: accentSoft }]}>
          <Ionicons name={icon} size={16} color={accent} />
        </View>

        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.mealName, { color: P.text }]} numberOfLines={1}>
            {firstFood}
          </Text>
          <Text style={[styles.mealMeta, { color: P.textFaint }]} numberOfLines={1}>
            {item.time}
            {extras.length > 0 && <Text style={{ color: P.textFaint }}> · +{extras.length} more</Text>}
            {hasMacros && (
              <>
                <Text style={{ color: P.textFaint }}>  ·  </Text>
                {typeof item.protein === 'number' && <Text style={{ color: P.protein }}>P{item.protein} </Text>}
                {typeof item.carbs   === 'number' && <Text style={{ color: P.carbs   }}>C{item.carbs} </Text>}
                {typeof item.fat     === 'number' && <Text style={{ color: P.fat     }}>F{item.fat}</Text>}
              </>
            )}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 1 }}>
          <Text style={[styles.mealCals, { color: P.text }]}>{item.cals}</Text>
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
        <View style={[styles.emptyIcon, { backgroundColor: P.caloriesSoft }]}>
          <Ionicons name="restaurant-outline" size={26} color={P.calories} />
        </View>
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
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    ...Platform.select({ android: { elevation: 1 } }),
  },
  dateArrow: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    minWidth: 90,
    justifyContent: 'center',
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dateLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  summaryEyebrow: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.5,
  },
  summaryBig: {
    fontSize: 40, fontWeight: '800', letterSpacing: -1.6, lineHeight: 44,
  },
  summaryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  summaryPillText: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.4,
  },
  progressTrack: {
    height: 6, borderRadius: 3, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 3,
  },
  summaryFoot: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  vDiv: { width: StyleSheet.hairlineWidth },
  statLabel: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1.4,
  },
  statValue: {
    fontSize: 17, fontWeight: '800', letterSpacing: -0.4,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  action: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 13, fontWeight: '800', letterSpacing: -0.2,
  },
  actionCaption: {
    fontSize: 10, fontWeight: '600', letterSpacing: 0.3,
  },

  // Group
  groupHead: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  groupTitle: {
    fontSize: 15, fontWeight: '800', letterSpacing: -0.3,
  },
  groupSub: {
    fontSize: 11, fontWeight: '500',
  },
  groupAdd: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },

  // Meal row
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 70, // 18 (row padding) + 38 (thumb) + 14 (gap) = under text
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  thumb: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  mealName: {
    fontSize: 14, fontWeight: '700', letterSpacing: -0.2,
  },
  mealMeta: {
    fontSize: 11, fontWeight: '600',
  },
  mealCals: {
    fontSize: 16, fontWeight: '800', letterSpacing: -0.4,
  },
  mealUnit: {
    fontSize: 9, fontWeight: '700', letterSpacing: 0.8,
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
  emptyIcon: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
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
});

// ───────────────────────────────────────────────────────────────────────────────
// Camera styles
// ───────────────────────────────────────────────────────────────────────────────
const SCAN_W = 260;
const SCAN_H = 220;

const cameraStyles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#000' },
  view:     { flex: 1 },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', paddingHorizontal: 20 },
  fallbackText: { color: '#FFF', fontSize: 15, textAlign: 'center' },

  topBar: {
    position: 'absolute', left: 16, right: 16, top: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  bottomBar: {
    position: 'absolute', left: 16, right: 16, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  circle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  title: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  captureOuter: {
    width: 82, height: 82, borderRadius: 41,
    borderWidth: 4, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  captureInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF' },

  overlay:       { ...StyleSheet.absoluteFillObject },
  overlayTop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.60)' },
  overlayMid:    { flexDirection: 'row', height: SCAN_H },
  overlaySide:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.60)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.60)' },
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

  scanBottom: { position: 'absolute', left: 20, right: 20, bottom: 0, gap: 12 },
  hint:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  hintText:   { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '500' },

  resultCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(15,15,15,0.92)',
    borderRadius: 16, padding: 16, gap: 14,
    borderWidth: 1, borderColor: 'rgba(255,120,73,0.4)',
  },
  resultType: { fontSize: 10, fontWeight: '700', color: '#FF7849', letterSpacing: 1, marginBottom: 3 },
  resultCode: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF7849', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  againBtn:   { alignItems: 'center', paddingVertical: 6 },
  againText:  { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
});
