import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { MODAL_GLASS, modalGlassColors } from '@/components/ui/modal-glass-theme';

interface ModalGlassSurfaceProps {
  isDark: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
}

export function ModalGlassSurface({
  isDark,
  children,
  style,
  borderRadius = MODAL_GLASS.SHEET_RADIUS,
}: ModalGlassSurfaceProps) {
  const colors = modalGlassColors(isDark);
  const radiusStyle = { borderRadius, overflow: 'hidden' as const };

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={isDark ? MODAL_GLASS.BLUR_INTENSITY_DARK : MODAL_GLASS.BLUR_INTENSITY_LIGHT}
        tint={isDark ? 'dark' : 'light'}
        style={[s.fill, radiusStyle, style, { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}
      >
        <View style={[s.fill, s.tint, { backgroundColor: colors.overlay }]}>
          {children}
        </View>
      </BlurView>
    );
  }

  return (
    <View
      style={[
        s.fill,
        radiusStyle,
        style,
        {
          backgroundColor: colors.androidBg,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  fill: {
    flex: 1,
  },
  tint: {
    flex: 1,
  },
});
