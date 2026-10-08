// Um dado pinta o território com a mesma cor nos dois temas. No claro, a cor
// continua translúcida sobre o relevo (`--map-data-backing` é transparente). No
// escuro, o token vira a terra clara e a mistura fica opaca, para o fundo
// escuro não escurecer a escala. A divisa acompanha: sobre dado ela é a branca
// do tema claro, que também cobre as frestas da malha simplificada. Ausência
// de dado não passa por aqui: usa os neutros do tema.
const DATA_BOUNDARY = 'var(--map-data-boundary, #ffffff)';

export function dataFill(color: string, opacity: number) {
  return {
    color: DATA_BOUNDARY,
    fillColor: `color-mix(in srgb, ${color} ${percent(opacity)}, var(--map-data-backing, transparent))`,
    fillOpacity: 1,
  };
}

export function isDataFill(style: { color?: string }): boolean {
  return style.color === DATA_BOUNDARY;
}

// Mosaico: sempre opaco. Dado medido fica sobre a terra clara, igual nos dois
// temas; ausência, sobre a terra do tema.
export function mosaicFill(color: string, opacity: number, measured: boolean): string {
  const land = measured ? 'var(--map-data-land, #f4f5f5)' : 'var(--map-land, #f4f5f5)';
  return `color-mix(in srgb, ${color} ${percent(opacity)}, ${land})`;
}

function percent(opacity: number): string {
  return `${Math.round(opacity * 100)}%`;
}
