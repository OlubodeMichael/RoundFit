import { useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';


type IoniconsName = ComponentProps<typeof Ionicons>['name'];
type CameraFacing = 'front' | 'back';
type CameraRefLike = {
  takePictureAsync: (options?: {
    quality?: number;
    skipProcessing?: boolean;
  }) => Promise<{ uri?: string; width?: number; height?: number }>;
};

let cameraModule: null | {
  CameraView: React.ComponentType<Record<string, unknown>>;
  getCameraPermissionsAsync?: () => Promise<{ granted: boolean }>;
  requestCameraPermissionsAsync?: () => Promise<{ granted: boolean }>;
} = null;

try {
  // Avoid crashing the entire route if this native module isn't in the installed iOS build yet.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cameraModule = require('expo-camera');
} catch {
  cameraModule = null;
}

const CameraView = cameraModule?.CameraView ?? null;
const getCameraPermissionsAsync = cameraModule?.getCameraPermissionsAsync;
const requestCameraPermissionsAsync = cameraModule?.requestCameraPermissionsAsync;

const O     = '#F97316';
const O10   = 'rgba(249,115,22,0.10)';
const O35   = 'rgba(249,115,22,0.35)';

const MEALS = [
  { id: '1', meal: 'Breakfast', name: 'Oatmeal & Berries',      cals: 320, protein: 12, carbs: 54, fat: 6,  time: '8:12 AM' },
  { id: '2', meal: 'Lunch',     name: 'Grilled Chicken Wrap',   cals: 510, protein: 38, carbs: 42, fat: 14, time: '12:45 PM' },
  { id: '3', meal: 'Snack',     name: 'Greek Yogurt + Granola', cals: 150, protein: 10, carbs: 18, fat: 4,  time: '3:30 PM' },
];

const MEAL_CALS  = MEALS.reduce((s, m) => s + m.cals, 0);
const MEAL_GOAL  = 2100;
const REMAINING  = MEAL_GOAL - MEAL_CALS;

export default function LogScreen() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRefLike | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [facing, setFacing] = useState<CameraFacing>('back');
  const [capturedCount, setCapturedCount] = useState(0);

  const bg      = isDark ? '#0C0C0C' : '#F7F7F5';
  const surface = isDark ? '#161616' : '#FFFFFF';
  const hi      = isDark ? '#FFFFFF' : '#0C0C0C';
  const mid     = isDark ? '#888'    : '#888';
  const lo      = isDark ? '#2A2A2A' : '#F0EDE8';

  const openCamera = async () => {
    if (!CameraView || !requestCameraPermissionsAsync) {
      Alert.alert(
        'Rebuild required',
        'Camera package is installed, but this iOS app build does not include the native camera module yet. Run npx expo run:ios and relaunch.',
      );
      return;
    }
    const existingPermission = getCameraPermissionsAsync ? await getCameraPermissionsAsync() : { granted: false };
    if (!existingPermission.granted) {
      const requested = await requestCameraPermissionsAsync();
      if (!requested.granted) {
        Alert.alert('Camera access needed', 'Allow camera access to take food photos.');
        return;
      }
    }
    setShowCamera(true);
  };

  const flipCamera = () => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const capturePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });
      if (!photo?.uri) return;

      setCapturedCount((c) => c + 1);
      console.log('[RoundFit Camera] captured', {
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
      });
      Alert.alert('Camera works', 'Photo captured successfully.');
      setShowCamera(false);
    } catch (error) {
      Alert.alert('Capture failed', 'Could not take a photo. Please try again.');
      if (__DEV__) {
        console.log('[RoundFit Camera] capture error', error);
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: bg }}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48, paddingHorizontal: 20, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View>
          <Text style={[s.eyebrow, { color: mid }]}>Today</Text>
          <Text style={[s.pageTitle, { color: hi }]}>Food Log</Text>
        </View>

        {/* Calorie summary strip */}
        <View style={[s.strip, { backgroundColor: surface, borderColor: lo }]}>
          <StripStat label="Eaten"     value={`${MEAL_CALS}`}  color={O}         textColor={hi} sub={mid} />
          <View style={[s.stripDiv, { backgroundColor: lo }]} />
          <StripStat label="Remaining" value={`${REMAINING}`}  color="#22C55E"   textColor={hi} sub={mid} />
          <View style={[s.stripDiv, { backgroundColor: lo }]} />
          <StripStat label="Goal"      value={`${MEAL_GOAL}`}  color={mid}       textColor={hi} sub={mid} />
        </View>

        {/* Add buttons */}
        <View style={s.addRow}>
          <AddButton icon="camera-outline" label="Photo" bg={O} onPress={openCamera} />
          <AddButton icon="search-outline" label="Search" bg={isDark ? '#1D1D1D' : '#ECEAE6'} onPress={() => {}} textColor={hi} />
          <AddButton icon="barcode-outline" label="Scan" bg={isDark ? '#1D1D1D' : '#ECEAE6'} onPress={() => {}} textColor={hi} />
        </View>

        {capturedCount > 0 ? (
          <View style={[s.cameraOkBadge, { backgroundColor: isDark ? '#142015' : '#EAF9EE', borderColor: isDark ? '#294B2C' : '#CDEFD4' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
            <Text style={[s.cameraOkText, { color: hi }]}>Camera ready ({capturedCount} test {capturedCount === 1 ? 'photo' : 'photos'} captured)</Text>
          </View>
        ) : null}

        {/* Meals list */}
        {MEALS.map((item) => (
          <View key={item.id} style={[s.card, { backgroundColor: surface, borderColor: lo }]}>
            <View style={s.mealHeader}>
              <View>
                <Text style={[s.mealTag, { color: O }]}>{item.meal}</Text>
                <Text style={[s.mealName, { color: hi }]}>{item.name}</Text>
                <Text style={[s.mealTime, { color: mid }]}>{item.time}</Text>
              </View>
              <View style={[s.calPill, { backgroundColor: O10, borderColor: O35 }]}>
                <Text style={[s.calPillNum, { color: O }]}>{item.cals}</Text>
                <Text style={[s.calPillUnit, { color: O }]}> cal</Text>
              </View>
            </View>

            <View style={[s.macroRow, { borderTopColor: lo }]}>
              <MacroChip label="P" value={`${item.protein}g`} color={O} bg={O10} />
              <MacroChip label="C" value={`${item.carbs}g`}   color="#FB923C" bg="rgba(251,146,60,0.10)" />
              <MacroChip label="F" value={`${item.fat}g`}     color="#FDBA74" bg="rgba(253,186,116,0.10)" />
              <TouchableOpacity style={s.deleteBtn}>
                <Ionicons name="trash-outline" size={16} color={mid} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Add meal CTA */}
        <TouchableOpacity style={[s.addMealBtn, { borderColor: O35, backgroundColor: O10 }]} activeOpacity={0.75}>
          <Ionicons name="add-circle-outline" size={20} color={O} />
          <Text style={[s.addMealLabel, { color: O }]}>Add another meal</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showCamera} transparent={false} animationType="slide" onRequestClose={() => setShowCamera(false)}>
        <View style={s.cameraRoot}>
          {CameraView ? (
            <CameraView ref={cameraRef} style={s.cameraView} facing={facing} />
          ) : (
            <View style={[s.cameraView, s.cameraFallback]}>
              <Text style={s.cameraFallbackText}>Camera module not available in this build.</Text>
            </View>
          )}
          <View style={[s.cameraTopBar, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity style={s.cameraIconBtn} onPress={() => setShowCamera(false)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={s.cameraTitle}>Snap your meal</Text>
            <TouchableOpacity style={s.cameraIconBtn} onPress={flipCamera}>
              <Ionicons name="camera-reverse-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={[s.cameraBottomBar, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity style={s.cameraIconBtn} onPress={() => setShowCamera(false)}>
              <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={s.captureOuter} onPress={capturePhoto}>
              <View style={s.captureInner} />
            </TouchableOpacity>
            <View style={s.cameraIconBtn} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StripStat({ label, value, color, textColor, sub }: { label: string; value: string; color: string; textColor: string; sub: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
      <Text style={[s.stripVal, { color: textColor }]}>{value}</Text>
      <Text style={[s.stripLabel, { color: sub }]}>{label}</Text>
      <View style={[s.stripDot, { backgroundColor: color }]} />
    </View>
  );
}

function AddButton({ icon, label, bg, onPress, textColor }: { icon: IoniconsName; label: string; bg: string; onPress: () => void; textColor?: string }) {
  const labelColor = textColor ?? '#FFF';
  const iconColor  = textColor ?? '#FFF';
  return (
    <TouchableOpacity style={[s.addBtn, { backgroundColor: bg }]} activeOpacity={0.8} onPress={onPress}>
      <Ionicons name={icon} size={22} color={iconColor} />
      <Text style={[s.addBtnLabel, { color: labelColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function MacroChip({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipLabel, { color }]}>{label}</Text>
      <Text style={[s.chipVal, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  eyebrow:   { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  pageTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 3 },

  strip:    { flexDirection: 'row', borderRadius: 16, padding: 16, borderWidth: 1 },
  stripDiv: { width: 1, height: 36, alignSelf: 'center' },
  stripVal: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  stripLabel: { fontSize: 11, fontWeight: '500' },
  stripDot: { width: 5, height: 5, borderRadius: 3 },

  addRow:  { flexDirection: 'row', gap: 10 },
  addBtn:  { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 6 },
  addBtnLabel: { fontSize: 12, fontWeight: '700' },

  card: { borderRadius: 18, padding: 16, borderWidth: 1, gap: 12 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  mealTag:    { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  mealName:   { fontSize: 15, fontWeight: '700' },
  mealTime:   { fontSize: 12, marginTop: 2 },
  calPill:    { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  calPillNum: { fontSize: 15, fontWeight: '800' },
  calPillUnit:{ fontSize: 11, fontWeight: '600' },

  macroRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 12 },
  chip:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  chipLabel: { fontSize: 11, fontWeight: '700' },
  chipVal:   { fontSize: 11, fontWeight: '600' },
  deleteBtn: { marginLeft: 'auto' },

  addMealBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderStyle: 'dashed' },
  addMealLabel: { fontSize: 14, fontWeight: '700' },
  cameraOkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cameraOkText: { fontSize: 12, fontWeight: '600' },
  cameraRoot: { flex: 1, backgroundColor: '#000000' },
  cameraView: { flex: 1 },
  cameraTopBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cameraBottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cameraIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cameraTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  captureOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  cameraFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    paddingHorizontal: 20,
  },
  cameraFallbackText: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
  },
});
