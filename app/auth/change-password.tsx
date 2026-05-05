import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { apiFetch } from '@/utils/api';
import { useToast } from '@/components/ui/Toast';

// ── Validation ─────────────────────────────────────────────────────────────

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

// ── Screen ─────────────────────────────────────────────────────────────────

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const toast  = useToast();

  const [current,  setCurrent]  = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [showCon,  setShowCon]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [apiError, setApiError] = useState('');
  const [focused,  setFocused]  = useState<'current' | 'password' | 'confirm' | null>(null);
  // Show rules only after the user has started typing the new password
  const [touchedNew, setTouchedNew] = useState(false);
  const [touchedCon, setTouchedCon] = useState(false);

  const bg  = isDark ? '#0A0B0F' : '#FAFAF8';
  const hi  = isDark ? '#F4F4F5' : '#111111';
  const mid = isDark ? '#909096' : '#888';
  const lo  = isDark ? '#2A2A32' : '#E8E3DC';

  const fade         = useRef(new Animated.Value(0)).current;
  const slideY       = useRef(new Animated.Value(24)).current;
  const underlineCur = useRef(new Animated.Value(0)).current;
  const underlineNew = useRef(new Animated.Value(0)).current;
  const underlineCon = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Animated.timing(underlineCur, { toValue: focused === 'current'  ? 1 : 0, duration: 250, useNativeDriver: false }).start();
    Animated.timing(underlineNew, { toValue: focused === 'password' ? 1 : 0, duration: 250, useNativeDriver: false }).start();
    Animated.timing(underlineCon, { toValue: focused === 'confirm'  ? 1 : 0, duration: 250, useNativeDriver: false }).start();
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  const newPassValid  = passwordValid(password);
  const confirmMatch  = confirm === password;
  const mismatch      = touchedCon && confirm.length > 0 && !confirmMatch;

  const canSubmit = useMemo(
    () => current.length >= 1 && newPassValid && confirmMatch && !loading,
    [current, newPassValid, confirmMatch, loading],
  );

  async function handleSave() {
    setApiError('');
    setLoading(true);
    try {
      const { ok, body } = await apiFetch('/auth/change-password', {
        method: 'POST',
        body:   JSON.stringify({ current_password: current, new_password: password }),
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

  // ── Success state ────────────────────────────────────────────────────────

  if (done) {
    return (
      <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]}>
        <View style={s.centeredWrap}>
          <View style={[s.stateIcon, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
            <Ionicons name="checkmark-circle-outline" size={40} color="#22C55E" />
          </View>
          <Text style={[s.headline, { color: hi, textAlign: 'center' }]}>Password{'\n'}updated.</Text>
          <Text style={[s.sub, { color: mid, textAlign: 'center' }]}>
            Your password has been changed successfully.
          </Text>
          <TouchableOpacity style={[s.cta, { marginTop: 8 }]} activeOpacity={0.85} onPress={() => router.back()}>
            <Text style={s.ctaText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ flex: 1, backgroundColor: bg }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]}>

          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={hi} />
          </TouchableOpacity>

          <Animated.View style={[s.headBlock, { opacity: fade, transform: [{ translateY: slideY }] }]}>
            <Text style={[s.headline, { color: hi }]}>Change{'\n'}password.</Text>
            <Text style={[s.sub, { color: mid }]}>Enter your current password then choose a new one.</Text>
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
          </Animated.View>

          <Animated.View style={[s.form, { opacity: fade }]}>

            {/* Current password */}
            <PasswordField
              label="Current password"
              value={current}
              onChangeText={(v) => { setCurrent(v); setApiError(''); }}
              show={showCur}
              onToggleShow={() => setShowCur(v => !v)}
              underline={underlineCur}
              lo={lo} hi={hi} mid={mid}
              placeholder="Your current password"
              onFocus={() => setFocused('current')}
              onBlur={() => setFocused(null)}
              returnKeyType="next"
            />

            <View style={[s.separator, { backgroundColor: lo }]} />

            {/* New password + rules */}
            <PasswordField
              label="New password"
              value={password}
              onChangeText={(v) => { setPassword(v); setApiError(''); setTouchedNew(true); }}
              show={showNew}
              onToggleShow={() => setShowNew(v => !v)}
              underline={underlineNew}
              lo={lo} hi={hi} mid={mid}
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
                        color={passed ? '#22C55E' : mid}
                      />
                      <Text style={[s.ruleText, { color: passed ? '#22C55E' : mid }]}>
                        {rule.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Confirm password + mismatch error */}
            <PasswordField
              label="Confirm new password"
              value={confirm}
              onChangeText={(v) => { setConfirm(v); setApiError(''); setTouchedCon(true); }}
              show={showCon}
              onToggleShow={() => setShowCon(v => !v)}
              underline={underlineCon}
              lo={lo} hi={hi} mid={mid}
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

          </Animated.View>

          <View style={{ flex: 1 }} />

          <Animated.View style={[s.bottom, { opacity: fade }]}>
            <TouchableOpacity
              style={[s.cta, { opacity: canSubmit ? 1 : 0.35 }]}
              activeOpacity={0.85}
              disabled={!canSubmit}
              onPress={handleSave}
            >
              <Text style={s.ctaText}>{loading ? 'Saving…' : 'Update password  →'}</Text>
            </TouchableOpacity>
          </Animated.View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── PasswordField ──────────────────────────────────────────────────────────

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
            backgroundColor: mismatch ? '#EF4444' : '#F97316',
            width: underline.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]}
        />
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, paddingHorizontal: 28, gap: 40 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -4 },

  headBlock: { gap: 10 },
  headline:  { fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 48 },
  sub:       { fontSize: 15, fontWeight: '400', lineHeight: 22 },

  form:       { gap: 24 },
  separator:  { height: 1, marginVertical: 4 },

  fieldWrap:  { gap: 0 },
  fieldInner: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  fieldInput: { flex: 1, fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },

  underlineTrack: { height: 1.5, overflow: 'hidden' },
  underlineFill:  { height: 1.5 },

  rulesList:  { gap: 8, paddingLeft: 2 },
  ruleRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleText:   { fontSize: 13, fontWeight: '500' },

  inlineError: { fontSize: 13, color: '#EF4444', fontWeight: '500', marginTop: -8 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.10)',
  },
  errorBannerText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#EF4444', lineHeight: 20 },

  centeredWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  stateIcon:    { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },

  bottom:    { gap: 14 },
  cta: {
    backgroundColor: '#F97316', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
