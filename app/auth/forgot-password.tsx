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

export default function ForgotPasswordScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { email: prefill } = useLocalSearchParams<{ email?: string }>();

  const [email,   setEmail]   = useState(prefill ?? '');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [focused, setFocused] = useState(false);

  const bg  = isDark ? '#0A0B0F' : '#FAFAF8';
  const hi  = isDark ? '#F4F4F5' : '#111111';
  const mid = isDark ? '#909096' : '#888';
  const lo  = isDark ? '#2A2A32' : '#E8E3DC';

  const fade      = useRef(new Animated.Value(0)).current;
  const slideY    = useRef(new Animated.Value(24)).current;
  const underline = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Animated.timing(underline, {
      toValue: focused ? 1 : 0, duration: 250, useNativeDriver: false,
    }).start();
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    setError('');
    setLoading(true);
    try {
      const { ok, body } = await publicApiFetch('/auth/forgot-password', {
        method: 'POST',
        body:   JSON.stringify({ email: email.trim() }),
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
      // Backend always returns 200 for security (doesn't leak whether the
      // email exists). Push the user to the code-entry screen regardless.
      router.replace({
        pathname: '/auth/reset-password',
        params: { email: email.trim() },
      });
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = email.trim().includes('@') && !loading;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ flex: 1, backgroundColor: bg }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]}>

          <TouchableOpacity style={s.backBtn} onPress={() => safeBack(router, '/auth/email-login')} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={hi} />
          </TouchableOpacity>

          <Animated.View style={[s.headBlock, { opacity: fade, transform: [{ translateY: slideY }] }]}>
            <Text style={[s.headline, { color: hi }]}>Forgot your{'\n'}password?</Text>
            <Text style={[s.sub, { color: mid }]}>Enter your email and we'll send you a 6-digit reset code.</Text>
          </Animated.View>

          <Animated.View style={[s.form, { opacity: fade }]}>
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
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onSubmitEditing={canSubmit ? handleSend : undefined}
                  returnKeyType="send"
                />
              </View>
              <View style={[s.underlineTrack, { backgroundColor: lo }]}>
                <Animated.View
                  style={[s.underlineFill, {
                    width: underline.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
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
              onPress={handleSend}
            >
              <Text style={s.ctaText}>{loading ? 'Sending…' : 'Send reset code  →'}</Text>
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

  form:      { gap: 32 },
  fieldWrap: { gap: 0 },
  fieldInner: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  fieldInput: { flex: 1, fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },

  underlineTrack: { height: 1.5, overflow: 'hidden' },
  underlineFill:  { height: 1.5, backgroundColor: '#F97316' },

  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(249,115,22,0.12)',
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
