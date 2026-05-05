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

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';

export default function ResetPasswordScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { access_token } = useLocalSearchParams<{ access_token?: string }>();

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [showConf,  setShowConf]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState('');
  const [focused,   setFocused]   = useState<'password' | 'confirm' | null>(null);

  const bg  = isDark ? '#0A0B0F' : '#FAFAF8';
  const hi  = isDark ? '#F4F4F5' : '#111111';
  const mid = isDark ? '#909096' : '#888';
  const lo  = isDark ? '#2A2A32' : '#E8E3DC';

  const fade       = useRef(new Animated.Value(0)).current;
  const slideY     = useRef(new Animated.Value(24)).current;
  const underlineP = useRef(new Animated.Value(0)).current;
  const underlineC = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Animated.timing(underlineP, {
      toValue: focused === 'password' ? 1 : 0, duration: 250, useNativeDriver: false,
    }).start();
    Animated.timing(underlineC, {
      toValue: focused === 'confirm' ? 1 : 0, duration: 250, useNativeDriver: false,
    }).start();
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleReset() {
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!access_token) {
      setError('Invalid or expired reset link. Please request a new one.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ access_token, new_password: password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        setError(typeof data.message === 'string' ? data.message : 'Something went wrong. Please try again.');
      } else {
        setDone(true);
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = password.length >= 8 && confirm.length >= 1 && !!access_token && !loading;

  if (!access_token) {
    return (
      <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.replace('/auth/login')} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={hi} />
        </TouchableOpacity>
        <View style={s.centeredWrap}>
          <View style={[s.stateIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
            <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
          </View>
          <Text style={[s.headline, { color: hi, textAlign: 'center' }]}>Invalid link.</Text>
          <Text style={[s.sub, { color: mid, textAlign: 'center' }]}>
            This reset link is missing or expired.{'\n'}Please request a new one.
          </Text>
          <TouchableOpacity
            style={[s.cta, { marginTop: 8 }]}
            activeOpacity={0.85}
            onPress={() => router.replace('/auth/forgot-password')}
          >
            <Text style={s.ctaText}>Request new link  →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
            onPress={() => router.replace('/auth/login')}
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

          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={hi} />
          </TouchableOpacity>

          <Animated.View style={[s.headBlock, { opacity: fade, transform: [{ translateY: slideY }] }]}>
            <Text style={[s.headline, { color: hi }]}>Set new{'\n'}password.</Text>
            <Text style={[s.sub, { color: mid }]}>Choose a strong password — at least 8 characters.</Text>
          </Animated.View>

          <Animated.View style={[s.form, { opacity: fade }]}>
            {/* New password */}
            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: mid }]}>New password</Text>
              <View style={s.fieldInner}>
                <TextInput
                  style={[s.fieldInput, { color: hi }]}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(''); }}
                  placeholder="8+ characters"
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
                <Animated.View
                  style={[s.underlineFill, {
                    width: underlineP.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  }]}
                />
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
                <Animated.View
                  style={[s.underlineFill, {
                    width: underlineC.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    backgroundColor: confirm.length > 0 && confirm !== password ? '#EF4444' : '#F97316',
                  }]}
                />
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
  root:    { flex: 1, paddingHorizontal: 28, gap: 40 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -4 },

  headBlock: { gap: 10 },
  headline:  { fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 48 },
  sub:       { fontSize: 15, fontWeight: '400', lineHeight: 22 },

  form:       { gap: 32 },
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
