'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { getStoredItem, setStoredItem } from './storage';

const THEME_KEY = 'doodle-theme';
const THEME_EVENT = 'doodle-theme-change';

export type ThemeMode = 'light' | 'dark';

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    setTheme(nextTheme: ThemeMode) {
      setStoredItem(THEME_KEY, nextTheme);
      applyTheme(nextTheme);
      window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme: nextTheme } }));
    },
    toggleTheme() {
      const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
      setStoredItem(THEME_KEY, nextTheme);
      applyTheme(nextTheme);
      window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme: nextTheme } }));
    },
  }), [theme]);

  return value;
}

function subscribeTheme(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function getThemeSnapshot(): ThemeMode {
  const stored = getStoredItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function getServerThemeSnapshot(): ThemeMode {
  return 'light';
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}
