export type FireMode = 'territorial' | 'points';

export function fireMode(zoom: number): FireMode {
  return zoom < 9 ? 'territorial' : 'points';
}

export const FIRE_DENSITY_SCALE = [
  { min: 0, color: '#edf0ee', label: '0', name: 'Sem focos detectados' },
  {
    min: Number.MIN_VALUE,
    color: '#fff4ad',
    label: '<1',
    name: 'Mais de 0 a menos de 1 foco / 1.000 km²',
  },
  { min: 1, color: '#ffdb55', label: '1–5', name: '1 a menos de 5 focos / 1.000 km²' },
  { min: 5, color: '#ffab35', label: '5–10', name: '5 a menos de 10 focos / 1.000 km²' },
  { min: 10, color: '#f47724', label: '10–25', name: '10 a menos de 25 focos / 1.000 km²' },
  { min: 25, color: '#dc3526', label: '25–50', name: '25 a menos de 50 focos / 1.000 km²' },
  { min: 50, color: '#8b1823', label: '50–75', name: '50 a menos de 75 focos / 1.000 km²' },
  { min: 75, color: '#74152b', label: '75–100', name: '75 a menos de 100 focos / 1.000 km²' },
  { min: 100, color: '#5e1233', label: '100–150', name: '100 a menos de 150 focos / 1.000 km²' },
  { min: 150, color: '#480f3b', label: '150+', name: '150 focos ou mais / 1.000 km²' },
] as const;

export function densityColor(density: number | null | undefined): string {
  if (density == null || !Number.isFinite(density) || density <= 0) return '#edf0ee';
  for (let index = FIRE_DENSITY_SCALE.length - 1; index >= 0; index--) {
    const band = FIRE_DENSITY_SCALE[index]!;
    if (density >= band.min) return band.color;
  }
  return FIRE_DENSITY_SCALE[0].color;
}

export function hydroZoom(zoom: number): number {
  return zoom < 6 ? 4 : zoom < 8 ? 6 : zoom < 10 ? 8 : 10;
}
