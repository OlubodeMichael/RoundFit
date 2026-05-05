import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Animated, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { signIn, isLoading, error, clearError, isAuth } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused]   = useState<'email' | 'password' | null>(null);

  const emailUnderline    = useRef(new Animated.Value(0)).current;
  const passwordUnderline = useRef(new Animated.Value(0)).current;

  const bg  = isDark ? '#0A0B0F' : '#FAFAF8';
  const hi  = isDark ? '#F4F4F5' : '#111111';
  const mid = isDark ? '#909096' : '#888';
  const lo  = isDark ? '#2A2A32' : '#E8E3DC';

  const fade  = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Animated.timing(emailUnderline, {
      toValue: focused === 'email' ? 1 : 0, duration: 250, useNativeDriver: false,
    }).start();
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Animated.timing(passwordUnderline, {
      toValue: focused === 'password' ? 1 : 0, duration: 250, useNativeDriver: false,
    }).start();
  }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate once auth succeeds
  useEffect(() => {
    if (isAuth) router.replace('/(tabs)');
  }, [isAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = email.trim().length > 4 && password.length >= 6 && !isLoading;

  const ERROR_LABELS: Record<string, string> = {
    INVALID_CREDENTIALS: 'Incorrect email or password.',
    INVALID_EMAIL:       'Please enter a valid email address.',
    UNKNOWN:             'Something went wrong. Please try again.',
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ flex: 1, backgroundColor: bg }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]}>

          {/* Back */}
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={hi} />
          </TouchableOpacity>

          {/* Heading */}
          <Animated.View style={[s.headBlock, { opacity: fade, transform: [{ translateY: slideY }] }]}>
            <Text style={[s.headline, { color: hi }]}>Welcome{'\n'}back.</Text>
            <Text style={[s.sub, { color: mid }]}>Log in to continue your journey.</Text>
          </Animated.View>

          {/* Form */}
          <Animated.View style={[s.form, { opacity: fade }]}>
            {/* Email */}
            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: mid }]}>Email</Text>
              <View style={s.fieldInner}>
                <TextInput
                  style={[s.fieldInput, { color: hi }]}
                  value={email}
                  onChangeText={setEmail}
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
                  width: emailUnderline.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]} />
              </View>
            </View>

            {/* Password */}
            <View style={s.fieldWrap}>
              <View style={s.fieldLabelRow}>
                <Text style={[s.fieldLabel, { color: mid }]}>Password</Text>
                <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/auth/forgot-password')}>
                  <Text style={s.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <View style={s.fieldInner}>
                <TextInput
                  style={[s.fieldInput, { color: hi }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
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
                  width: passwordUnderline.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]} />
              </View>
            </View>
          </Animated.View>

          <View style={{ flex: 1 }} />

          {/* CTA */}
          <Animated.View style={[s.bottom, { opacity: fade }]}>
            {error && ERROR_LABELS[error] && (
              <TouchableOpacity onPress={clearError} activeOpacity={0.8}>
                <Text style={s.errorText}>{ERROR_LABELS[error]}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[s.cta, { opacity: canSubmit ? 1 : 0.35 }]}
              activeOpacity={0.85}
              disabled={!canSubmit}
              onPress={() => signIn(email.trim(), password)}
            >
              <Text style={s.ctaText}>{isLoading ? 'Logging in…' : 'Log in  →'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/onboarding/value-hook')} activeOpacity={0.7}>
              <Text style={[s.switchLink, { color: mid }]}>
                New here?{'  '}
                <Text style={{ color: '#F97316', fontWeight: '700' }}>Get started</Text>
              </Text>
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
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  fieldInner: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  fieldInput: { flex: 1, fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },
  forgotText: { fontSize: 13, fontWeight: '600', color: '#F97316' },

  underlineTrack: { height: 1.5, overflow: 'hidden' },
  underlineFill:  { height: 1.5, backgroundColor: '#F97316' },

  errorText:  { fontSize: 13, color: '#EF4444', textAlign: 'center', lineHeight: 18 },
  bottom:     { gap: 14 },
  cta:    {
    backgroundColor: '#F97316', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  ctaText:    { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  switchLink: { fontSize: 13, textAlign: 'center' },
});
