import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type ToastOptions = {
  message: string;
  description?: string;
  kind?: ToastKind;
  /** Milliseconds before auto-dismiss. Defaults to 2600. Set to 0 to disable. */
  duration?: number;
};

type ToastItem = Required<Omit<ToastOptions, 'description' | 'duration'>> & {
  id: string;
  description?: string;
  duration: number;
};

type ToastContextValue = {
  show: (options: ToastOptions) => string;
  success: (message: string, description?: string) => string;
  error: (message: string, description?: string) => string;
  info: (message: string, description?: string) => string;
  warning: (message: string, description?: string) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// ────────────────────────────────────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────────────────────────────────────

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 2600;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastItem = {
        id,
        message:     options.message,
        description: options.description,
        kind:        options.kind ?? 'info',
        duration:    options.duration ?? DEFAULT_DURATION,
      };
      setToasts((prev) => {
        const next = [...prev, item];
        // Cap the stack — drop the oldest if we exceed the max.
        if (next.length > MAX_TOASTS) {
          const dropped = next.slice(0, next.length - MAX_TOASTS);
          dropped.forEach((t) => {
            const timer = timers.current[t.id];
            if (timer) {
              clearTimeout(timer);
              delete timers.current[t.id];
            }
          });
          return next.slice(-MAX_TOASTS);
        }
        return next;
      });
      if (item.duration > 0) {
        timers.current[id] = setTimeout(() => dismiss(id), item.duration);
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const t = timers.current;
    return () => {
      Object.values(t).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      dismiss,
      success: (message, description) => show({ message, description, kind: 'success' }),
      error:   (message, description) => show({ message, description, kind: 'error' }),
      info:    (message, description) => show({ message, description, kind: 'info' }),
      warning: (message, description) => show({ message, description, kind: 'warning' }),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

// ────────────────────────────────────────────────────────────────────────────────
// Viewport
// ────────────────────────────────────────────────────────────────────────────────

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.viewport, { paddingBottom: insets.bottom + 18, paddingTop: insets.top + 12 }]}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Card
// ────────────────────────────────────────────────────────────────────────────────

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { isDark } = useTheme();
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const scale      = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scale,      { toValue: 1, friction: 8,   tension: 120,                     useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, scale]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 0, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 10, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  const tone = TONE[toast.kind];
  const palette = isDark
    ? {
        bg:      '#1C1C1E',
        edge:    'rgba(255,255,255,0.08)',
        text:    '#F4F4F5',
        faint:   'rgba(255,255,255,0.60)',
        shadow:  '#000',
        iconBg:  tone.darkIconBg,
      }
    : {
        bg:      '#FFFFFF',
        edge:    'rgba(0,0,0,0.06)',
        text:    '#0A0A0A',
        faint:   'rgba(10,10,10,0.60)',
        shadow:  '#000',
        iconBg:  tone.lightIconBg,
      };

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: palette.bg,
          borderColor:     palette.edge,
          shadowColor:     palette.shadow,
          opacity,
          transform:       [{ translateY }, { scale }],
        },
      ]}
    >
      <Pressable onPress={handleDismiss} style={styles.pressable}>
        <View style={[styles.iconWrap, { backgroundColor: palette.iconBg }]}>
          <Ionicons name={tone.icon} size={16} color={tone.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={[styles.message, { color: palette.text }]}>
            {toast.message}
          </Text>
          {toast.description ? (
            <Text numberOfLines={2} style={[styles.description, { color: palette.faint }]}>
              {toast.description}
            </Text>
          ) : null}
        </View>
        <View style={[styles.accent, { backgroundColor: tone.accent }]} />
      </Pressable>
    </Animated.View>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Tone table
// ────────────────────────────────────────────────────────────────────────────────

type Tone = {
  icon: IoniconName;
  accent: string;
  lightIconBg: string;
  darkIconBg: string;
};

const TONE: Record<ToastKind, Tone> = {
  success: {
    icon:        'checkmark',
    accent:      '#10B981',
    lightIconBg: 'rgba(16,185,129,0.12)',
    darkIconBg:  'rgba(16,185,129,0.18)',
  },
  error: {
    icon:        'close',
    accent:      '#EF4444',
    lightIconBg: 'rgba(239,68,68,0.12)',
    darkIconBg:  'rgba(239,68,68,0.18)',
  },
  info: {
    icon:        'information',
    accent:      '#3B82F6',
    lightIconBg: 'rgba(59,130,246,0.12)',
    darkIconBg:  'rgba(59,130,246,0.18)',
  },
  warning: {
    icon:        'alert',
    accent:      '#F59E0B',
    lightIconBg: 'rgba(245,158,11,0.12)',
    darkIconBg:  'rgba(245,158,11,0.18)',
  },
};

// ────────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  viewport: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems:     'center',
    paddingHorizontal: 16,
    gap: 8,
    zIndex: 9999,
  },
  card: {
    width:         '100%',
    maxWidth:      460,
    borderRadius:  16,
    borderWidth:   StyleSheet.hairlineWidth,
    overflow:      'hidden',
    ...Platform.select({
      ios: {
        shadowOffset:  { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius:  24,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  pressable: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 14,
    paddingVertical:   12,
    gap:               12,
  },
  iconWrap: {
    width:           30,
    height:          30,
    borderRadius:    999,
    alignItems:      'center',
    justifyContent:  'center',
  },
  message: {
    fontSize:      14.5,
    fontWeight:    '700',
    letterSpacing: -0.1,
  },
  description: {
    marginTop:  2,
    fontSize:   12.5,
    fontWeight: '500',
  },
  accent: {
    width:        3,
    height:       26,
    borderRadius: 2,
  },
});
