import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { useTheme } from '@/hooks/use-theme';
import {
  ACCOUNT_DELETION_REASONS,
  type AccountDeletionReason,
  type DeleteAccountInput,
  DELETION_REASON_LABELS,
} from '@/types/account-deletion';

const DANGER = '#FF453A';

export interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onDelete: (input: DeleteAccountInput) => Promise<void>;
}

type Step = 'survey' | 'confirm';

interface Palette {
  hi: string;
  mid: string;
  lo: string;
  sunken: string;
  surface: string;
  edge: string;
  isDark: boolean;
}

function useModalPalette(isDark: boolean): Palette {
  return {
    hi:      isDark ? '#F4F4F5' : '#111111',
    mid:     isDark ? '#909096' : '#6B7280',
    lo:      isDark ? '#2A2A32' : '#EBEBEB',
    sunken:  isDark ? '#141519' : '#F3F3F5',
    surface: isDark ? '#1C1D23' : '#FFFFFF',
    edge:    isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    isDark,
  };
}

function SectionLabel({ label, color }: { label: string; color: string }) {
  return (
    <Text style={[s.sectionLabel, { color }]}>
      {label.toUpperCase()}
    </Text>
  );
}

function ReasonRow({
  label,
  selected,
  onPress,
  disabled,
  P,
  showDivider,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
  P: Palette;
  showDivider: boolean;
}) {
  return (
    <>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        style={({ pressed }) => [
          s.reasonRow,
          pressed && !disabled && { opacity: 0.88 },
        ]}
      >
        <Text
          style={[
            s.reasonLabel,
            { color: selected ? P.hi : P.mid, fontWeight: selected ? '600' : '500' },
          ]}
        >
          {label}
        </Text>
        <View
          style={[
            s.radio,
            { borderColor: selected ? DANGER : P.lo },
            selected && { backgroundColor: DANGER },
          ]}
        >
          {selected && <Ionicons name="checkmark" size={11} color="#FFF" />}
        </View>
      </Pressable>
      {showDivider && <View style={[s.rowDivider, { backgroundColor: P.lo }]} />}
    </>
  );
}

