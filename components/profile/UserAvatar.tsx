import Ionicons from '@expo/vector-icons/Ionicons';
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
 * Circular avatar: image when `avatarUrl` is set, otherwise initials using `accentColor`.
 */
export function UserAvatar({
  avatarUrl,
  avatarLetter,
  accentColor,
  fillColor,
  size,
  uploading = false,
  onPress,
  style,
}: UserAvatarProps) {
  const d = DIAMETER[size];
  const r = d / 2;

  const circleStyle = [
    s.circle,
    {
      width: d,
      height: d,
      borderRadius: r,
      backgroundColor: fillColor,
    },
  ];

  const body = (
    <View style={circleStyle}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[s.image, { width: d, height: d, borderRadius: r }]}
        />
      ) : (
        <Text style={[s.letter, { color: accentColor, fontSize: LETTER_SIZE[size] }]}>
          {avatarLetter}
        </Text>
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
  image: {
    resizeMode: 'cover',
  },
  letter: {
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
