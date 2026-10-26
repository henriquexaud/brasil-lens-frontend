import type { WeatherCity } from '@/api/types';

// Níveis da Defesa Civil/INMET para umidade relativa baixa.
export type HumidityLevel = 'emergency' | 'alert' | 'attention';

export const HUMIDITY_LEVEL_LABEL: Record<HumidityLevel, string> = {
  emergency: 'Emergência',
  alert: 'Alerta',
  attention: 'Atenção',
};

export function humidityLevel(pct: number | null | undefined): HumidityLevel | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (pct < 12) return 'emergency';
  if (pct <= 20) return 'alert';
  if (pct <= 30) return 'attention';
  return null;
}

interface HumidityStop {
  max: number;
  label: string;
  color: string;
}

// Do âmbar seco ao petróleo úmido. As três primeiras faixas são os níveis
// oficiais; as demais têm 10 pontos cada. Cor de dado igual nos dois temas.
export const HUMIDITY_SCALE_STOPS: HumidityStop[] = [
  { max: 11, label: 'Abaixo de 12% · emergência', color: '#8c3b0a' },
  { max: 20, label: '12 a 20% · alerta', color: '#c2621a' },
  { max: 30, label: '21 a 30% · atenção', color: '#e39a3b' },
  { max: 40, label: '31 a 40%', color: '#f0c777' },
  { max: 50, label: '41 a 50%', color: '#f4e2b0' },
  { max: 60, label: '51 a 60%', color: '#d6ece2' },
  { max: 70, label: '61 a 70%', color: '#a8d8cc' },
  { max: 80, label: '71 a 80%', color: '#6dbdb0' },
  { max: 90, label: '81 a 90%', color: '#36988f' },
  { max: Infinity, label: 'Acima de 90%', color: '#1d6b6f' },
];

export function humidityColor(pct: number): string {
  // Lido como inteiro, como o painel exibe: 11,6% pinta como 12%.
  const value = Math.round(pct);
  if (value < 12) return HUMIDITY_SCALE_STOPS[0]!.color;
  return (HUMIDITY_SCALE_STOPS.find((stop) => value <= stop.max) ?? HUMIDITY_SCALE_STOPS.at(-1)!)
    .color;
}

export function formatHumidity(pct: number): string {
  return `${Math.round(pct)}%`;
}

export function humidityValue(city: WeatherCity | undefined): number | null {
  const value = city?.humidityPct;
  return value != null && Number.isFinite(value) ? value : null;
}

export function minHumidity(cities: readonly WeatherCity[]): number | undefined {
  let min: number | undefined;
  for (const city of cities) {
    const value = humidityValue(city);
    if (value != null && (min === undefined || value < min)) min = value;
  }
  return min;
}
