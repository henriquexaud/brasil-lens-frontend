import { useCallback, useEffect, useState } from 'react';
import { applyTheme, loadTheme, saveTheme, THEME_STORAGE_KEY } from './theme';

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
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : 'light';
    saveTheme(next);
    setTheme(next);
  }, [theme]);

  return { theme, toggleTheme };
}
