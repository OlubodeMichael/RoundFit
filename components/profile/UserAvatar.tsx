import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/** Circle diameter: `sm` — home header; `md` — profile hero (matches former inner face). */
export type UserAvatarSize = 'sm' | 'md';

const LETTER_SIZE: Record<UserAvatarSize, number> = {
  sm: 14,
  md: 22,
};

const DIAMETER: Record<UserAvatarSize, number> = {
  sm: 42,
  md: 52,
};

export interface UserAvatarProps {
  avatarUrl: string | null;
  avatarLetter: string;
  accentColor: string;
  fillColor: string;
  size: UserAvatarSize;
  uploading?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Circular avatar: image when `avatarUrl` is set, otherwise gradient initials placeholder.
 */
export function UserAvatar({
  avatarUrl,
  avatarLetter,
  size,
  uploading = false,
  onPress,
  style,
}: UserAvatarProps) {
  const d = DIAMETER[size];
  const r = d / 2;

  const body = (
    <View style={[s.circle, { width: d, height: d, borderRadius: r }]}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[s.image, { width: d, height: d, borderRadius: r }]}
        />
      ) : (
        <LinearGradient
          colors={['#FB923C', '#F97316', '#EA580C']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[s.gradient, { width: d, height: d, borderRadius: r }]}
        >
          <Text style={[s.letter, { fontSize: LETTER_SIZE[size] }]}>
            {avatarLetter}
          </Text>
        </LinearGradient>
      )}
      {uploading && (
        <View style={[s.overlay, { borderRadius: r }]}>
          <Ionicons name="cloud-upload-outline" size={size === 'md' ? 16 : 14} color="#fff" />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={style}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={avatarUrl ? 'Change profile photo' : 'Add profile photo'}
      >
        {body}
      </TouchableOpacity>
    );
  }

  return <View style={style}>{body}</View>;
}

const s = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    resizeMode: 'cover',
  },
  letter: {
    color: '#FFF',
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
