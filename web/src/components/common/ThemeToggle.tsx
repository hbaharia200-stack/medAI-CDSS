import { useTheme } from '../../theme/ThemeProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-canvas"
    >
      <span aria-hidden>{isDark ? '☀️' : '🌙'}</span>
      <span>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}

export default ThemeToggle;
