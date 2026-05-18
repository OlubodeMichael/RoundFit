import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import {
  ACCOUNT_DELETION_REASONS,
  type AccountDeletionReason,
  type DeleteAccountInput,
  DELETION_REASON_LABELS,
} from '@/types/account-deletion';

const SHEET_MAX_H = Dimensions.get('window').height * 0.88;

export interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onDelete: (input: DeleteAccountInput) => Promise<void>;
}

type Step = 'survey' | 'confirm';

function usePalette() {
  const { isDark } = useTheme();
  return isDark
    ? {
        card: '#1C1D23',
        sunken: '#0E0F13',
        edge: 'rgba(255,255,255,0.08)',
        hair: 'rgba(255,255,255,0.06)',
        text: '#F4F4F5',
        dim: '#909096',
        faint: '#505058',
      }
    : {
        card: '#FFFFFF',
        sunken: '#F7F7F9',
        edge: 'rgba(0,0,0,0.06)',
        hair: 'rgba(0,0,0,0.05)',
        text: '#09090B',
        dim: '#6B7280',
        faint: '#C0C0C8',
      };
}

export function DeleteAccountModal({ visible, onClose, onDelete }: DeleteAccountModalProps) {
  const P = usePalette();
  const insets = useSafeAreaInsets();
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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={handleClose} />
        <View style={[styles.sheet, { backgroundColor: P.card, maxHeight: SHEET_MAX_H, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: P.faint }]} />
          </View>

          <View style={[styles.header, { borderBottomColor: P.hair }]}>
            <View style={styles.headerAccent} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.headerTitle, { color: P.text }]}>Delete Account</Text>
              <Text style={[styles.stepLabel, { color: P.dim }]}>
                {step === 'survey' ? 'Step 1 of 2 — Tell us why' : 'Step 2 of 2 — Confirm'}
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 'survey' ? (
              <View style={styles.block}>
                <Text style={[styles.label, { color: P.text }]}>Why are you leaving?</Text>
                <View style={styles.reasonList}>
                  {ACCOUNT_DELETION_REASONS.map((r) => {
                    const selected = reason === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: selected ? 'rgba(239,68,68,0.12)' : P.sunken,
                            borderColor: selected ? '#EF4444' : P.edge,
                          },
                        ]}
                        onPress={() => setReason(r)}
                        disabled={deleting}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, { color: selected ? '#EF4444' : P.dim }]}>
                          {DELETION_REASON_LABELS[r]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {reason !== null && (
                  <View style={{ gap: 8 }}>
                    <Text style={[styles.label, { color: P.text }]}>
                      {reason === 'other' ? 'Tell us more' : 'Anything else? (optional)'}
                    </Text>
                    <TextInput
                      style={[styles.input, styles.inputMultiline, { backgroundColor: P.sunken, borderColor: P.edge, color: P.text }]}
                      placeholder={reason === 'other' ? 'Required' : 'Share feedback…'}
                      placeholderTextColor={P.faint}
                      multiline
                      value={details}
                      onChangeText={setDetails}
                      editable={!deleting}
                    />
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.block}>
                <View style={[styles.dangerBox, { borderColor: 'rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.08)' }]}>
                  <Ionicons name="warning" size={18} color="#EF4444" />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.dangerTitle}>This cannot be undone</Text>
                    <Text style={[styles.dangerBody, { color: P.dim }]}>
                      Your account, progress, history, and personal data will be permanently deleted.
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={[styles.label, { color: P.text }]}>
                    Type <Text style={{ color: '#EF4444', fontWeight: '700' }}>DELETE</Text> to confirm
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: P.sunken,
                        borderColor: confirmText === 'DELETE' ? '#EF4444' : P.edge,
                        color: P.text,
                      },
                    ]}
                    placeholder="DELETE"
                    placeholderTextColor={P.faint}
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

          <View style={[styles.footer, { borderTopColor: P.hair }]}>
            {step === 'survey' ? (
              <>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: canContinue ? '#EF4444' : P.sunken }]}
                  onPress={() => setStep('confirm')}
                  disabled={!canContinue || deleting}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.primaryBtnText, { color: canContinue ? '#FFF' : P.faint }]}>Continue</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryBtn, { borderColor: P.edge }]} onPress={handleClose} activeOpacity={0.7}>
                  <Text style={[styles.secondaryBtnText, { color: P.dim }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: canDelete ? '#EF4444' : P.sunken, opacity: deleting ? 0.6 : 1 }]}
                  onPress={handleDelete}
                  disabled={!canDelete || deleting}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.primaryBtnText, { color: canDelete ? '#FFF' : P.faint }]}>
                    {deleting ? 'Deleting…' : 'Permanently Delete Account'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: P.edge }]}
                  onPress={() => { setStep('survey'); setConfirmText(''); }}
                  disabled={deleting}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.secondaryBtnText, { color: P.dim }]}>Back</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 24,
  },
  handleRow: { alignItems: 'center', paddingTop: 14, paddingBottom: 6 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerAccent: { width: 3, height: 28, borderRadius: 2, backgroundColor: '#EF4444' },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  stepLabel: { fontSize: 13 },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  block: { gap: 16 },
  label: { fontSize: 14, fontWeight: '500' },
  reasonList: { gap: 8 },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  chipText: { fontSize: 14, fontWeight: '500' },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top', fontWeight: '400', letterSpacing: 0 },
  dangerBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  dangerTitle: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  dangerBody: { fontSize: 13, lineHeight: 18 },
  footer: { gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  primaryBtn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '700' },
  secondaryBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  secondaryBtnText: { fontSize: 15, fontWeight: '500' },
});
