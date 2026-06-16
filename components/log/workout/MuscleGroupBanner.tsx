import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

import { getExerciseCategoryAppearance } from '@/constants/exercise-category-icons';
import {
  muscleGroupBannerByCategory,
  muscleGroupBannerImage,
} from '@/constants/muscle-group-banners';

const BANNER_HEIGHT_COMPACT = 76;
const BANNER_HEIGHT_LARGE = 92;

interface MuscleGroupBannerProps {
  category: string;
  compact?: boolean;
}

export function MuscleGroupBanner({ category, compact = true }: MuscleGroupBannerProps) {
  const def = muscleGroupBannerByCategory(category);
  const appearance = getExerciseCategoryAppearance(category);
  const bannerHeight = compact ? BANNER_HEIGHT_COMPACT : BANNER_HEIGHT_LARGE;

  if (!def) {
    return (
      <LinearGradient
        colors={[...appearance.gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.banner, { height: bannerHeight }]}
      >
        <View style={s.copy}>
          <Text style={s.label}>{category}</Text>
          <Text style={s.subtitle}>{appearance.subtitle}</Text>
        </View>
        <View style={[s.iconWrap, { backgroundColor: `${appearance.accent}33` }]}>
          <Ionicons name={appearance.icon} size={20} color={appearance.accent} />
        </View>
      </LinearGradient>
    );
  }

  const image = muscleGroupBannerImage(def.id);

  const content = (
    <View style={s.copy}>
      <Text style={s.label}>{def.label}</Text>
      <Text style={s.subtitle}>{def.subtitle}</Text>
    </View>
  );

  if (image) {
    return (
      <ImageBackground
        source={image}
        style={[s.banner, { height: bannerHeight }]}
        imageStyle={s.bannerImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.28)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={s.overlay}
        >
          {content}
          <View style={[s.iconWrap, { backgroundColor: `${def.accent}33` }]}>
            <Ionicons name={def.icon} size={20} color={def.accent} />
          </View>
        </LinearGradient>
      </ImageBackground>
    );
  }

  return (
    <LinearGradient
      colors={[...def.gradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.banner, { height: bannerHeight }]}
    >
      {content}
      <View style={[s.iconWrap, { backgroundColor: `${def.accent}33` }]}>
        <Ionicons name={def.icon} size={20} color={def.accent} />
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  banner: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  bannerImage: { borderRadius: 14 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  copy: { flex: 1, gap: 3 },
  label: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '600',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
});
