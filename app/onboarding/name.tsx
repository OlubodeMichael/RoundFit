import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Animated, KeyboardAvoidingView, Platform, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { ProgressBar } from '@/components/onboarding/progress-bar';

export default function NameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const inputRef = useRef<TextInput>(null);

  const [name, setName]   = useState('');
  const [isFocused, setFocus] = useState(false);

  const bg  = isDark ? '#0A0A0A' : '#FAFAF8';
  const hi  = isDark ? '#F5F5F5' : '#111111';
  const mid = isDark ? '#777'    : '#888';
  const lo  = isDark ? '#2A2A2A' : '#E8E3DC';

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
      <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
        <View style={s.progress}>
          <ProgressBar step={3} total={9} onBack={() => router.back()} isDark={isDark} />
        </View>

        <Animated.View style={[s.body, { opacity: fade, transform: [{ translateY: slideY }] }]}>
          <Text style={[s.headline, { color: hi }]}>
            {"What's your\nname?"}
          </Text>
          <Text style={[s.sub, { color: mid }]}>
            {"We'll personalize everything for you."}
          </Text>

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
              onSubmitEditing={() => canContinue && router.push({ pathname: '/onboarding/age-sex', params: { name: name.trim() } })}
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

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={[s.cta, { opacity: canContinue ? 1 : 0.35 }]}
          activeOpacity={0.85}
          disabled={!canContinue}
          onPress={() => router.push({ pathname: '/onboarding/age-sex', params: { name: name.trim() } })}
        >
          <Text style={s.ctaText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, paddingHorizontal: 28 },
  progress: { marginBottom: 8 },

  body:     { gap: 12 },
  headline: { fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 48, marginBottom: 4 },
  sub:      { fontSize: 15, fontWeight: '400', lineHeight: 22 },

  inputWrap:      { marginTop: 36, gap: 0 },
  input:          { fontSize: 38, fontWeight: '700', letterSpacing: -1, paddingVertical: 8, paddingHorizontal: 0 },
  underlineTrack: { height: 1.5, overflow: 'hidden' },
  underlineFill:  { height: 1.5, backgroundColor: '#F97316' },

  preview: { fontSize: 16, fontWeight: '500', marginTop: 16 },

  cta:    {
    backgroundColor: '#F97316', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
