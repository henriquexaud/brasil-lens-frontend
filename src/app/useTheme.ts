import { useCallback, useEffect, useState } from 'react';
import {
  applyTheme,
  loadTheme,
  restoreTheme,
  THEME_STORAGE_KEY,
  THEME_CHANGED_EVENT,
  type Theme,
} from './theme';

export function useTheme() {
  const [theme, setTheme] = useState(loadTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      try {
        if (event.storageArea !== window.localStorage) return;
      } catch {
        return;
      }
      setTheme(loadTheme());
    };
    window.addEventListener('storage', handleStorage);
    const handleTheme = (event: Event) => setTheme((event as CustomEvent<Theme>).detail);
    window.addEventListener(THEME_CHANGED_EVENT, handleTheme);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(THEME_CHANGED_EVENT, handleTheme);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : 'light';
    restoreTheme(next);
    setTheme(next);
    return next;
  }, [theme]);

  return { theme, toggleTheme };
}
