import { useTheme } from '@/app/useTheme';

export function ThemeSwitch() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-switch"
      role="switch"
      aria-label="Tema escuro"
      aria-checked={dark}
      title={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      onClick={toggleTheme}
    >
      <span className="theme-switch__thumb" aria-hidden="true" />
      <svg
        className="theme-switch__icon theme-switch__icon--sun"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3.8" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </svg>
      <svg
        className="theme-switch__icon theme-switch__icon--moon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.5 14.4A8.6 8.6 0 0 1 9.6 3.5a8.6 8.6 0 1 0 10.9 10.9Z" />
      </svg>
    </button>
  );
}
