import { Image, StyleSheet, Text, View } from 'react-native';

import { badgeImage } from '@/constants/badges';

const IMAGE_FILL_RATIO = 0.92;
const DEFAULT_SIZE = 90;
const LOCKED_OPACITY = 0.38;
const LOCKED_GREY_OVERLAY = 'rgba(140, 140, 150, 0.32)';

interface BadgeArtProps {
  badgeId: string;
  icon: string;
  earned: boolean;
  size?: number;
  backgroundColor?: string;
  /** Share of the circle the artwork occupies. Defaults to 0.92. */
  imageFillRatio?: number;
}

export function BadgeArt({
  badgeId,
  icon,
  earned,
  size = DEFAULT_SIZE,
  backgroundColor,
  imageFillRatio = IMAGE_FILL_RATIO,
}: BadgeArtProps) {
  const image = badgeImage(badgeId);
  const radius = size / 2;
  const imageSize = Math.round(size * imageFillRatio);

  return (
    <View
      style={[
        s.wrap,
        { width: size, height: size, borderRadius: radius, backgroundColor },
      ]}
    >
      {image ? (
        <Image
          source={image}
          style={[
            { width: imageSize, height: imageSize },
            !earned && { opacity: LOCKED_OPACITY },
          ]}
          resizeMode="contain"
        />
      ) : (
        <Text
          style={[
            s.emoji,
            { fontSize: size * 0.5 },
            !earned && { opacity: LOCKED_OPACITY },
          ]}
        >
          {icon}
        </Text>
      )}

      {!earned && (
        <View style={[s.greyOverlay, { borderRadius: radius }]} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emoji: { lineHeight: undefined },
  greyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: LOCKED_GREY_OVERLAY,
  },
});
