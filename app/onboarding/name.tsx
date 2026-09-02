import {
  View, StyleSheet, TextInput,
  Animated, KeyboardAvoidingView, Platform, Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { PrimaryCTA } from '@/components/onboarding/primary-cta';
import { OnboardingQuestion } from '@/components/onboarding/onboarding-question';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';

export default function NameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ age: string; sex: string; height: string; weight: string; goal: string; activity: string; unit: string }>();
  const inputRef = useRef<TextInput>(null);

  const [name, setName]   = useState('');
  const [isFocused, setFocus] = useState(false);

  const bg  = '#FAFAF8';
  const hi  = '#111111';
  const mid = '#888';
  const lo  = '#E8E3DC';

  const fade       = useRef(new Animated.Value(0)).current;
  const slideY     = useRef(new Animated.Value(24)).current;
  const underline  = useRef(new Animated.Value(0)).current;
  const previewFade= useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => inputRef.current?.focus(), 500);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Animated.timing(underline, {
      toValue: isFocused ? 1 : 0, duration: 250, useNativeDriver: false,
    }).start();
  }, [isFocused]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Animated.timing(previewFade, {
      toValue: name.trim().length > 0 ? 1 : 0, duration: 300, useNativeDriver: true,
    }).start();
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  const canContinue = name.trim().length > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.root, { backgroundColor: bg }]}>

        <View style={{ flex: 1 }}>
          <Animated.View style={[s.body, { opacity: fade, transform: [{ translateY: slideY }] }]}>
            <OnboardingQuestion before="What should we " emphasis="call you" after="?" />
            <WhyWeAsk
              text="We use this to personalize your plan and dashboard."
              style={s.whyWeAsk}
            />

            {/* Input with animated underline */}
            <View style={s.inputWrap}>
              <TextInput
                ref={inputRef}
                style={[s.input, { color: hi }]}
                value={name}
                onChangeText={setName}
                placeholder="Your first name"
                placeholderTextColor={lo}
                autoCapitalize="words"
                returnKeyType="done"
                onFocus={() => setFocus(true)}
                onBlur={() => setFocus(false)}
                onSubmitEditing={() => canContinue && router.push({ pathname: '/onboarding/health-connect', params: { ...params, name: name.trim() } })}
              />
              {/* Underline */}
              <View style={[s.underlineTrack, { backgroundColor: lo }]}>
                <Animated.View style={[s.underlineFill, {
                  width: underline.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]} />
              </View>
            </View>

            {/* Preview greeting */}
            <Animated.Text style={[s.preview, { color: mid, opacity: previewFade }]}>
              Hey, {name.trim()}
            </Animated.Text>
          </Animated.View>
        </View>

        <PrimaryCTA
          label="Continue"
          disabled={!canContinue}
          onPress={() => router.push({ pathname: '/onboarding/health-connect', params: { ...params, name: name.trim() } })}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, paddingHorizontal: 28 },
  progress: { marginBottom: 8 },

  body:     { gap: 12 },
  headline: { fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 48, marginBottom: 8 },
  whyWeAsk: { marginBottom: 4 },

  inputWrap:      { marginTop: 36, gap: 0 },
  input:          { fontSize: 38, fontWeight: '700', letterSpacing: -1, paddingVertical: 8, paddingHorizontal: 0 },
  underlineTrack: { height: 1.5, overflow: 'hidden' },
  underlineFill:  { height: 1.5, backgroundColor: '#F97316' },

  preview: { fontSize: 16, fontWeight: '500', marginTop: 16 },

  cta:    {
    backgroundColor: '#111111', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
