import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';

// Um desenho por esporte, na família dos ícones do app (traço 1,6 em caixa 24).
const SPORT: Record<string, ReactNode> = {
  soccer: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7.5 3.5 2.5-1.3 4H9.800L8.5 10Z" />
      <path d="M12 7.5V3.200M15.5 10l4.2-1.400M14.2 14l2.6 3.600M9.8 14l-2.6 3.600M8.5 10 4.3 8.6" />
    </>
  ),
  basketball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18M5.6 5.600a9 9 0 0 1 0 12.800M18.4 5.600a9 9 0 0 0 0 12.8" />
    </>
  ),
  volleyball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12c0-4 1.5-7 4.2-8M12 12c3.5 2 6.6 2 8.7.600M12 12c-3.5 2-5.2 4.8-5.2 7.6" />
    </>
  ),
  tennis: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.2 6.200c3 2.6 3 9 0 11.600M18.8 6.200c-3 2.6-3 9 0 11.6" />
    </>
  ),
  multi: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M12 5v14" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  skate: (
    <>
      <path d="M3 11.500c1 1.7 2.2 2.5 4 2.500h10c1.8 0 3-.8 4-2.5" />
      <circle cx="8" cy="17.5" r="1.6" />
      <circle cx="16" cy="17.5" r="1.6" />
    </>
  ),
  swimming: (
    <>
      <circle cx="17" cy="7" r="1.7" />
      <path d="m5 12.5 5-4 4 3.5" />
      <path d="M2 16.500c2.5-2 4.5-2 7 0s4.5 2 7 0 4-2 6-.500M2 20.500c2.5-2 4.5-2 7 0s4.5 2 7 0 4-2 6-.5" />
    </>
  ),
  fitness: <path d="M6.5 6.500v11M17.5 6.500v11M3.5 9v6M20.5 9v6M6.5 12h11" />,
  athletics: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="6" />
      <rect x="7.5" y="10" width="9" height="4" rx="2" />
    </>
  ),
  centre: <path d="M4 20V9.500l8-5.5 8 5.500V20M9.5 20v-6h5v6M3 20h18" />,
  stadium: (
    <>
      <ellipse cx="12" cy="12" rx="9" ry="6.5" />
      <ellipse cx="12" cy="12" rx="4.5" ry="2.5" />
    </>
  ),
};

/** Ícone da categoria, quando ela tem um (hoje, os esportes). */
export function categoryIcon(layer: string, category: string | null | undefined, size = 15) {
  const glyph = layer === 'sport' && category ? SPORT[category] : undefined;
  return glyph ? (
    <Icon size={size} className="category-icon">
      {glyph}
    </Icon>
  ) : undefined;
}
