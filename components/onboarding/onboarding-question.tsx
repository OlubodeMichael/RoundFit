import { Platform, type StyleProp, StyleSheet, Text, type TextStyle } from 'react-native';

interface Props {
  before?: string;
  emphasis: string;
  after?: string;
  style?: StyleProp<TextStyle>;
}

/** Editorial question heading shared by every onboarding step. */
export function OnboardingQuestion({ before = '', emphasis, after = '', style }: Props) {
  return (
    <Text style={[s.question, style]} accessibilityRole="header">
      {before}<Text style={s.emphasis}>{emphasis}</Text>{after}
    </Text>
  );
}

const s = StyleSheet.create({
  question: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 38,
    lineHeight: 43,
    letterSpacing: -1.8,
    color: '#111111',
  },
  emphasis: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontStyle: 'italic',
    fontWeight: '400',
    letterSpacing: -1.4,
  },
});
