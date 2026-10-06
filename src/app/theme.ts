export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'brasil_lens_theme_v1';
export const THEME_CHANGED_EVENT = 'brasil-lens-theme-changed';

export function restoreTheme(theme: Theme): void {
  saveTheme(theme);
  applyTheme(theme);
  window.dispatchEvent(new window.CustomEvent(THEME_CHANGED_EVENT, { detail: theme }));
}

export function loadTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {} // eslint-disable-line no-empty
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const surface = window.getComputedStyle(root).getPropertyValue('--surface-muted').trim();
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', surface || (theme === 'dark' ? '#111d23' : '#f5f7f7'));
}
