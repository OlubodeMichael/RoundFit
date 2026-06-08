import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useTheme } from '@/hooks/use-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface AnnouncementModalProps {
  visible:       boolean;
  onClose:       () => void;
  icon:          IoniconName;
  iconColor:     string;
  iconBg:        string;
  title:         string;
  description:   string;
  primaryLabel:  string;
  onPrimary?:    () => void;
  dismissLabel?: string;
}

export function AnnouncementModal({
  visible,
  onClose,
  icon,
  iconColor,
  iconBg,
  title,
  description,
  primaryLabel,
  onPrimary,
  dismissLabel = 'Dismiss',
}: AnnouncementModalProps) {
  const { isDark } = useTheme();

  const backdropOp = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(0.88)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOp, {
          toValue: 1, duration: 240, useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1, damping: 20, stiffness: 260, mass: 0.8, useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOp, {
          toValue: 0, duration: 180, useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0, duration: 160, useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.92, duration: 160, useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const bg   = isDark ? '#1C1D23' : '#FFFFFF';
  const hi   = isDark ? '#F4F4F5' : '#111111';
  const lo   = isDark ? '#2A2A32' : '#F0F0F0';
  const mid  = isDark ? '#70707A' : '#999999';
  const edge = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const handlePrimary = () => {
    onPrimary?.();
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.overlay}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[s.backdrop, { opacity: backdropOp }]} />
        </TouchableWithoutFeedback>

        {/* Card */}
        <Animated.View
          style={[
            s.card,
            {
              backgroundColor: bg,
              borderColor:     edge,
              opacity,
              transform:       [{ scale }, { translateY }],
            },
          ]}
        >
          {/* Icon */}
          <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name={icon} size={32} color={iconColor} />
          </View>

          {/* Text */}
          <Text style={[s.title, { color: hi }]}>{title}</Text>
          <Text style={[s.description, { color: mid }]}>{description}</Text>

          {/* Primary CTA */}
          <Pressable
            onPress={handlePrimary}
            style={({ pressed }) => [
              s.primaryBtn,
              { backgroundColor: iconColor, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={s.primaryLabel}>{primaryLabel}</Text>
          </Pressable>

          {/* Dismiss */}
          <Pressable onPress={onClose} hitSlop={10} style={s.dismissBtn}>
            <Text style={[s.dismissLabel, { color: mid }]}>{dismissLabel}</Text>
          </Pressable>

          {/* Close X */}
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={[s.closeBtn, { backgroundColor: lo }]}
          >
            <Ionicons name="close" size={14} color={mid} />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 28,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  card: {
    width:        '100%',
    borderRadius: 28,
    borderWidth:  StyleSheet.hairlineWidth,
    padding:      28,
    alignItems:   'center',
    shadowColor:  '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius:  28,
    elevation:     16,
  },

  iconWrap: {
    width:          72,
    height:         72,
    borderRadius:   24,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   20,
  },

  title: {
    fontFamily:    'Syne_800ExtraBold',
    fontSize:      22,
    letterSpacing: -0.5,
    textAlign:     'center',
    marginBottom:  10,
  },

  description: {
    fontSize:      14,
    fontWeight:    '500',
    lineHeight:    21,
    textAlign:     'center',
    marginBottom:  28,
    paddingHorizontal: 4,
  },

  primaryBtn: {
    width:          '100%',
    paddingVertical: 15,
    borderRadius:   16,
    alignItems:     'center',
    marginBottom:   12,
  },
  primaryLabel: {
    fontSize:   15,
    fontWeight: '800',
    color:      '#fff',
    letterSpacing: -0.2,
  },

  dismissBtn: {
    paddingVertical: 6,
  },
  dismissLabel: {
    fontSize:   13,
    fontWeight: '600',
  },

  closeBtn: {
    position:       'absolute',
    top:            18,
    right:          18,
    width:          28,
    height:         28,
    borderRadius:   14,
    alignItems:     'center',
    justifyContent: 'center',
  },
});
