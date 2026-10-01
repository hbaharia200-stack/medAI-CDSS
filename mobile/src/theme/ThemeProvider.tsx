import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyThemeColors, darkColors, lightColors, type ThemeScheme } from './tokens';

const STORAGE_KEY = '@medai_theme_scheme_v1';

export type ThemeColors = typeof lightColors;

interface ThemeContextValue {
  scheme: ThemeScheme;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (scheme: ThemeScheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Central theme state. Follows the OS theme until the user makes an explicit
 * Light/Dark choice, which is then persisted (AsyncStorage) and wins on every
 * restart. `colors` is a stable per-scheme object — components must read it
 * at render time (inline styles / style factories), never inside
 * module-scope StyleSheet.create, or the values freeze at import time.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setScheme] = useState<ThemeScheme>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );
  const [hydrated, setHydrated] = useState(false);
  const [manual, setManual] = useState(false);

  // Restore a previously chosen theme (if any).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && (stored === 'light' || stored === 'dark')) {
          setScheme(stored);
          setManual(true);
        }
      } catch {
        // Ignore storage failures; default to system preference.
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Follow OS theme changes until the user makes an explicit choice.
  useEffect(() => {
    if (manual) return;
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, [manual]);

  // Keep the legacy global palette in sync for any straggler readers.
  useEffect(() => {
    if (hydrated) applyThemeColors(scheme);
  }, [scheme, hydrated]);

  // Persist only explicit user choices, so follow-system survives restarts.
  useEffect(() => {
    if (hydrated && manual) {
      void AsyncStorage.setItem(STORAGE_KEY, scheme).catch(() => {});
    }
  }, [scheme, hydrated, manual]);

  const setTheme = useCallback((next: ThemeScheme) => {
    setManual(true);
    setScheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setManual(true);
    setScheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      toggleTheme,
      setTheme,
    }),
    [scheme, toggleTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export default ThemeProvider;
