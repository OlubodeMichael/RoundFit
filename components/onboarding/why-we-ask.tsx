import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';

interface WhyWeAskProps {
  text: string;
  style?: StyleProp<TextStyle>;
}

export function WhyWeAsk({ text, style }: WhyWeAskProps) {
  return <Text style={[s.text, style]}>{text}</Text>;
}

const s = StyleSheet.create({
  text: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    color: '#888888',
  },
});
