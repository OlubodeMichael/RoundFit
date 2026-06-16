import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppModal } from '@/components/ui/AppModal';
import { useToast } from '@/components/ui/Toast';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/utils/api';

const O = '#F97316';

const RULES = [
  { key: 'len',     label: 'At least 8 characters',   test: (p: string) => p.length >= 8 },
  { key: 'upper',   label: 'One uppercase letter',     test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower',   label: 'One lowercase letter',     test: (p: string) => /[a-z]/.test(p) },
  { key: 'number',  label: 'One number',               test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', label: 'One special character',    test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

function passwordValid(p: string) {
  return RULES.every(r => r.test(p));
}

export interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

interface Palette {
  hi: string;
  mid: string;
  lo: string;
  isDark: boolean;
}

function useModalPalette(isDark: boolean): Palette {
  return {
    hi:     isDark ? '#F4F4F5' : '#111111',
    mid:    isDark ? '#909096' : '#6B7280',
    lo:     isDark ? '#2A2A32' : '#EBEBEB',
    isDark,
  };
}

export function ChangePasswordModal({ visible, onClose }: ChangePasswordModalProps) {
  const { isDark } = useTheme();
  const P = useModalPalette(isDark);
  const toast = useToast();

  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showCon, setShowCon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [apiError, setApiError] = useState('');
  const [focused, setFocused] = useState<'current' | 'password' | 'confirm' | null>(null);
  const [touchedNew, setTouchedNew] = useState(false);
  const [touchedCon, setTouchedCon] = useState(false);

  const underlineCur = useRef(new Animated.Value(0)).current;
  const underlineNew = useRef(new Animated.Value(0)).current;
  const underlineCon = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setCurrent('');
      setPassword('');
      setConfirm('');
      setShowCur(false);
      setShowNew(false);
      setShowCon(false);
      setLoading(false);
      setDone(false);
      setApiError('');
      setFocused(null);
      setTouchedNew(false);
      setTouchedCon(false);
    }
  }, [visible]);

  useEffect(() => {
    Animated.timing(underlineCur, { toValue: focused === 'current' ? 1 : 0, duration: 250, useNativeDriver: false }).start();
    Animated.timing(underlineNew, { toValue: focused === 'password' ? 1 : 0, duration: 250, useNativeDriver: false }).start();
    Animated.timing(underlineCon, { toValue: focused === 'confirm' ? 1 : 0, duration: 250, useNativeDriver: false }).start();
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  const newPassValid = passwordValid(password);
  const confirmMatch = confirm === password;
  const mismatch = touchedCon && confirm.length > 0 && !confirmMatch;

  const canSubmit = useMemo(
    () => current.length >= 1 && newPassValid && confirmMatch && !loading,
    [current, newPassValid, confirmMatch, loading],
  );

  function handleClose() {
    if (!loading) onClose();
  }

  async function handleSave() {
    setApiError('');
    setLoading(true);
    try {
      const { ok, body } = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: current, new_password: password }),
      });
      if (!ok) {
        const msg = typeof body.message === 'string' ? body.message : 'Incorrect current password.';
        setApiError(msg);
        toast.error('Could not update password', msg);
      } else {
        setDone(true);
      }
    } catch {
      const msg = 'Network error. Please check your connection.';
      setApiError(msg);
      toast.error('Could not update password', msg);
    } finally {
      setLoading(false);
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
      {done ? (
        <View style={s.successWrap}>
          <View style={s.successIcon}>
            <Ionicons name="checkmark-circle-outline" size={40} color="#22C55E" />
          </View>
          <Text style={[s.successTitle, { color: P.hi }]}>Password updated</Text>
          <Text style={[s.successSub, { color: P.mid }]}>
            Your password has been changed successfully.
          </Text>
          <TouchableOpacity style={s.submitBtn} activeOpacity={0.85} onPress={handleClose}>
            <Text style={s.submitText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.eyebrow}>SECURITY</Text>
                <Text style={[s.modalTitle, { color: P.hi }]}>Change password</Text>
                <Text style={[s.sub, { color: P.mid }]}>
                  Enter your current password, then choose a new one.
                </Text>
              </View>
              <Pressable
                onPress={handleClose}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={10}
                style={[s.closeBtn, { backgroundColor: P.isDark ? '#252530' : '#ECEAE6' }]}
              >
                <Text style={[s.closeBtnText, { color: P.mid }]}>✕</Text>
              </Pressable>
            </View>

            {!!apiError && (
              <TouchableOpacity
                onPress={() => setApiError('')}
                activeOpacity={0.8}
                style={s.errorBanner}
              >
                <Ionicons name="alert-circle" size={15} color="#EF4444" />
                <Text style={s.errorBannerText}>{apiError}</Text>
              </TouchableOpacity>
            )}

            <PasswordField
              label="Current password"
              value={current}
              onChangeText={(v) => { setCurrent(v); setApiError(''); }}
              show={showCur}
              onToggleShow={() => setShowCur(v => !v)}
              underline={underlineCur}
              lo={P.lo} hi={P.hi} mid={P.mid}
              placeholder="Your current password"
              onFocus={() => setFocused('current')}
              onBlur={() => setFocused(null)}
              returnKeyType="next"
            />

            <PasswordField
              label="New password"
              value={password}
              onChangeText={(v) => { setPassword(v); setApiError(''); setTouchedNew(true); }}
              show={showNew}
              onToggleShow={() => setShowNew(v => !v)}
              underline={underlineNew}
              lo={P.lo} hi={P.hi} mid={P.mid}
              placeholder="8+ characters"
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              returnKeyType="next"
            />

            {touchedNew && (
              <View style={s.rulesList}>
                {RULES.map(rule => {
                  const passed = rule.test(password);
                  return (
                    <View key={rule.key} style={s.ruleRow}>
                      <Ionicons
                        name={passed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={14}
                        color={passed ? '#22C55E' : P.mid}
                      />
                      <Text style={[s.ruleText, { color: passed ? '#22C55E' : P.mid }]}>
                        {rule.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            <PasswordField
              label="Confirm new password"
              value={confirm}
              onChangeText={(v) => { setConfirm(v); setApiError(''); setTouchedCon(true); }}
              show={showCon}
              onToggleShow={() => setShowCon(v => !v)}
              underline={underlineCon}
              lo={P.lo} hi={P.hi} mid={P.mid}
              placeholder="Repeat new password"
              onFocus={() => setFocused('confirm')}
              onBlur={() => { setFocused(null); setTouchedCon(true); }}
              mismatch={mismatch}
              returnKeyType="done"
              onSubmitEditing={canSubmit ? handleSave : undefined}
            />

            {mismatch && (
              <Text style={s.inlineError}>Passwords do not match.</Text>
            )}
          </ScrollView>

          <View style={[s.footer, { borderTopColor: P.lo }]}>
            <TouchableOpacity
              style={[s.cancelBtn, { borderColor: P.lo }]}
              onPress={handleClose}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={[s.cancelText, { color: P.hi }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
              onPress={handleSave}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Text style={s.submitText}>Update password</Text>
              }
            </TouchableOpacity>
          </View>
        </>
      )}
    </AppModal>
  );
}

interface PasswordFieldProps {
  label:            string;
  value:            string;
  onChangeText:     (v: string) => void;
  show:             boolean;
  onToggleShow:     () => void;
  underline:        Animated.Value;
  lo:               string;
  hi:               string;
  mid:              string;
  placeholder:      string;
  onFocus:          () => void;
  onBlur:           () => void;
  mismatch?:        boolean;
  returnKeyType?:   'done' | 'next';
  onSubmitEditing?: () => void;
}

function PasswordField({
  label, value, onChangeText, show, onToggleShow,
  underline, lo, hi, mid, placeholder,
  onFocus, onBlur, mismatch, returnKeyType, onSubmitEditing,
}: PasswordFieldProps) {
  return (
    <View style={s.fieldWrap}>
      <Text style={[s.fieldLabel, { color: mid }]}>{label}</Text>
      <View style={s.fieldInner}>
        <TextInput
          style={[s.fieldInput, { color: hi }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={lo}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={onFocus}
          onBlur={onBlur}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
        />
        <TouchableOpacity onPress={onToggleShow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={mid} />
        </TouchableOpacity>
      </View>
      <View style={[s.underlineTrack, { backgroundColor: lo }]}>
        <Animated.View
          style={[s.underlineFill, {
            backgroundColor: mismatch ? '#EF4444' : O,
            width: underline.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: O,
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 26,
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.10)',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    lineHeight: 19,
  },
  fieldWrap: { gap: 0 },
  fieldInner: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  fieldInput: { flex: 1, fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  underlineTrack: { height: 1.5, overflow: 'hidden' },
  underlineFill: { height: 1.5 },
  rulesList: { gap: 8, paddingLeft: 2, marginTop: -8 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleText: { fontSize: 13, fontWeight: '500' },
  inlineError: { fontSize: 13, color: '#EF4444', fontWeight: '500', marginTop: -12 },
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
  cancelText: { fontSize: 15, fontWeight: '700' },
  submitBtn: {
    flex: 1.4,
    height: 52,
    borderRadius: 14,
    backgroundColor: O,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 16,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  successTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 24,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  successSub: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
});
