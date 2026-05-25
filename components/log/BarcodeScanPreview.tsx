import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { BarcodePreview } from '@/hooks/use-food';
import { usePalette } from '@/lib/log-theme';

const ACCENT = '#FF7849';
const THUMB_OVERLAY_BG = 'rgba(255,255,255,0.08)';

interface BarcodeScanPreviewProps {
  preview: BarcodePreview | null;
  loading: boolean;
  error: string | null;
  adding: boolean;
  onAdd: () => void;
  onScanAgain: () => void;
  /** Dark overlay on camera; light sheet on food log modal. */
  variant?: 'overlay' | 'sheet';
}

export function BarcodeScanPreview({
  preview,
  loading,
  error,
  adding,
  onAdd,
  onScanAgain,
  variant = 'overlay',
}: BarcodeScanPreviewProps) {
  const P = usePalette();
  const isSheet = variant === 'sheet';

  const panelStyle: ViewStyle = isSheet
    ? { backgroundColor: P.card, borderColor: P.cardEdge }
    : s.panelOverlay;

  const loadingTextColor: TextStyle = isSheet
    ? { color: P.textDim }
    : s.loadingTextOverlay;

  const errorTextColor: TextStyle = isSheet
    ? { color: P.text }
    : s.errorTextOverlay;

  const thumbBg = isSheet ? P.sunken : THUMB_OVERLAY_BG;
  const placeholderIcon = isSheet ? P.textFaint : 'rgba(255,255,255,0.5)';

  const nameColor: TextStyle = isSheet ? { color: P.text } : s.nameOverlay;
  const calsColor: TextStyle = isSheet ? { color: P.text } : s.calsOverlay;
  const calsUnitColor: TextStyle = isSheet ? { color: P.textFaint } : s.calsUnitOverlay;
  const againColor: TextStyle = isSheet ? { color: P.textFaint } : s.againTextOverlay;

  const hasMacros =
    (preview?.protein ?? 0) > 0 ||
    (preview?.carbs ?? 0) > 0 ||
    (preview?.fat ?? 0) > 0;

  return (
    <View style={s.wrap}>
      {loading && (
        <View style={[s.panel, panelStyle]}>
          <ActivityIndicator color={isSheet ? P.calories : ACCENT} />
          <Text style={[s.loadingText, loadingTextColor]}>Looking up product…</Text>
        </View>
      )}

      {!loading && error && (
        <View style={[s.panel, panelStyle]}>
          <Ionicons name="alert-circle-outline" size={22} color={ACCENT} />
          <Text style={[s.errorText, errorTextColor]}>{error}</Text>
        </View>
      )}

      {!loading && preview && (
        <View style={[s.panel, panelStyle]}>
          {preview.imageUrl ? (
            <Image
              source={{ uri: preview.imageUrl }}
              style={[s.thumb, { backgroundColor: thumbBg }]}
              contentFit="contain"
            />
          ) : (
            <View style={[s.thumb, s.thumbPlaceholder, { backgroundColor: thumbBg }]}>
              <Ionicons name="nutrition-outline" size={28} color={placeholderIcon} />
            </View>
          )}

          <View style={s.details}>
            <Text style={[s.name, nameColor]} numberOfLines={2}>
              {preview.name}
            </Text>
            <View style={s.calRow}>
              <Text style={[s.cals, calsColor]}>{preview.cals}</Text>
              <Text style={[s.calsUnit, calsUnitColor]}>kcal</Text>
            </View>
            {hasMacros && (
              <View style={s.macros}>
                {(preview.protein ?? 0) > 0 && (
                  <Text style={[s.macro, { color: P.protein }]}>P {preview.protein}g</Text>
                )}
                {(preview.carbs ?? 0) > 0 && (
                  <Text style={[s.macro, { color: P.carbs }]}>C {preview.carbs}g</Text>
                )}
                {(preview.fat ?? 0) > 0 && (
                  <Text style={[s.macro, { color: P.fat }]}>F {preview.fat}g</Text>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {!loading && preview && (
        <TouchableOpacity
          style={[s.addBtn, adding ? s.addBtnDisabled : null]}
          disabled={adding}
          onPress={onAdd}
          activeOpacity={0.85}
        >
          <Ionicons
            name={adding ? 'hourglass-outline' : 'add-circle'}
            size={20}
            color="#FFF"
          />
          <Text style={s.addBtnText}>{adding ? 'Adding…' : 'Add to food log'}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={s.againBtn} onPress={onScanAgain}>
        <Text style={[s.againText, againColor]}>Scan again</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 12 },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  panelOverlay: {
    backgroundColor: 'rgba(15,15,15,0.92)',
    borderColor: 'rgba(255,120,73,0.35)',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingTextOverlay: {
    color: 'rgba(255,255,255,0.85)',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  errorTextOverlay: {
    color: '#FFF',
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: { flex: 1, gap: 4 },
  name: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  nameOverlay: {
    color: '#FFF',
  },
  calRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  cals: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  calsOverlay: {
    color: '#FFF',
  },
  calsUnit: {
    fontSize: 13,
    fontWeight: '700',
  },
  calsUnitOverlay: {
    color: 'rgba(255,255,255,0.55)',
  },
  macros: { flexDirection: 'row', gap: 10, marginTop: 2 },
  macro: { fontSize: 12, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 14,
  },
  addBtnDisabled: { opacity: 0.65 },
  addBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  againBtn: { alignItems: 'center', paddingVertical: 4 },
  againText: {
    fontSize: 13,
    fontWeight: '600',
  },
  againTextOverlay: {
    color: 'rgba(255,255,255,0.6)',
  },
});
