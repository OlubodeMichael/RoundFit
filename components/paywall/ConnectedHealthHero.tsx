import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const connectedHealthOrbit = require('@/assets/paywall/connected-health-orbit.png');

/**
 * Original RoundFit paywall art: separate health signals orbit one shared plan.
 * Kept isolated so future paywall variants can reuse or replace the visual
 * without coupling it to pricing or purchase behavior.
 */
export function ConnectedHealthHero({ height = 220 }: { height?: number }) {
  return (
    <View style={[s.frame, { height }]}>
      <View style={s.glow} />
      <Image
        source={connectedHealthOrbit}
        style={s.image}
        contentFit="contain"
        accessibilityLabel="Nutrition, activity, sleep, hydration, and recovery connected around one plan"
      />
    </View>
  );
}

const s = StyleSheet.create({
  frame: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: '68%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(249, 115, 22, 0.10)',
    transform: [{ scaleX: 1.2 }],
  },
  image: {
    width: '112%',
    height: '112%',
  },
});
