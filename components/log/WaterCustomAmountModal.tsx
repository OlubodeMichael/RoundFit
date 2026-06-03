import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import { AppModal } from '@/components/ui/AppModal';
import { usePalette } from '@/lib/log-theme';
import {
  waterIconForMl,
  waterIconSizeForMl,
  waterVolumeLabelForMl,
} from '@/utils/water-volume-icon';

const ML_PER_OZ = 29.5735;

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (ml: number) => void;
}

function parseMlInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export function WaterCustomAmountModal({ visible, onClose, onAdd }: Props) {
  const P = usePalette();
  const acc = P.water;

  const [mlInput, setMlInput] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) setMlInput('');
  }, [visible]);

  const parsedMl = useMemo(() => parseMlInput(mlInput), [mlInput]);
  const canSubmit = parsedMl !== null;

  const previewIcon = waterIconForMl(parsedMl ?? 0);
  const previewSize = waterIconSizeForMl(parsedMl ?? 150);
  const previewLabel = parsedMl !== null
    ? waterVolumeLabelForMl(parsedMl)
    : 'Enter amount';

  const ozHint = parsedMl !== null
    ? `≈ ${(parsedMl / ML_PER_OZ).toFixed(1)} oz`
    : 'Amount in milliliters';

  const handleClose = () => {
    inputRef.current?.blur();
    setMlInput('');
    onClose();
    Keyboard.dismiss();
  };

  const handleSubmit = () => {
    if (parsedMl === null) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    inputRef.current?.blur();
    onAdd(parsedMl);
    setMlInput('');
    onClose();
    Keyboard.dismiss();
  };

  return (
    <AppModal
      visible={visible}
      onClose={handleClose}
      title="Custom amount"
      sheetHeight="full"
      keyboardAvoiding
    >
      <View style={s.body}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={[s.inputWrap, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
            <TextInput
              ref={inputRef}
              value={mlInput}
              onChangeText={(t) =>
                setMlInput(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))
              }
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={P.textFaint}
              selectionColor={acc}
              style={[s.inputField, { color: P.text }]}
              autoFocus
              maxLength={5}
            />
            <Text style={[s.inputUnit, { color: P.textFaint }]}>ml</Text>
          </View>

          <View style={s.previewRow}>
            <View
              style={[
                s.previewIcon,
                { backgroundColor: P.isDark ? 'rgba(56,189,248,0.12)' : acc + '18' },
              ]}
            >
              <Ionicons
                name={previewIcon}
                size={previewSize}
                color={canSubmit ? acc : P.textFaint}
              />
            </View>
            <View style={s.previewTextCol}>
              <Text style={[s.previewLabel, { color: canSubmit ? P.text : P.textFaint }]}>
                {previewLabel}
              </Text>
              <Text style={[s.previewHint, { color: P.textFaint }]}>{ozHint}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={[
              s.addBtn,
              { backgroundColor: acc, opacity: canSubmit ? 1 : 0.45 },
            ]}
            activeOpacity={0.85}
          >
            <Text style={s.addBtnTxt}>Add water</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AppModal>
  );
}

const s = StyleSheet.create({
  body: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  inputField: {
    flex: 1,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.5,
    padding: 0,
    minHeight: 48,
  },
  inputUnit: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  previewIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTextCol: {
    flex: 1,
    gap: 2,
  },
  previewLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  previewHint: {
    fontSize: 13,
    fontWeight: '500',
  },
  addBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
