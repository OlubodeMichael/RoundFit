import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type StyleProp, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { safeBack } from '@/utils/navigation';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

type FooterAction = { label: string; onPress: () => void; disabled: boolean };
type FooterContextValue = {
  action: FooterAction | null;
  register: (action: FooterAction) => void;
};

const FooterContext = createContext<FooterContextValue | null>(null);

export function OnboardingFooterProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<FooterAction | null>(null);
  const register = useCallback((next: FooterAction) => setAction(next), []);
  const value = useMemo(() => ({ action, register }), [action, register]);
  return <FooterContext.Provider value={value}>{children}</FooterContext.Provider>;
}

function FooterButtons({ action, style }: { action: FooterAction; style?: StyleProp<ViewStyle> }) {
  const router = useRouter();

  return (
    <View style={[s.row, style]}>
      <TouchableOpacity
        style={s.previous}
        activeOpacity={0.72}
        onPress={() => safeBack(router, '/auth')}
        accessibilityRole="button"
        accessibilityLabel="Previous question"
      >
        <Ionicons name="arrow-back" size={17} color="#111111" />
        <Text style={s.previousLabel}>Prev</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.cta, { opacity: action.disabled ? 0.35 : 1 }]}
        activeOpacity={0.85}
        disabled={action.disabled}
        onPress={action.onPress}
        accessibilityRole="button"
        accessibilityState={{ disabled: action.disabled }}
      >
        <Text style={s.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{action.label}</Text>
        <View style={s.arrowDisc}>
          <Ionicons name="arrow-forward" size={20} color="#111111" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

/** Persistent footer rendered once by the onboarding layout. */
export function OnboardingFooter() {
  const context = useContext(FooterContext);
  const insets = useSafeAreaInsets();
  if (!context?.action) return null;

  return (
    <View style={[s.shell, { paddingBottom: insets.bottom + 12 }]}>
      <FooterButtons action={context.action} />
    </View>
  );
}

/** Registers a screen's action with the persistent footer. */
export function PrimaryCTA({ label, onPress, disabled = false, style }: Props) {
  const context = useContext(FooterContext);
  const register = context?.register;
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  useEffect(() => {
    if (!register) return;
    register({ label, disabled, onPress: () => onPressRef.current() });
  }, [disabled, label, register]);

  if (context) return null;
  return <FooterButtons action={{ label, disabled, onPress }} style={style} />;
}

const s = StyleSheet.create({
  shell: { paddingTop: 10, paddingHorizontal: 24, backgroundColor: '#FAFAF8' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previous: {
    width: 102,
    minHeight: 64,
    borderRadius: 999,
    backgroundColor: '#F2EEE9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  previousLabel: { color: '#111111', fontFamily: 'Archivo_600SemiBold', fontSize: 15 },
  cta: {
    flex: 1,
    minHeight: 64,
    paddingLeft: 24,
    paddingRight: 8,
    backgroundColor: '#F97316',
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 7,
  },
  label: { flexShrink: 1, color: '#FFF', fontFamily: 'Archivo_600SemiBold', fontSize: 17, letterSpacing: 0.1 },
  arrowDisc: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F7F3EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
