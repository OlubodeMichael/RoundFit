import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = '@roundfit/theme';

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

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreference(stored);
      }
    });
  }, []);

  const scheme: ResolvedTheme = preference === 'system' ? systemScheme : preference;
  const isDark = scheme === 'dark';

  const setTheme = useCallback((pref: ThemePreference) => {
    setPreference(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref);
  }, []);

  const cycleTheme = useCallback(() => {
    setPreference((prev) => {
      const next = CYCLE_ORDER[(CYCLE_ORDER.indexOf(prev) + 1) % CYCLE_ORDER.length];
      AsyncStorage.setItem(STORAGE_KEY, next);
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
