import React, { createContext, useCallback, useContext,  useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  /** What the user explicitly chose: light, dark, or follow-system */
  preference: ThemePreference;
  /** The resolved scheme after applying the system value when preference is 'system' */
  scheme: ResolvedTheme;
  isDark: boolean;
  setTheme: (pref: ThemePreference) => void;
  /** Cycles light → dark → system */
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const CYCLE_ORDER: ThemePreference[] = ['light', 'dark', 'system'];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() ?? 'light';
  const [preference, setPreference] = useState<ThemePreference>('system');

  const scheme: ResolvedTheme = preference === 'system' ? systemScheme : preference;
  const isDark = scheme === 'dark';

  const setTheme = useCallback((pref: ThemePreference) => {
    setPreference(pref);
    // TODO: persist with AsyncStorage or MMKV:
    // await AsyncStorage.setItem('@theme', pref);
  }, []);

  const cycleTheme = useCallback(() => {
    setPreference((prev) => {
      const next = CYCLE_ORDER[(CYCLE_ORDER.indexOf(prev) + 1) % CYCLE_ORDER.length];
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, scheme, isDark, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}
