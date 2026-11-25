import { createContext, useContext } from 'react';

export type ThemeMode = 'night' | 'wash';

const THEME_STORAGE_KEY = 'inkkey_theme_mode_v1';

export const THEME_OPTIONS: Array<{ id: ThemeMode; label: string; short: string }> = [
  { id: 'night', label: '玄墨夜練', short: '玄墨' },
  { id: 'wash', label: '宣紙水墨', short: '水墨' },
];

export function loadThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'night' || raw === 'wash') return raw;
  } catch {
    // Ignore storage errors
  }
  return 'night';
}

export function saveThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
}

export const ThemeContext = createContext<ThemeMode>('night');

export function useThemeMode(): ThemeMode {
  return useContext(ThemeContext);
}
