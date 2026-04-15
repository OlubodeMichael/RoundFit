import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Animated, Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import type { UserProfile, AuthError } from '@/context/auth-context';

// ── Onboarding ID → API value maps ─────────────────────────────────────────

function mapGoal(raw: string): UserProfile['goal'] {
  const map: Record<string, UserProfile['goal']> = {
    lose:     'lose_weight',
    muscle:   'build_muscle',
    energy:   'boost_energy',
    maintain: 'maintain',
  };
  return map[raw] ?? 'maintain';
}

function mapActivity(raw: string): UserProfile['activityLevel'] {
  const map: Record<string, UserProfile['activityLevel']> = {
    sedentary: 'sedentary',
    light:     'lightly_active',
    moderate:  'moderately_active',
    very:      'very_active',
  };
  return map[raw] ?? 'lightly_active';
}

const ERROR_LABELS: Record<AuthError, string> = {
  EMAIL_IN_USE:        'An account with this email already exists.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  WEAK_PASSWORD:       'Password must be at least 6 characters.',
  INVALID_EMAIL:       'Please enter a valid email address.',
  UNKNOWN:             'Something went wrong. Please try again.',
};

// ── Screen ──────────────────────────────────────────────────────────────────

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    name: string; age: string; sex: string;
    height: string; weight: string;
    goal: string; activity: string; unit: string;
  }>();
  const { isDark } = useTheme();
  const { signUp, isLoading, isAuth, error, clearError } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused]   = useState<'email' | 'password' | null>(null);

  const emailUnderline    = useRef(new Animated.Value(0)).current;
  const passwordUnderline = useRef(new Animated.Value(0)).current;

  const bg  = isDark ? '#0A0A0A' : '#FAFAF8';
  const hi  = isDark ? '#F5F5F5' : '#111111';
  const mid = isDark ? '#777'    : '#888';
  const lo  = isDark ? '#2A2A2A' : '#E8E3DC';

  const fade   = useRef(new Animated.Value(0)).current;
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

  // Navigate once authenticated
  useEffect(() => {
    if (isAuth) router.replace('/(tabs)');
  }, [isAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = email.trim().length > 4 && password.length >= 6 && !isLoading;
  const firstName = params.name || 'there';

  async function handleSignUp() {
    if (!canSubmit) return;
    clearError();

    const profile: Omit<UserProfile, 'id' | 'email' | 'createdAt' | 'tdee' | 'calorieBudget'> = {
      name:          params.name   ?? '',
      age:           params.age    ? Number(params.age)    : 0,
      sex:           (params.sex   === 'female' ? 'female' : 'male') as UserProfile['sex'],
      heightCm:      params.height ? Number(params.height) : 0,
      weightKg:      params.weight ? Number(params.weight) : 0,
      goal:          mapGoal(params.goal ?? ''),
      activityLevel: mapActivity(params.activity ?? ''),
      unit:          (params.unit === 'imperial' ? 'imperial' : 'metric') as UserProfile['unit'],
    };

    await signUp(email.trim(), password, profile);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ flex: 1, backgroundColor: bg }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}>

          {/* Orange accent bar */}
          <View style={s.accentBar} />

          {/* Heading */}
          <Animated.View style={[s.headBlock, { opacity: fade, transform: [{ translateY: slideY }] }]}>
            <Text style={[s.headline, { color: hi }]}>
              Almost there,{'\n'}
              <Text style={{ color: '#F97316' }}>{firstName}</Text>
              {' 🎉'}
            </Text>
            <Text style={[s.sub, { color: mid }]}>
              Create your account to save your plan and start tracking.
            </Text>
          </Animated.View>

          {/* Form */}
          <Animated.View style={[s.form, { opacity: fade }]}>

            {/* Error banner */}
            {error && (
              <TouchableOpacity style={s.errorBanner} onPress={clearError} activeOpacity={0.8}>
                <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                <Text style={s.errorText}>{ERROR_LABELS[error]}</Text>
              </TouchableOpacity>
            )}

            {/* Email */}
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

            {/* Password */}
            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: mid }]}>Password</Text>
              <View style={s.fieldInner}>
                <TextInput
                  style={[s.fieldInput, { color: hi }]}
                  value={password}
                  onChangeText={t => { setPassword(t); if (error) clearError(); }}
                  placeholder="Min. 6 characters"
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
              {password.length > 0 && password.length < 6 && (
                <Text style={s.hint}>At least 6 characters required</Text>
              )}
            </View>

          </Animated.View>

          <View style={{ flex: 1 }} />

          {/* CTA */}
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

            <Text style={[s.legal, { color: mid }]}>
              By continuing you agree to our{' '}
              <Text style={{ color: '#F97316', fontWeight: '600' }}>Terms</Text>
              {' & '}
              <Text style={{ color: '#F97316', fontWeight: '600' }}>Privacy Policy</Text>
            </Text>

            <TouchableOpacity onPress={() => router.push('/auth/login')} activeOpacity={0.7}>
              <Text style={[s.switchLink, { color: mid }]}>
                Already have an account?{'  '}
                <Text style={{ color: '#F97316', fontWeight: '700' }}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, paddingHorizontal: 28, gap: 36 },
  accentBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#F97316' },

  headBlock: { gap: 10 },
  headline:  { fontSize: 38, fontWeight: '900', letterSpacing: -1.5, lineHeight: 44 },
  sub:       { fontSize: 15, fontWeight: '400', lineHeight: 22 },

  form:      { gap: 32 },
  fieldWrap: { gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  fieldInner: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  fieldInput: { flex: 1, fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },

  underlineTrack: { height: 1.5, overflow: 'hidden' },
  underlineFill:  { height: 1.5, backgroundColor: '#F97316' },
  hint:           { fontSize: 12, color: '#EF4444', marginTop: 4 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: '#EF4444', fontWeight: '500' },

  bottom:    { gap: 14 },
  cta:    {
    backgroundColor: '#F97316', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  ctaText:    { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  legal:      { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  switchLink: { fontSize: 13, textAlign: 'center' },
});
