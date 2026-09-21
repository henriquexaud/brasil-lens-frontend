export type FireMode = 'territorial' | 'points';

export function fireMode(zoom: number): FireMode {
  return zoom < 9 ? 'territorial' : 'points';
}

// Limites fixos: uma cor mantém o mesmo significado entre estados e municípios.
export const FIRE_DENSITY_BREAKS = [1, 5, 10, 25, 50];
export const FIRE_COLORS = ['#fff4ad', '#ffdb55', '#ffab35', '#f47724', '#dc3526', '#8b1823'];

export function densityColor(density: number | null | undefined): string {
  if (density == null || !Number.isFinite(density) || density <= 0) return '#edf0ee';
  const band = FIRE_DENSITY_BREAKS.findIndex((limit) => density < limit);
  return FIRE_COLORS[band < 0 ? FIRE_COLORS.length - 1 : band]!;
}

export function hydroZoom(zoom: number): number {
  return zoom < 6 ? 4 : zoom < 8 ? 6 : zoom < 10 ? 8 : 10;
}
