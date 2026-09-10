import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import { themes, type ThemeColors, type ThemeMode, type ColorScheme } from '@/lib/theme';

const THEME_KEY = 'theme_mode';

type ThemeContextType = {
  themeMode: ThemeMode;
  colorScheme: ColorScheme;
  colors: ThemeColors;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function resolveColorScheme(mode: ThemeMode, systemScheme: ColorScheme | null | undefined): ColorScheme {
  if (mode === 'system') {
    return (systemScheme as ColorScheme) ?? 'dark';
  }
  return mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useRNColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  const colorScheme = resolveColorScheme(themeMode, systemScheme);
  const isDark = colorScheme === 'dark';
  const colors = themes[colorScheme];

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeModeState(stored);
      }
    });
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    SecureStore.setItemAsync(THEME_KEY, mode);
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({ themeMode, colorScheme, colors, isDark, setThemeMode }),
    [themeMode, colorScheme, colors, isDark, setThemeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return ctx;
}
