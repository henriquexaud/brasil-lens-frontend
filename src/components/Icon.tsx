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
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </>
  ),
  car: (
    <>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.900C18.7 10.6 16 10 16 10s-1.3-1.4-2.200-2.3c-.5-.4-1.1-.7-1.800-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.900A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  bike: (
    <>
      <circle cx="18.5" cy="17.5" r="3.5" />
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="15" cy="5" r="1" />
      <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
    </>
  ),
  walk: (
    <>
      <circle cx="12.6" cy="4.3" r="1.7" />
      <path d="M11.4 7.800 9 13.200l3 1.800v5.5M11.4 7.800l3.6 3 2.4.6M12 15l3.6 5.5M9 13.200 6.6 12" />
    </>
  ),
  swap: <path d="m21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16" />,
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