export function DeleteAccountModal({ visible, onClose, onDelete }: DeleteAccountModalProps) {
  const { isDark } = useTheme();
  const P = useModalPalette(isDark);

  const [step, setStep] = useState<Step>('survey');
  const [reason, setReason] = useState<AccountDeletionReason | null>(null);
  const [details, setDetails] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setStep('survey');
      setReason(null);
      setDetails('');
      setConfirmText('');
      setDeleting(false);
    }
  }, [visible]);

  const canContinue =
    reason !== null && (reason !== 'other' || details.trim().length > 0);

  const canDelete = confirmText === 'DELETE' && canContinue;

  function handleClose() {
    if (!deleting) onClose();
  }

  async function handleDelete() {
    if (!canDelete || !reason || deleting) return;
    setDeleting(true);
    try {
      await onDelete({ reason, details: details.trim() || undefined });
    } catch (err: unknown) {
      setDeleting(false);
      const msg = err instanceof Error ? err.message : '';
      Alert.alert('Error', msg || 'Could not delete your account. Please try again.');
    }
  }

  return (
    <AppModal
      visible={visible}
      onClose={handleClose}
      sheetHeight={0.88}
      keyboardAvoiding
      dismissGestureArea="sheet"
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>DANGER ZONE</Text>
            <Text style={[s.modalTitle, { color: P.hi }]}>Delete account</Text>
            <Text style={[s.stepHint, { color: P.mid }]}>
              {step === 'survey' ? 'Step 1 of 2 — Tell us why' : 'Step 2 of 2 — Confirm'}
            </Text>
          </View>
          <Pressable
            onPress={handleClose}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
            style={[s.closeBtn, { backgroundColor: P.isDark ? '#252530' : '#ECEAE6' }]}
          >
            <Text style={[s.closeBtnText, { color: P.mid }]}>✕</Text>
          </Pressable>
        </View>

        {step === 'survey' ? (
          <View style={s.block}>
            <SectionLabel label="Why are you leaving?" color={P.mid} />
            <View style={[s.group, { backgroundColor: P.surface, borderColor: P.edge }]}>
              {ACCOUNT_DELETION_REASONS.map((r, index) => (
                <ReasonRow
                  key={r}
                  label={DELETION_REASON_LABELS[r]}
                  selected={reason === r}
                  onPress={() => setReason(r)}
                  disabled={deleting}
                  P={P}
                  showDivider={index < ACCOUNT_DELETION_REASONS.length - 1}
                />
              ))}
            </View>

            {reason !== null && (
              <View style={s.fieldBlock}>
                <SectionLabel
                  label={reason === 'other' ? 'Tell us more' : 'Anything else? (optional)'}
                  color={P.mid}
                />
                <TextInput
                  style={[
                    s.input,
                    s.inputMultiline,
                    {
                      backgroundColor: P.sunken,
                      borderColor: P.edge,
                      color: P.hi,
                    },
                  ]}
                  placeholder={reason === 'other' ? 'Required' : 'Share feedback…'}
                  placeholderTextColor={P.mid}
                  multiline
                  value={details}
                  onChangeText={setDetails}
                  editable={!deleting}
                />
              </View>
            )}
          </View>
        ) : (
          <View style={s.block}>
            <View style={[s.noticeCard, { backgroundColor: P.sunken, borderColor: P.edge }]}>
              <View style={[s.noticeIcon, { backgroundColor: P.isDark ? 'rgba(255,69,58,0.16)' : 'rgba(255,69,58,0.10)' }]}>
                <Ionicons name="trash-outline" size={18} color={DANGER} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[s.noticeTitle, { color: P.hi }]}>This cannot be undone</Text>
                <Text style={[s.noticeBody, { color: P.mid }]}>
                  Your account, progress, history, and personal data will be permanently deleted.
                </Text>
              </View>
            </View>

            <View style={s.fieldBlock}>
              <Text style={[s.confirmLabel, { color: P.mid }]}>
                Type{' '}
                <Text style={{ color: DANGER, fontWeight: '700' }}>DELETE</Text>
                {' '}to confirm
              </Text>
              <TextInput
                style={[
                  s.input,
                  {
                    backgroundColor: P.sunken,
                    borderColor: confirmText === 'DELETE' ? DANGER : P.edge,
                    color: P.hi,
                  },
                ]}
                placeholder="DELETE"
                placeholderTextColor={P.mid}
                autoCapitalize="characters"
                autoCorrect={false}
                value={confirmText}
                onChangeText={setConfirmText}
                editable={!deleting}
              />
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[s.footer, { borderTopColor: P.lo }]}>
        {step === 'survey' ? (
          <>
            <TouchableOpacity
              style={[s.cancelBtn, { borderColor: P.lo }]}
              onPress={handleClose}
              disabled={deleting}
              activeOpacity={0.8}
            >
              <Text style={[s.cancelText, { color: P.hi }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.dangerBtn,
                { backgroundColor: canContinue && !deleting ? DANGER : P.sunken },
              ]}
              onPress={() => setStep('confirm')}
              disabled={!canContinue || deleting}
              activeOpacity={0.85}
            >
              <Text style={[s.dangerBtnText, { color: canContinue ? '#FFF' : P.mid }]}>
                Continue
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[s.cancelBtn, { borderColor: P.lo }]}
              onPress={() => { setStep('survey'); setConfirmText(''); }}
              disabled={deleting}
              activeOpacity={0.8}
            >
              <Text style={[s.cancelText, { color: P.hi }]}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.dangerBtn,
                { backgroundColor: canDelete && !deleting ? DANGER : P.sunken },
              ]}
              onPress={handleDelete}
              disabled={!canDelete || deleting}
              activeOpacity={0.85}
            >
              {deleting
                ? <ActivityIndicator size="small" color="#FFF" />
                : (
                  <Text style={[s.dangerBtnText, { color: canDelete ? '#FFF' : P.mid }]}>
                    Delete account
                  </Text>
                )
              }
            </TouchableOpacity>
          </>
        )}
      </View>
    </AppModal>
  );
}

const s = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: DANGER,
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 26,
    letterSpacing: -0.6,
  },
  stepHint: {
    fontSize: 13,
    marginTop: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  block: {
    gap: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  group: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  reasonLabel: {
    flex: 1,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  fieldBlock: {
    gap: 8,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 21,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noticeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  noticeBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  confirmLabel: {
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
  dangerBtn: {
    flex: 1.4,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
