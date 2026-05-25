import { useEffect, useMemo, useState } from 'react';
import {
  Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) setKeyboardHeight(0);
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
    setMlInput('');
    onClose();
  };

  const handleSubmit = () => {
    if (parsedMl === null) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAdd(parsedMl);
    setMlInput('');
    onClose();
  };

  return (
    <AppModal
      visible={visible}
      onClose={handleClose}
      title="Custom amount"
      sheetHeight={0.52}
      keyboardAvoiding
    >
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[
          s.scrollContent,
          keyboardHeight > 0 && { paddingBottom: keyboardHeight * 0.35 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[s.inputWrap, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
          <TextInput
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
      </ScrollView>
    </AppModal>
  );
}

const s = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 16,
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
