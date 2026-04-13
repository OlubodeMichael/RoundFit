import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Animated, Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ name: string; goal: string }>();
  const { isDark } = useTheme();

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

  const canSubmit = email.trim().length > 4 && password.length >= 6;
  const firstName = params.name || 'there';

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
              <Text style={[s.fieldLabel, { color: mid }]}>Password</Text>
              <View style={s.fieldInner}>
                <TextInput
                  style={[s.fieldInput, { color: hi }]}
                  value={password}
                  onChangeText={setPassword}
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
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={s.ctaText}>Create account  →</Text>
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
