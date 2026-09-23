/**
 * Escala cromática e classificações de quantidade de chuva (precipitação acumulada).
 * Utiliza a paleta oficial meteorológica de azuis contínuos (ColorBrewer Blues).
 */

export interface RainScaleStop {
  min: number;
  label: string;
  color: string;
}

export const RAIN_SCALE_STOPS: RainScaleStop[] = [
  { min: 0, label: '0 mm', color: '#f1f5f9' },
  { min: 0.1, label: '2 mm', color: '#dbeafe' },
  { min: 5, label: '10 mm', color: '#93c5fd' },
  { min: 15, label: '25 mm', color: '#60a5fa' },
  { min: 30, label: '50 mm', color: '#3b82f6' },
  { min: 50, label: '75 mm', color: '#2563eb' },
  { min: 75, label: '100+ mm', color: '#1e3a8a' },
];

/**
 * Chuva de uma leitura: o acumulado de 24 h; na falta dele, o total de hoje ou o
 * intervalo mais recente (respostas antigas em cache).
 */
export function rainAmount(city: {
  precipitation24hMm?: number | null;
  precipitationSumMm?: number | null;
  precipitationMm?: number | null;
}): number {
  return city.precipitation24hMm ?? city.precipitationSumMm ?? city.precipitationMm ?? 0;
}

/** "Chovendo agora", com a proporção de pontos na visão do Brasil. */
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

/**
 * Retorna a tonalidade de azul correspondente ao acumulado de chuva em milímetros.
 */
export function rainColor(mm: number | null | undefined): string {
  if (mm == null || mm <= 0) return '#f1f5f9';
  if (mm < 2) return '#dbeafe';
  if (mm < 5) return '#bfdbfe';
  if (mm < 15) return '#93c5fd';
  if (mm < 30) return '#60a5fa';
  if (mm < 50) return '#3b82f6';
  if (mm < 75) return '#2563eb';
  if (mm < 100) return '#1d4ed8';
  return '#1e3a8a';
}

/**
 * Descrição amigável do nível de precipitação acumulada.
 */
export function rainDescription(mm: number | null | undefined): string {
  if (mm == null || mm <= 0) return 'Sem chuva registrada';
  if (mm < 2) return 'Garoa / Chuva fraca';
  if (mm < 10) return 'Chuva leve';
  if (mm < 25) return 'Chuva moderada';
  if (mm < 50) return 'Chuva forte';
  if (mm < 100) return 'Chuva muito forte';
  return 'Chuva torrencial';
}

/**
 * Rótulo conciso para badges de status.
 */
export function rainBadgeText(mm: number | null | undefined): string {
  if (mm == null || mm <= 0) return 'Sem chuva';
  if (mm < 5) return 'Chuva leve';
  if (mm < 25) return 'Moderada';
  if (mm < 50) return 'Forte';
  return 'Alerta de chuva';
}
