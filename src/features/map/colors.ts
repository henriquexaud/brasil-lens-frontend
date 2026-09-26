/** Paleta térmica e contornos do mapa. */
export const TEMPERATURE_SCALE = [
  { max: 0, color: '#2454C6', label: '≤0°', min: -Infinity, name: 'Até 0°C' },
  { max: 5, color: '#2F7DE1', label: '0–5°', min: 0, name: '0°C a 5°C' },
  { max: 10, color: '#47B3E8', label: '5–10°', min: 5, name: '5°C a 10°C' },
  { max: 15, color: '#79DCE2', label: '10–15°', min: 10, name: '10°C a 15°C' },
  { max: 20, color: '#D8F4F0', label: '15–20°', min: 15, name: '15°C a 20°C' },
  { max: 25, color: '#FFF5A6', label: '20–25°', min: 20, name: '20°C a 25°C' },
  { max: 30, color: '#FFD447', label: '25–30°', min: 25, name: '25°C a 30°C' },
  { max: 35, color: '#FF9B38', label: '30–35°', min: 30, name: '30°C a 35°C' },
  { max: Infinity, color: '#F04432', label: '>35°', min: 35, name: 'Acima de 35°C' },
] as const;

export type TemperatureBand = (typeof TEMPERATURE_SCALE)[number];
export const NO_DATA_COLOR = '#e2e5ea';
export const HOVER_COLOR = '#52606d';
export const SELECTED_COLOR = '#334155';

export function colorForTemperature(temp: number | null | undefined): string {
  if (temp === null || temp === undefined || Number.isNaN(temp)) return NO_DATA_COLOR;
  return TEMPERATURE_SCALE.find((band) => temp <= band.max)?.color ?? NO_DATA_COLOR;
}

export function bandForTemperature(
  temp: number | null | undefined,
): TemperatureBand | undefined {
  if (temp === null || temp === undefined || Number.isNaN(temp)) return undefined;
  return TEMPERATURE_SCALE.find((band) => temp <= band.max);
}
