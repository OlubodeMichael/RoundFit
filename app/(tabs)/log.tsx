import { useRef, useState, useEffect } from 'react';
import type { ComponentProps } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { useFood } from '@/hooks/use-food';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { ManualMealInputModal } from '@/components/log/ManualMealInputModal';
import { PhotoAnalysisModal } from '@/components/log/PhotoAnalysisModal';

const EXPO_CAMERA_NATIVE = 'ExpoCamera';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];
type CameraMode = 'photo' | 'scan';
type CameraRefLike = {
  takePictureAsync: (opts?: { quality?: number; skipProcessing?: boolean; base64?: boolean }) => Promise<{ uri?: string; base64?: string }>;
};
type BarcodeResult = { type: string; data: string };

const O   = '#F97316';
const O10 = 'rgba(249,115,22,0.10)';
const O35 = 'rgba(249,115,22,0.35)';

const FOOD_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'code128', 'code39'];

// ── Camera helpers (module-level, executed once after first successful load) ──
let _camMod: any = null;

function getCamMod() {
  if (_camMod) return _camMod;
  if (!requireOptionalNativeModule(EXPO_CAMERA_NATIVE)) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('expo-camera');
    if (m?.CameraView && m?.Camera?.requestCameraPermissionsAsync) {
      _camMod = m;
    }
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

// ── Screen ────────────────────────────────────────────────────────────────────

export default function LogScreen() {
  const { isDark } = useTheme();
  const insets     = useSafeAreaInsets();
  const { meals, mealGoal, totalCalories, remaining, addMeal, logBarcode, deleteMeal } = useFood();

  const cameraRef    = useRef<CameraRefLike | null>(null);
  const scanLock     = useRef(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const scanLoopRef  = useRef<Animated.CompositeAnimation | null>(null);

  const [cameraMode, setCameraMode]   = useState<CameraMode | null>(null);
  const [scanned, setScanned]         = useState<BarcodeResult | null>(null);
  const [CameraView, setCameraView]   = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [manualVisible, setManualVisible] = useState(false);
  const [pendingPhoto, setPendingPhoto]   = useState<{ uri: string; base64: string } | null>(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');

  const bg      = isDark ? '#0C0C0C' : '#F7F7F5';
  const surface = isDark ? '#161616' : '#FFFFFF';
  const hi      = isDark ? '#FFFFFF' : '#0C0C0C';
  const mid     = isDark ? '#888'    : '#888';
  const lo      = isDark ? '#2A2A2A' : '#F0EDE8';

  // Keep CameraView in sync whenever the modal opens
  useEffect(() => {
    if (cameraMode) {
      const m = getCamMod();
      if (m?.CameraView) setCameraView(() => m.CameraView);
    }
  }, [cameraMode]);

  // ── Scan line animation ────────────────────────────────────────────────────
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

  // ── Open photo camera ──────────────────────────────────────────────────────
  const openPhoto = async () => {
    const ok = await ensureCameraPermission();
    if (!ok) return;
    setCameraMode('photo');
  };

  // ── Open barcode scanner ───────────────────────────────────────────────────
  const openScan = async () => {
    const ok = await ensureCameraPermission();
    if (!ok) return;
    scanLock.current = false;
    setScanned(null);
    setCameraMode('scan');
    // Delay slightly so the modal is mounted before starting the animation
    setTimeout(startScanLine, 300);
  };

  // ── Barcode scanned callback ───────────────────────────────────────────────
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

  // ── Photo capture ──────────────────────────────────────────────────────────
  const capturePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7, skipProcessing: true, base64: true });
      if (!photo?.uri || !photo?.base64) return;
      setCameraMode(null);
      setPendingPhoto({ uri: photo.uri, base64: photo.base64 });
    } catch {
      Alert.alert('Capture failed', 'Could not take a photo.');
    }
  };

  const closeCamera = () => {
    stopScanLine();
    setScanned(null);
    scanLock.current = false;
    setCameraMode(null);
    setFlash('off');
  };

  const cycleFlash = () => {
    setFlash((f) => f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off');
  };


  const scanLineY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 220] });

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48, paddingHorizontal: 20, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={[s.eyebrow, { color: mid }]}>Today</Text>
          <Text style={[s.pageTitle, { color: hi }]}>Food Log</Text>
        </View>

        <View style={[s.strip, { backgroundColor: surface, borderColor: lo }]}>
          <StripStat label="Eaten"     value={`${totalCalories}`} color={O}       textColor={hi} sub={mid} />
          <View style={[s.stripDiv, { backgroundColor: lo }]} />
          <StripStat label="Remaining" value={`${remaining}`}     color="#22C55E" textColor={hi} sub={mid} />
          <View style={[s.stripDiv, { backgroundColor: lo }]} />
          <StripStat label="Goal"      value={`${mealGoal}`}      color={mid}     textColor={hi} sub={mid} />
        </View>

        <View style={s.addRow}>
          <AddButton icon="camera-outline" label="Photo" bg={O} onPress={openPhoto} />
          <AddButton icon="add-outline"     label="Manual" bg={isDark ? '#1D1D1D' : '#ECEAE6'} onPress={() => setManualVisible(true)} textColor={hi} />
          <AddButton icon="barcode-outline" label="Scan"   bg={isDark ? '#1D1D1D' : '#ECEAE6'} onPress={openScan}  textColor={hi} />
        </View>

        {meals.map((item) => {
          const foodItems = item.name.split(', ').filter(Boolean);
          const hasMacros = typeof item.protein === 'number' || typeof item.carbs === 'number' || typeof item.fat === 'number';
          return (
            <View key={item.id} style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
              <View style={[s.cardAccent, { backgroundColor: O }]} />
              <View style={s.cardInner}>
                <View style={s.cardHeader}>
                  <Text style={[s.mealTag, { color: O }]}>{item.meal}</Text>
                  <Text style={[s.mealTime, { color: mid }]}>{item.time}</Text>
                </View>

                <View style={s.foodList}>
                  {foodItems.map((food, i) => (
                    <View key={i} style={s.foodRow}>
                      <View style={[s.foodDot, { backgroundColor: i === 0 ? O : mid, opacity: i === 0 ? 1 : 0.45 }]} />
                      <Text
                        style={[s.foodName, { color: hi, fontSize: i === 0 ? 15 : 13, opacity: i === 0 ? 1 : 0.65 }]}
                        numberOfLines={2}
                      >
                        {food}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={[s.cardFooter, { borderTopColor: lo }]}>
                  <View style={[s.calBadge, { backgroundColor: O10, borderColor: O35 }]}>
                    <Text style={[s.calNum, { color: O }]}>{item.cals}</Text>
                    <Text style={[s.calUnit, { color: O }]}> kcal</Text>
                  </View>
                  {hasMacros && (
                    <View style={s.macros}>
                      {typeof item.protein === 'number' && <Text style={[s.macroText, { color: mid }]}>P {item.protein}g</Text>}
                      {typeof item.carbs   === 'number' && <Text style={[s.macroText, { color: mid }]}>C {item.carbs}g</Text>}
                      {typeof item.fat     === 'number' && <Text style={[s.macroText, { color: mid }]}>F {item.fat}g</Text>}
                    </View>
                  )}
                  <TouchableOpacity onPress={() => deleteMeal(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="trash-outline" size={15} color={mid} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={[s.addMealBtn, { borderColor: O35, backgroundColor: O10 }]} activeOpacity={0.75}>
          <Ionicons name="add-circle-outline" size={20} color={O} />
          <Text style={[s.addMealLabel, { color: O }]}>Add another meal</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Camera modal (photo + scan share one modal) ── */}
      <Modal visible={cameraMode !== null} transparent={false} animationType="slide" onRequestClose={closeCamera}>
        <View style={s.cameraRoot}>

          {/* Camera feed */}
          {CameraView ? (
            <CameraView
              ref={cameraMode === 'photo' ? cameraRef : undefined}
              style={s.cameraView}
              facing="back"
              flash={flash}
              {...(cameraMode === 'scan' ? {
                barcodeScannerSettings: { barcodeTypes: FOOD_BARCODE_TYPES },
                onBarcodeScanned: scanned ? undefined : onBarcodeScanned,
              } : {})}
            />
          ) : (
            <View style={[s.cameraView, s.cameraFallback]}>
              <Text style={s.cameraFallbackText}>Camera loading…</Text>
            </View>
          )}

          {/* Scan overlay */}
          {cameraMode === 'scan' && (
            <View style={s.scanOverlay} pointerEvents="none">
              <View style={s.scanOverlayTop} />
              <View style={s.scanOverlayMid}>
                <View style={s.scanOverlaySide} />
                <View style={s.scanWindow}>
                  <View style={[s.corner, s.cornerTL]} />
                  <View style={[s.corner, s.cornerTR]} />
                  <View style={[s.corner, s.cornerBL]} />
                  <View style={[s.corner, s.cornerBR]} />
                  {!scanned && (
                    <Animated.View style={[s.scanLine, { transform: [{ translateY: scanLineY }] }]} />
                  )}
                </View>
                <View style={s.scanOverlaySide} />
              </View>
              <View style={s.scanOverlayBottom} />
            </View>
          )}

          {/* Top bar */}
          <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity style={s.iconBtn} onPress={closeCamera}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={s.cameraTitle}>
              {cameraMode === 'scan' ? 'Scan barcode' : 'Snap your meal'}
            </Text>
            {cameraMode === 'photo' ? (
              <TouchableOpacity
                style={[s.iconBtn, flash !== 'off' && { backgroundColor: 'rgba(249,115,22,0.55)' }]}
                onPress={cycleFlash}
              >
                <Ionicons
                  name={flash === 'on' ? 'flash' : flash === 'auto' ? 'flash-outline' : 'flash-off-outline'}
                  size={22}
                  color={flash !== 'off' ? O : '#FFF'}
                />
              </TouchableOpacity>
            ) : (
              <View style={s.iconBtn} />
            )}
          </View>

          {/* Bottom bar — photo shutter */}
          {cameraMode === 'photo' && (
            <View style={[s.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
              <View style={s.iconBtn} />
              <TouchableOpacity style={s.captureOuter} onPress={capturePhoto}>
                <View style={s.captureInner} />
              </TouchableOpacity>
              <View style={s.iconBtn} />
            </View>
          )}

          {/* Bottom bar — scan result */}
          {cameraMode === 'scan' && (
            <View style={[s.scanBottom, { paddingBottom: insets.bottom + 24 }]}>
              {scanned ? (
                <>
                  <View style={s.scanResultCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.scanResultType}>{scanned.type.toUpperCase()}</Text>
                      <Text style={s.scanResultCode} numberOfLines={1}>{scanned.data}</Text>
                    </View>
                    <TouchableOpacity
                      style={[s.scanAddBtn, barcodeLoading && { opacity: 0.6 }]}
                      disabled={barcodeLoading}
                      onPress={async () => {
                        if (!scanned) return;
                        setBarcodeLoading(true);
                        try {
                          await logBarcode(scanned.data);
                          closeCamera();
                        } catch {
                          Alert.alert('Lookup failed', 'Could not find this product.');
                        } finally {
                          setBarcodeLoading(false);
                        }
                      }}
                    >
                      <Ionicons name={barcodeLoading ? 'hourglass-outline' : 'add'} size={18} color="#FFF" />
                      <Text style={s.scanAddBtnText}>{barcodeLoading ? 'Looking up…' : 'Add food'}</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={s.scanAgainBtn} onPress={resetScan}>
                    <Text style={s.scanAgainText}>Scan again</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={s.scanHint}>
                  <Ionicons name="barcode-outline" size={18} color="rgba(255,255,255,0.7)" />
                  <Text style={s.scanHintText}>Point at a barcode or QR code</Text>
                </View>
              )}
            </View>
          )}

        </View>
      </Modal>

      <ManualMealInputModal
        visible={manualVisible}
        onClose={() => setManualVisible(false)}
        onSubmit={addMeal}
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
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StripStat({ label, value, color, textColor, sub }: { label: string; value: string; color: string; textColor: string; sub: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
      <Text style={[s.stripVal, { color: textColor }]}>{value}</Text>
      <Text style={[s.stripLabel, { color: sub }]}>{label}</Text>
      <View style={[s.stripDot, { backgroundColor: color }]} />
    </View>
  );
}

function AddButton({ icon, label, bg, onPress, textColor, disabled }: { icon: IoniconsName; label: string; bg: string; onPress: () => void; textColor?: string; disabled?: boolean }) {
  return (
    <TouchableOpacity style={[s.addBtn, { backgroundColor: bg, opacity: disabled ? 0.6 : 1 }]} activeOpacity={0.8} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={22} color={textColor ?? '#FFF'} />
      <Text style={[s.addBtnLabel, { color: textColor ?? '#FFF' }]}>{label}</Text>
    </TouchableOpacity>
  );
}


// ── Styles ────────────────────────────────────────────────────────────────────

const SCAN_W = 260;
const SCAN_H = 220;

const s = StyleSheet.create({
  eyebrow:    { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  pageTitle:  { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 3 },

  strip:      { flexDirection: 'row', borderRadius: 16, padding: 16, borderWidth: 1 },
  stripDiv:   { width: 1, height: 36, alignSelf: 'center' },
  stripVal:   { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  stripLabel: { fontSize: 11, fontWeight: '500' },
  stripDot:   { width: 5, height: 5, borderRadius: 3 },

  addRow:      { flexDirection: 'row', gap: 10 },
  addBtn:      { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 6 },
  addBtnLabel: { fontSize: 12, fontWeight: '700' },

  card:        { borderRadius: 16, borderWidth: 1, overflow: 'hidden', flexDirection: 'row' },
  cardAccent:  { width: 3 },
  cardInner:   { flex: 1, padding: 14, gap: 10 },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealTag:     { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.3 },
  mealTime:    { fontSize: 11, fontWeight: '500' },
  foodList:    { gap: 6 },
  foodRow:     { flexDirection: 'row', alignItems: 'center', gap: 9 },
  foodDot:     { width: 5, height: 5, borderRadius: 3, flexShrink: 0 },
  foodName:    { flex: 1, fontWeight: '600', letterSpacing: -0.2 },
  cardFooter:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 10 },
  calBadge:    { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  calNum:      { fontSize: 13, fontWeight: '800' },
  calUnit:     { fontSize: 10, fontWeight: '600' },
  macros:      { flex: 1, flexDirection: 'row', gap: 10 },
  macroText:   { fontSize: 11, fontWeight: '600' },

  addMealBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderStyle: 'dashed' },
  addMealLabel: { fontSize: 14, fontWeight: '700' },

  // ── Camera ──────────────────────────────────────────────────────────────────
  cameraRoot:     { flex: 1, backgroundColor: '#000' },
  cameraView:     { flex: 1 },
  cameraFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', paddingHorizontal: 20 },
  cameraFallbackText: { color: '#FFF', fontSize: 15, textAlign: 'center' },

  topBar: {
    position: 'absolute', left: 16, right: 16, top: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  bottomBar: {
    position: 'absolute', left: 16, right: 16, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cameraTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  captureOuter: {
    width: 82, height: 82, borderRadius: 41,
    borderWidth: 4, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  captureInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF' },

  // ── Scan overlay ────────────────────────────────────────────────────────────
  scanOverlay:       { ...StyleSheet.absoluteFillObject },
  scanOverlayTop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.60)' },
  scanOverlayMid:    { flexDirection: 'row', height: SCAN_H },
  scanOverlaySide:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.60)' },
  scanOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.60)' },
  scanWindow:        { width: SCAN_W, height: SCAN_H, overflow: 'hidden' },

  corner:    { position: 'absolute', width: 22, height: 22, borderColor: '#F97316', borderWidth: 3 },
  cornerTL:  { top: 0,    left: 0,    borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR:  { top: 0,    right: 0,   borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL:  { bottom: 0, left: 0,    borderRightWidth: 0, borderTopWidth: 0,    borderBottomLeftRadius: 4 },
  cornerBR:  { bottom: 0, right: 0,   borderLeftWidth: 0,  borderTopWidth: 0,    borderBottomRightRadius: 4 },

  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 2,
    backgroundColor: '#F97316',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 6,
  },

  scanBottom: { position: 'absolute', left: 20, right: 20, bottom: 0, gap: 12 },
  scanHint:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  scanHintText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '500' },

  scanResultCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(15,15,15,0.92)',
    borderRadius: 16, padding: 16, gap: 14,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)',
  },
  scanResultType: { fontSize: 10, fontWeight: '700', color: '#F97316', letterSpacing: 1, marginBottom: 3 },
  scanResultCode: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  scanAddBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F97316', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  scanAddBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  scanAgainBtn:   { alignItems: 'center', paddingVertical: 6 },
  scanAgainText:  { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
});
