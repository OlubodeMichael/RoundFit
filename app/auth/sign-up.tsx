import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Animated, Easing,
  ActivityIndicator, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { usePostHog } from 'posthog-react-native';
import {
  hasActiveUserSession,
  type AuthError,
} from '@/context/auth-context';
import { buildOnboardingProfile } from '@/utils/onboarding-profile';
import { safeBack } from '@/utils/navigation';
import { useSheetPresentation } from '@/hooks/use-sheet-presentation';

const ERROR_LABELS: Record<AuthError, string> = {
  EMAIL_IN_USE:        'An account with this email already exists.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  API_KEY_INVALID:     'App configuration error. Please update the app.',
  WEAK_PASSWORD:       'Password must be at least 8 characters.',
  INVALID_EMAIL:       'Please enter a valid email address.',
  OAUTH_FAILED:        'Sign in with Google or Apple failed. Please try again.',
  UNKNOWN:             'Something went wrong. Please try again.',
};

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Presented as a modal, so the window's status-bar inset would show up as a
  // phantom gap above the header. `topInset` is 0 inside a sheet.
  const { presentedAsSheet, topInset } = useSheetPresentation();
  const params = useLocalSearchParams<{
    name: string; age: string; sex: string;
    height: string; weight: string;
    goal: string; activity: string; unit: string;
  }>();
  const { isDark } = useTheme();
  const { signUp, profileSetupPending, isLoading, status, user, error, clearError } = useAuth();
  const posthog = usePostHog();

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

  const fade   = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (profileSetupPending) {
      safeBack(router, { pathname: '/auth/sign-up-options', params });
    }
  }, [profileSetupPending, params, router]);

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

  useEffect(() => {
    if (hasActiveUserSession(status, user)) router.replace('/(tabs)');
  }, [status, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = email.trim().length > 4 && password.length >= 8 && !isLoading;
  const firstName = params.name || 'there';

  async function handleSignUp() {
    if (!canSubmit) return;
    clearError();

    try {
      const success = await signUp(email.trim(), password, buildOnboardingProfile(params));
      if (!success) return;
      posthog.identify(email.trim(), {
        $set: { email: email.trim(), name: params.name ?? '', goal: params.goal ?? '' },
        $set_once: { sign_up_date: new Date().toISOString() },
      });
      posthog.capture('user_signed_up', {
        method: 'email',
        goal: params.goal ?? null,
        activity: params.activity ?? null,
        sex: params.sex ?? null,
      });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      posthog.capture('$exception', {
        $exception_list: [{ type: e.name, value: e.message, stacktrace: { type: 'raw', frames: e.stack ?? '' } }],
        $exception_source: 'sign_up',
      });
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ flex: 1, backgroundColor: bg }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.root, { paddingTop: topInset + 16, paddingBottom: insets.bottom + 28 }]}>

          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: lo }]}
            onPress={() => safeBack(router, { pathname: '/onboarding/reveal', params })}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={presentedAsSheet ? 'Close' : 'Go back'}
          >
            <Ionicons name={presentedAsSheet ? 'close' : 'chevron-back'} size={20} color={hi} />
          </TouchableOpacity>

          <Animated.View style={[s.headBlock, { opacity: fade, transform: [{ translateY: slideY }] }]}>
            <Text style={[s.headline, { color: hi }]}>
              Create your account,{'\n'}
              <Text style={{ color: '#F97316' }}>{firstName}</Text>
            </Text>
            <Text style={[s.sub, { color: mid }]}>
              Enter your email and password — we will save your plan automatically.
            </Text>
          </Animated.View>

          <Animated.View style={[s.form, { opacity: fade }]}>
            {error && (
              <TouchableOpacity style={s.errorBanner} onPress={clearError} activeOpacity={0.8}>
                <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                <Text style={s.errorText}>{ERROR_LABELS[error]}</Text>
              </TouchableOpacity>
            )}

            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: mid }]}>Email</Text>
              <View style={s.fieldInner}>
                <TextInput
                  style={[s.fieldInput, { color: hi }]}
                  value={email}
                  onChangeText={t => { setEmail(t); if (error) clearError(); }}
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

            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: mid }]}>Password</Text>
              <View style={s.fieldInner}>
                <TextInput
                  style={[s.fieldInput, { color: hi }]}
                  value={password}
                  onChangeText={t => { setPassword(t); if (error) clearError(); }}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={lo}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  onSubmitEditing={canSubmit ? handleSignUp : undefined}
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

          <Animated.View style={[s.bottom, { opacity: fade }]}>
            <TouchableOpacity
              style={[s.cta, { opacity: canSubmit ? 1 : 0.35 }]}
              activeOpacity={0.85}
              disabled={!canSubmit}
              onPress={handleSignUp}
            >
              <Text style={s.ctaText}>
                {isLoading ? 'Creating account…' : 'Create account  →'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

        </View>
      </ScrollView>

      <Modal visible={isLoading} transparent animationType="fade">
        <View style={[s.loadingOverlay, { backgroundColor: isDark ? 'rgba(10,11,15,0.94)' : 'rgba(250,250,248,0.94)' }]}>
          <ActivityIndicator size="large" color="#F97316" />
          <Text style={[s.loadingText, { color: hi }]}>Creating your account…</Text>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, paddingHorizontal: 28, gap: 32 },
  backBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headBlock: { gap: 10 },
  headline:  { fontSize: 36, fontWeight: '900', letterSpacing: -1.5, lineHeight: 42 },
  sub:       { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  form:      { gap: 28 },
  fieldWrap: { gap: 0 },
  fieldInner: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  fieldInput: { flex: 1, fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },
  underlineTrack: { height: 1.5, overflow: 'hidden' },
  underlineFill:  { height: 1.5, backgroundColor: '#F97316' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.07)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
  },
  errorText: { flex: 1, fontSize: 13, color: '#EF4444', fontWeight: '500' },
  bottom: { gap: 14 },
  cta: {
    backgroundColor: '#111111', borderRadius: 14, paddingVertical: 18, alignItems: 'center',
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  loadingOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { fontSize: 15, fontWeight: '600' },
});
