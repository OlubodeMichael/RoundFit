import { Text, StyleSheet, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';

interface Props {
  label:     string;
  onPress:   () => void;
  disabled?: boolean;
  style?:    StyleProp<ViewStyle>;
}

export function PrimaryCTA({ label, onPress, disabled = false, style }: Props) {
  return (
    <TouchableOpacity
      style={[s.cta, { opacity: disabled ? 0.35 : 1 }, style]}
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={s.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  cta: {
    backgroundColor: '#111111', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
  },
  label: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
