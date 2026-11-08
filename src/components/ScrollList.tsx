import { useLayoutEffect, useRef, useState, type ReactNode, type UIEvent } from 'react';

// Linhas montadas por vez: a lista de São Paulo tem 2.703 escolas, e o DOM do
// painel deve ficar em algumas dezenas de nós até alguém rolar.
const PAGE = 40;
// A próxima leva entra antes do fim, para a rolagem não bater no vazio.
const AHEAD_PX = 160;

/**
 * Lista do painel com altura limitada e rolagem própria: o painel não cresce com
 * ela, e sombras nas bordas indicam que há mais (ver `.scroll-list`).
 */
export function ScrollList<T>({
  items,
  label,
  render,
  className = '',
}: {
  items: readonly T[];
  label: string;
  /** Devolve o `<li>` do item, com `key`. */
  render: (item: T) => ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLOListElement>(null);
  const [shown, setShown] = useState({ items, limit: PAGE });
  // Lista nova (outro filtro ou território) recomeça do topo da primeira leva.
  const limit = shown.items === items ? shown.limit : PAGE;
  if (shown.items !== items) setShown({ items, limit: PAGE });
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [items]);

  const onScroll = (event: UIEvent<HTMLOListElement>) => {
    if (limit >= items.length) return;
    const list = event.currentTarget;
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - AHEAD_PX)
      setShown({ items, limit: limit + PAGE });
  };

  return (
    <ol
      ref={ref}
      className={`scroll-list ${className}`}
      aria-label={label}
      tabIndex={0}
      onScroll={onScroll}
    >
      {items.slice(0, limit).map(render)}
    </ol>
  );
}
