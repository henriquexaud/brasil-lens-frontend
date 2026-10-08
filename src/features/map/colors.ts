export const TEMPERATURE_SCALE = [
  { max: 0, color: '#2454C6', label: '<0°', min: -Infinity, name: 'Abaixo de 0°C' },
  { max: 5, color: '#2F7DE1', label: '0–5°', min: 0, name: '0°C a menos de 5°C' },
  { max: 10, color: '#47B3E8', label: '5–10°', min: 5, name: '5°C a menos de 10°C' },
  { max: 15, color: '#79DCE2', label: '10–15°', min: 10, name: '10°C a menos de 15°C' },
  { max: 20, color: '#D8F4F0', label: '15–20°', min: 15, name: '15°C a menos de 20°C' },
  { max: 25, color: '#FFF5A6', label: '20–25°', min: 20, name: '20°C a menos de 25°C' },
  { max: 30, color: '#FFD447', label: '25–30°', min: 25, name: '25°C a menos de 30°C' },
  { max: 35, color: '#FF9B38', label: '30–35°', min: 30, name: '30°C a menos de 35°C' },
  { max: 40, color: '#F04432', label: '35–40°', min: 35, name: '35°C a 40°C' },
  { max: Infinity, color: '#A51C30', label: '>40°', min: 40, name: 'Acima de 40°C' },
] as const;

export type TemperatureBand = (typeof TEMPERATURE_SCALE)[number];
export const NO_DATA_COLOR = '#e2e5ea';
export const HOVER_COLOR = '#52606d';
export const SELECTED_COLOR = '#334155';

function temperatureBand(temp: number | null | undefined): TemperatureBand | undefined {
  if (temp == null || !Number.isFinite(temp)) return undefined;
  // Labels throughout the UI use whole degrees; classify that same displayed value.
  const displayed = Math.round(temp);
  return TEMPERATURE_SCALE.find(
    (band) =>
      displayed >= band.min && (band.max === 40 ? displayed <= band.max : displayed < band.max),
  );
}

export function colorForTemperature(temp: number | null | undefined): string {
  return temperatureBand(temp)?.color ?? NO_DATA_COLOR;
}

export function bandForTemperature(temp: number | null | undefined): TemperatureBand | undefined {
  return temperatureBand(temp);
}
