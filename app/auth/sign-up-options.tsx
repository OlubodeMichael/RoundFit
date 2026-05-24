import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { OnboardingSignupAuth } from '@/components/onboarding/OnboardingSignupAuth';
import { safeBack } from '@/utils/navigation';

const BG     = '#F9F8F6';
const INK    = '#111110';
const DIM    = '#8C8880';
const ORANGE = '#F97316';

export default function SignUpOptionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    name: string; age: string; sex: string;
    height: string; weight: string;
    goal: string; activity: string; unit: string;
  }>();

  const fade   = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 460, delay:  40, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 440, delay:  40, easing: ease, useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const name = params.name?.trim() || 'there';

  return (
    <View style={[s.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}>

      <TouchableOpacity
        style={s.backBtn}
        onPress={() => safeBack(router, { pathname: '/onboarding/reveal', params })}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={20} color={INK} />
      </TouchableOpacity>

      <Animated.View style={[s.headBlock, { opacity: fade, transform: [{ translateY: slideY }] }]}>
        <View style={s.badge}>
          <View style={s.badgeDot} />
          <Text style={s.badgeText}>One last step</Text>
        </View>
        <Text style={s.headline}>
          Create your{'\n'}account, <Text style={{ color: ORANGE }}>{name}.</Text>
        </Text>
        <Text style={s.sub}>
          Choose how you would like to sign up. Your plan will be saved automatically.
        </Text>
      </Animated.View>

      <View style={{ flex: 1 }} />

      <OnboardingSignupAuth params={params} animateIn showLoginLink />

    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex:              1,
    backgroundColor:   BG,
    paddingHorizontal: 28,
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    14,
    backgroundColor: '#ECEAE6',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    24,
  },
  headBlock: { gap: 12 },
  badge: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           7,
  },
  badgeDot: {
    width:           7,
    height:          7,
    borderRadius:    3.5,
    backgroundColor: ORANGE,
  },
  badgeText: { fontSize: 13, fontWeight: '700', color: DIM, letterSpacing: 0.1 },
  headline: {
    fontSize:      42,
    fontWeight:    '900',
    letterSpacing: -2,
    lineHeight:    48,
    color:         INK,
  },
  sub: {
    fontSize:   14,
    lineHeight: 21,
    fontWeight: '400',
    color:      DIM,
  },
});
