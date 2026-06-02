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

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type ToastOptions = {
  message: string;
  description?: string;
  kind?: ToastKind;
  /** Milliseconds before auto-dismiss. Defaults to 4000. Set to 0 to disable. */
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

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 4000;
const ENTER_MS = 280;
const EXIT_MS = 180;

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
        message: options.message,
        description: options.description,
        kind: options.kind ?? 'info',
        duration: options.duration ?? DEFAULT_DURATION,
      };
      setToasts((prev) => {
        const next = [...prev, item];
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
      error: (message, description) => show({ message, description, kind: 'error' }),
      info: (message, description) => show({ message, description, kind: 'info' }),
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

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

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
      style={[
        s.viewport,
        { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 12 },
      ]}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </View>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: ENTER_MS + 40,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 9,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, scale]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: EXIT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -12,
        duration: EXIT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.96,
        duration: EXIT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  };

  const tone = TONE[toast.kind];
  const shell = isDark
    ? {
        bg: '#1A1B20',
        edge: 'rgba(255,255,255,0.10)',
        text: '#F4F4F5',
        faint: 'rgba(255,255,255,0.62)',
        shadow: '#000',
        shadowOpacity: 0.38,
      }
    : {
        bg: '#FFFFFF',
        edge: 'rgba(15,23,42,0.08)',
        text: '#09090B',
        faint: '#71717A',
        shadow: '#0F172A',
        shadowOpacity: 0.1,
      };

  return (
    <Animated.View
      style={[
        s.card,
        {
          backgroundColor: shell.bg,
          borderColor: shell.edge,
          shadowColor: shell.shadow,
          shadowOpacity: shell.shadowOpacity,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[s.tintWash, { backgroundColor: tone.wash }]}
      />
      <Pressable
        onPress={handleDismiss}
        style={({ pressed }) => [s.pressable, pressed && s.pressablePressed]}
        accessibilityRole="button"
        accessibilityLabel={`Dismiss: ${toast.message}`}
      >
        <View style={[s.iconRing, { backgroundColor: tone.iconSoft }]}>
          <View style={[s.iconBox, { backgroundColor: tone.accent }]}>
            <Ionicons name={tone.icon} size={16} color="#FFF" />
          </View>
        </View>

        <View style={s.copy}>
          <Text numberOfLines={2} style={[s.message, { color: shell.text }]}>
            {toast.message}
          </Text>
          {toast.description ? (
            <Text numberOfLines={2} style={[s.description, { color: shell.faint }]}>
              {toast.description}
            </Text>
          ) : null}
        </View>

        <View style={[s.dismissHit, { backgroundColor: tone.iconSoft }]}>
          <Ionicons name="close" size={14} color={tone.accent} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

type Tone = {
  icon: IoniconName;
  accent: string;
  iconSoft: string;
  wash: string;
};

const TONE: Record<ToastKind, Tone> = {
  success: {
    icon: 'checkmark',
    accent: '#10B981',
    iconSoft: 'rgba(16,185,129,0.14)',
    wash: 'rgba(16,185,129,0.07)',
  },
  error: {
    icon: 'close',
    accent: '#EF4444',
    iconSoft: 'rgba(239,68,68,0.14)',
    wash: 'rgba(239,68,68,0.07)',
  },
  info: {
    icon: 'information',
    accent: '#38BDF8',
    iconSoft: 'rgba(56,189,248,0.14)',
    wash: 'rgba(56,189,248,0.07)',
  },
  warning: {
    icon: 'alert',
    accent: '#F59E0B',
    iconSoft: 'rgba(245,158,11,0.14)',
    wash: 'rgba(245,158,11,0.07)',
  },
};

const s = StyleSheet.create({
  viewport: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    zIndex: 9999,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 16,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  tintWash: {
    ...StyleSheet.absoluteFillObject,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  pressablePressed: {
    opacity: 0.92,
  },
  iconRing: {
    padding: 4,
    borderRadius: 14,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  message: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.25,
    lineHeight: 19,
  },
  description: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  dismissHit: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
