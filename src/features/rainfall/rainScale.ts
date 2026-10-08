export interface RainScaleStop {
  min: number;
  label: string;
  color: string;
}

export const RAIN_SCALE_STOPS: RainScaleStop[] = [
  { min: 0, label: '0 mm', color: '#f1f5f9' },
  { min: Number.MIN_VALUE, label: 'Mais de 0 a menos de 2 mm', color: '#dbeafe' },
  { min: 2, label: '2 a menos de 5 mm', color: '#bfdbfe' },
  { min: 5, label: '5 a menos de 15 mm', color: '#93c5fd' },
  { min: 15, label: '15 a menos de 30 mm', color: '#60a5fa' },
  { min: 30, label: '30 a menos de 50 mm', color: '#3b82f6' },
  { min: 50, label: '50 a menos de 75 mm', color: '#2563eb' },
  { min: 75, label: '75 a menos de 100 mm', color: '#1d4ed8' },
  { min: 100, label: '100 a menos de 150 mm', color: '#1e3a8a' },
  { min: 150, label: '150 mm ou mais', color: '#172554' },
];

export function rainAmount(city: {
  precipitation48hMm?: number | null;
  precipitationSumMm?: number | null;
  precipitationMm?: number | null;
}): number {
  return city.precipitation48hMm ?? city.precipitationSumMm ?? city.precipitationMm ?? 0;
}

export function rainingNowText(city: {
  rainingNow?: boolean;
  samplePoints?: number | null;
  rainingPoints?: number | null;
}): string | null {
  if (!city.rainingNow) return null;
  return city.samplePoints && city.rainingPoints != null
    ? `Chovendo agora em ${city.rainingPoints} de ${city.samplePoints} pontos`
    : 'Chovendo agora';
}

export function rainColor(mm: number | null | undefined): string {
  if (mm == null || !Number.isFinite(mm) || mm <= 0) return RAIN_SCALE_STOPS[0]!.color;
  for (let index = RAIN_SCALE_STOPS.length - 1; index >= 0; index--) {
    const stop = RAIN_SCALE_STOPS[index]!;
    if (mm >= stop.min) return stop.color;
  }
  return RAIN_SCALE_STOPS[0]!.color;
}

export function rainDescription(mm: number | null | undefined): string {
  if (mm == null || mm <= 0) return 'Sem chuva registrada';
  if (mm < 2) return 'Garoa / Chuva fraca';
  if (mm < 10) return 'Chuva leve';
  if (mm < 25) return 'Chuva moderada';
  if (mm < 50) return 'Chuva forte';
  if (mm < 100) return 'Chuva muito forte';
  return 'Chuva torrencial';
}

export function rainBadgeText(mm: number | null | undefined): string {
  if (mm == null || mm <= 0) return 'Sem chuva';
  if (mm < 5) return 'Chuva leve';
  if (mm < 25) return 'Moderada';
  if (mm < 50) return 'Forte';
  return 'Alerta de chuva';
}
