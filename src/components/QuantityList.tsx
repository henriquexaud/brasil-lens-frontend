import type { ReactNode } from 'react';

export interface QuantityRow {
  key: string;
  label: string;
  icon?: ReactNode;
  /** Valor já formatado. */
  value: string;
  /** Grandeza que ordena a lista e mede a barra; ausente, a linha fica sem barra. */
  amount: number | null;
  onSelect?: () => void;
}

/** Lista de quantidades: a maior primeiro, com uma barra fina na proporção da maior. */
export function QuantityList({ rows, label }: { rows: QuantityRow[]; label: string }) {
  const largest = Math.max(0, ...rows.map((row) => row.amount ?? 0));
  if (!rows.length) return null;
  return (
    <dl className="quantity-list" aria-label={label}>
      {rows.map((row) => (
        <div
          key={row.key}
          className="quantity-row"
          style={{
            ['--share' as string]:
              largest > 0 && row.amount ? Math.max(0.015, row.amount / largest) : 0,
          }}
        >
          <dt>
            {row.onSelect ? (
              <button type="button" onClick={row.onSelect}>
                {row.icon}
                {row.label}
              </button>
            ) : (
              <span>
                {row.icon}
                {row.label}
              </span>
            )}
          </dt>
          <dd className={row.amount === null ? 'is-missing' : undefined}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
