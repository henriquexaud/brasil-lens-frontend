import type { ReactNode } from 'react';

// Traço de 1,6 em caixa 24: a mesma família dos ícones do seletor de contexto e do tema.
export function Icon({
  size = 16,
  className,
  children,
}: {
  size?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const GLYPHS = {
  close: <path d="M18 6 6 18M6 6l12 12" />,
  alert: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  waves: (
    <>
      <path d="M2 7c2.5-2 4.5-2 7 0s4.5 2 7 0 4-2 6-.5" />
      <path d="M2 12.5c2.5-2 4.5-2 7 0s4.5 2 7 0 4-2 6-.5" />
      <path d="M2 18c2.5-2 4.5-2 7 0s4.5 2 7 0 4-2 6-.5" />
    </>
  ),
  route: <path d="m3 11 19-9-9 19-2-8-8-2Z" />,
} as const;

export type GlyphName = keyof typeof GLYPHS;

export function Glyph({
  name,
  size,
  className,
}: {
  name: GlyphName;
  size?: number;
  className?: string;
}) {
  return (
    <Icon size={size} className={className}>
      {GLYPHS[name]}
    </Icon>
  );
}
