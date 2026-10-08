import type { ReactNode } from 'react';

export function StatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'climate' | 'rain' | 'fire' | 'hydro' | 'alert' | 'warning' | 'error';
  children: ReactNode;
}) {
  return (
    <span
      className={`weather-layer-badge badge-${tone}`}
      title={typeof children === 'string' ? children : undefined}
    >
      {children}
    </span>
  );
}
