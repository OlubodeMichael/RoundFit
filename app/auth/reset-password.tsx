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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { safeBack } from '@/utils/navigation';
import { publicApiFetch } from '@/utils/api';

// Min length matches backend (auth.controller.ts resetPassword: 8+ chars).
const MIN_PASSWORD_LEN = 8;

export default function ResetPasswordScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();

  const [email,     setEmail]     = useState(emailParam ?? '');
  const [code,      setCode]      = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [showConf,  setShowConf]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState('');
  const [focused,   setFocused]   = useState<'email' | 'code' | 'password' | 'confirm' | null>(null);

  const bg  = isDark ? '#0A0B0F' : '#FAFAF8';
  const hi  = isDark ? '#F4F4F5' : '#111111';
  const mid = isDark ? '#909096' : '#888';
  const lo  = isDark ? '#2A2A32' : '#E8E3DC';

  const fade       = useRef(new Animated.Value(0)).current;
  const slideY     = useRef(new Animated.Value(24)).current;
  const underlineE = useRef(new Animated.Value(0)).current;
  const underlineCd = useRef(new Animated.Value(0)).current;
  const underlineP = useRef(new Animated.Value(0)).current;
  const underlineC = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Animated.timing(underlineE,  { toValue: focused === 'email'    ? 1 : 0, duration: 250, useNativeDriver: false }).start();
    Animated.timing(underlineCd, { toValue: focused === 'code'     ? 1 : 0, duration: 250, useNativeDriver: false }).start();
    Animated.timing(underlineP,  { toValue: focused === 'password' ? 1 : 0, duration: 250, useNativeDriver: false }).start();
    Animated.timing(underlineC,  { toValue: focused === 'confirm'  ? 1 : 0, duration: 250, useNativeDriver: false }).start();
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleReset() {
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < MIN_PASSWORD_LEN) {
      setError(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { ok, body } = await publicApiFetch('/auth/reset-password', {
        method: 'POST',
        body:   JSON.stringify({
          email:        email.trim(),
          code:         code.trim(),
          new_password: password,
        }),
      });
      if (!ok) {
        const msg = typeof body.message === 'string'
          ? body.message
          : typeof body.error === 'string'
            ? body.error
            : 'Something went wrong. Please try again.';
        setError(msg);
        return;
      }
      setDone(true);
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    email.trim().includes('@') &&
    code.trim().length >= 4 &&
    password.length >= MIN_PASSWORD_LEN &&
    confirm.length >= 1 &&
    !loading;

  if (done) {
    return (
      <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]}>
        <View style={s.centeredWrap}>
          <View style={[s.stateIcon, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
            <Ionicons name="checkmark-circle-outline" size={40} color="#22C55E" />
          </View>
          <Text style={[s.headline, { color: hi, textAlign: 'center' }]}>Password{'\n'}updated.</Text>
          <Text style={[s.sub, { color: mid, textAlign: 'center' }]}>
            Your password has been changed.{'\n'}Log in with your new password.
          </Text>
          <TouchableOpacity
            style={[s.cta, { marginTop: 8 }]}
            activeOpacity={0.85}
            onPress={() => router.replace('/auth/auth-options')}
          >
            <Text style={s.ctaText}>Log in  →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ flex: 1, backgroundColor: bg }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]}>

          <TouchableOpacity style={s.backBtn} onPress={() => safeBack(router, '/auth/forgot-password')} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={hi} />
          </TouchableOpacity>

          <Animated.View style={[s.headBlock, { opacity: fade, transform: [{ translateY: slideY }] }]}>
            <Text style={[s.headline, { color: hi }]}>Enter your{'\n'}reset code.</Text>
            <Text style={[s.sub, { color: mid }]}>
              Check your email for a 6-digit code, then choose a new password ({MIN_PASSWORD_LEN}+ characters).
            </Text>
          </Animated.View>

          <Animated.View style={[s.form, { opacity: fade }]}>
            {/* Email */}
            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: mid }]}>Email</Text>
              <View style={s.fieldInner}>
                <TextInput
                  style={[s.fieldInput, { color: hi }]}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(''); }}
                  placeholder="you@example.com"
                  placeholderTextColor={lo}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                />
              </View>
              <View style={[s.underlineTrack, { backgroundColor: lo }]}>
                <Animated.View style={[s.underlineFill, {
                  width: underlineE.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]} />
              </View>
            </View>

            {/* Reset code */}
            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: mid }]}>Reset code</Text>
              <View style={s.fieldInner}>
                <TextInput
                  style={[s.fieldInput, { color: hi, letterSpacing: 6 }]}
                  value={code}
                  onChangeText={(v) => { setCode(v.replace(/\s/g, '')); setError(''); }}
                  placeholder="123456"
                  placeholderTextColor={lo}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  maxLength={6}
                  onFocus={() => setFocused('code')}
                  onBlur={() => setFocused(null)}
                />
              </View>
              <View style={[s.underlineTrack, { backgroundColor: lo }]}>
                <Animated.View style={[s.underlineFill, {
                  width: underlineCd.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]} />
              </View>
            </View>

            {/* New password */}
            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: mid }]}>New password</Text>
              <View style={s.fieldInner}>
                <TextInput
                  style={[s.fieldInput, { color: hi }]}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(''); }}
                  placeholder={`${MIN_PASSWORD_LEN}+ characters`}
                  placeholderTextColor={lo}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowPass(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={mid} />
                </TouchableOpacity>
              </View>
              <View style={[s.underlineTrack, { backgroundColor: lo }]}>
                <Animated.View style={[s.underlineFill, {
                  width: underlineP.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]} />
              </View>
            </View>

            {/* Confirm password */}
            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: mid }]}>Confirm password</Text>
              <View style={s.fieldInner}>
                <TextInput
                  style={[s.fieldInput, { color: hi }]}
                  value={confirm}
                  onChangeText={(v) => { setConfirm(v); setError(''); }}
                  placeholder="Repeat your password"
                  placeholderTextColor={lo}
                  secureTextEntry={!showConf}
                  autoCapitalize="none"
                  onFocus={() => setFocused('confirm')}
                  onBlur={() => setFocused(null)}
                  onSubmitEditing={canSubmit ? handleReset : undefined}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  onPress={() => setShowConf(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name={showConf ? 'eye-off-outline' : 'eye-outline'} size={18} color={mid} />
                </TouchableOpacity>
              </View>
              <View style={[s.underlineTrack, { backgroundColor: lo }]}>
                <Animated.View style={[s.underlineFill, {
                  width: underlineC.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  backgroundColor: confirm.length > 0 && confirm !== password ? '#EF4444' : '#F97316',
                }]} />
              </View>
            </View>
          </Animated.View>

          <View style={{ flex: 1 }} />

          <Animated.View style={[s.bottom, { opacity: fade }]}>
            {!!error && (
              <TouchableOpacity onPress={() => setError('')} activeOpacity={0.8}>
                <Text style={s.errorText}>{error}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.cta, { opacity: canSubmit ? 1 : 0.35 }]}
              activeOpacity={0.85}
              disabled={!canSubmit}
              onPress={handleReset}
            >
              <Text style={s.ctaText}>{loading ? 'Saving…' : 'Set new password  →'}</Text>
            </TouchableOpacity>
          </Animated.View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, paddingHorizontal: 28, gap: 28 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -4 },

  headBlock: { gap: 10 },
  headline:  { fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 48 },
  sub:       { fontSize: 15, fontWeight: '400', lineHeight: 22 },

  form:       { gap: 24 },
  fieldWrap:  { gap: 0 },
  fieldInner: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  fieldInput: { flex: 1, fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },

  underlineTrack: { height: 1.5, overflow: 'hidden' },
  underlineFill:  { height: 1.5, backgroundColor: '#F97316' },

  centeredWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  stateIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center', lineHeight: 18 },
  bottom:    { gap: 14 },
  cta: {
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
