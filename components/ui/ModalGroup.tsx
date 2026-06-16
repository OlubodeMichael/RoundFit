import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { modalGlassColors } from '@/components/ui/modal-glass-theme';
import { useTheme } from '@/hooks/use-theme';

interface ModalGroupProps {
  children: React.ReactNode;
  /** Uppercase section label shown above the group. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function ModalGroup({ children, label, style }: ModalGroupProps) {
  const { isDark } = useTheme();
  const colors = modalGlassColors(isDark);

  return (
    <View style={style}>
      {label ? (
        <Text style={[s.label, { color: colors.mid }]}>{label.toUpperCase()}</Text>
      ) : null}
      <View style={[s.group, { backgroundColor: colors.groupBg }]}>
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  group: {
    borderRadius: 16,
    overflow: 'hidden',
  },
});
