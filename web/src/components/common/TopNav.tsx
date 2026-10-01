import { ThemeToggle } from './ThemeToggle';

interface TopNavProps {
  title: string;
  subtitle?: string;
}

export function TopNav({ title, subtitle }: TopNavProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-6 py-3">
      <div>
        <h1 className="type-page text-ink">{title}</h1>
        {subtitle ? <p className="text-sm text-ink-muted">{subtitle}</p> : null}
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
      </div>
    </header>
  );
}

export default TopNav;