import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GoogleLogo } from '@/components/ui/GoogleLogo';
import { useAuth } from '@/hooks/use-auth';

const C = {
  bg:      '#FAFAF8',
  text:    '#111111',
  mid:     '#888888',
  line:    '#E8E3DC',
  accent:  '#F97316',
  accentS: 'rgba(249,115,22,0.07)',
};

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithOAuth, isLoading } = useAuth();

  const fade  = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(20)).current;
  const btnsFade = useRef(new Animated.Value(0)).current;
  const btnsY    = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(fade,      { toValue: 1, duration: 480, delay:  60, useNativeDriver: true }),
      Animated.timing(slideY,    { toValue: 0, duration: 480, delay:  60, easing: ease, useNativeDriver: true }),
      Animated.timing(btnsFade,  { toValue: 1, duration: 480, delay: 220, useNativeDriver: true }),
      Animated.timing(btnsY,     { toValue: 0, duration: 480, delay: 220, easing: ease, useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[s.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>

      {/* Decorative blob */}
      <View style={s.bgBlob} pointerEvents="none" />

      {/* Back */}
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={20} color={C.text} />
      </TouchableOpacity>

      {/* Heading */}
      <Animated.View style={[s.headBlock, { opacity: fade, transform: [{ translateY: slideY }] }]}>
        <View style={s.eyebrowRow}>
          <View style={s.eyebrowDash} />
          <Text style={s.eyebrow}>WELCOME</Text>
        </View>
        <Text style={s.headline}>
          Start your{'\n'}
          <Text style={s.headlineAccent}>round.</Text>
        </Text>
        <Text style={s.sub}>Pick how you'd like to sign in. Takes about 30 seconds.</Text>
      </Animated.View>

      <View style={{ flex: 1 }} />

      {/* Auth options */}
      <Animated.View style={[s.buttons, { opacity: btnsFade, transform: [{ translateY: btnsY }] }]}>

        {/* Apple */}
        <TouchableOpacity
          style={[s.appleBtn, { opacity: isLoading ? 0.6 : 1 }]}
          activeOpacity={0.85}
          disabled={isLoading}
          onPress={() => signInWithOAuth('apple')}
        >
          <Ionicons name="logo-apple" size={20} color="#FFF" />
          <Text style={s.appleBtnText}>Continue with Apple</Text>
        </TouchableOpacity>

        {/* Google */}
        <TouchableOpacity
          style={[s.outlineBtn, { opacity: isLoading ? 0.6 : 1 }]}
          activeOpacity={0.85}
          disabled={isLoading}
          onPress={() => signInWithOAuth('google')}
        >
          <GoogleLogo size={18} />
          <Text style={s.outlineBtnText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Email */}
        <TouchableOpacity
          style={s.outlineBtn}
          activeOpacity={0.85}
          onPress={() => router.push('/auth/email-login')}
        >
          <Ionicons name="mail-outline" size={19} color={C.text} />
          <Text style={s.outlineBtnText}>Continue with email</Text>
        </TouchableOpacity>

        {/* OR divider */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>OR</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Create account */}
        <TouchableOpacity
          style={s.createBtn}
          activeOpacity={0.9}
          onPress={() => router.push('/onboarding/value-hook')}
        >
          <Text style={s.createBtnText}>Create new account  →</Text>
        </TouchableOpacity>

        {/* Legal */}
        <Text style={s.legal}>
          By continuing you agree to our{' '}
          <Text style={s.legalLink}>Terms</Text>
          {' '}and{' '}
          <Text style={s.legalLink}>Privacy Policy</Text>.
        </Text>

      </Animated.View>

    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex:              1,
    backgroundColor:   C.bg,
    paddingHorizontal: 24,
  },

  bgBlob: {
    position:        'absolute',
    top:             -60,
    right:           -70,
    width:           200,
    height:          200,
    borderRadius:    100,
    backgroundColor: C.accentS,
  },

  backBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: '#F0EDE8',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    8,
  },

  headBlock:   { gap: 12 },
  eyebrowRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrowDash: { width: 20, height: 2, backgroundColor: C.accent, borderRadius: 1 },
  eyebrow:     {
    fontFamily:    'Syne_700Bold',
    fontSize:      10,
    letterSpacing: 2.2,
    color:         C.accent,
  },

  headline: {
    fontFamily:    'Syne_800ExtraBold',
    fontSize:      48,
    lineHeight:    54,
    letterSpacing: -2,
    color:         C.text,
  },
  headlineAccent: { color: C.accent },

  sub: {
    fontSize:   15,
    lineHeight: 22,
    color:      C.mid,
  },

  buttons: { gap: 12 },

  appleBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
    backgroundColor: '#000000',
    borderRadius:    14,
    paddingVertical: 17,
  },
  appleBtnText: {
    color:         '#FFF',
    fontFamily:    'Syne_700Bold',
    fontSize:      15,
    letterSpacing: -0.1,
  },

  outlineBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               10,
    backgroundColor:   '#FFFFFF',
    borderRadius:      14,
    borderWidth:       1,
    borderColor:       C.line,
    paddingVertical:   16,
  },
  outlineBtnText: {
    color:         C.text,
    fontFamily:    'Syne_700Bold',
    fontSize:      15,
    letterSpacing: -0.1,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    marginVertical: 2,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.line },
  dividerText: {
    fontSize:      12,
    fontWeight:    '600',
    color:         C.mid,
    letterSpacing: 0.8,
  },

  createBtn: {
    backgroundColor: C.accent,
    borderRadius:    14,
    paddingVertical: 17,
    alignItems:      'center',
    shadowColor:     C.accent,
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.28,
    shadowRadius:    16,
    elevation:       8,
  },
  createBtnText: {
    color:         '#FFF',
    fontFamily:    'Syne_700Bold',
    fontSize:      15,
    letterSpacing: 0.1,
  },

  legal: {
    fontSize:   12,
    color:      C.mid,
    textAlign:  'center',
    lineHeight: 18,
    marginTop:  4,
  },
  legalLink: {
    color:      C.text,
    fontWeight: '600',
  },
});
