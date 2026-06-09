import { StyleSheet, Text } from 'react-native';

import type { Palette } from '@/lib/log-theme';

export interface CycleSectionLabelProps {
  P: Palette;
  label: string;
}

export function CycleSectionLabel({ P, label }: CycleSectionLabelProps) {
  return (
    <Text style={[s.label, { color: P.textFaint }]}>
      {label.toUpperCase()}
    </Text>
  );
}

const s = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginLeft: 4,
    marginBottom: 6,
  },
});
