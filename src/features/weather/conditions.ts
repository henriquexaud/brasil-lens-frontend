export { WeatherIcon } from './WeatherIcon';

/** Códigos WMO publicados pela Open-Meteo. */
export function weatherDescription(code: number | null): string {
  if (code === 0) return 'Céu limpo';
  if (code === 1) return 'Predominantemente limpo';
  if (code === 2) return 'Parcialmente nublado';
  if (code === 3) return 'Nublado';
  if (code === 45 || code === 48) return 'Nevoeiro';
  if ([51, 53, 55, 56, 57].includes(code ?? -1)) return 'Garoa';
  if ([61, 63, 65, 66, 67].includes(code ?? -1)) return 'Chuva';
  if ([71, 73, 75, 77, 85, 86].includes(code ?? -1)) return 'Neve';
  if ([80, 81, 82].includes(code ?? -1)) return 'Pancadas de chuva';
  if ([95, 96, 99].includes(code ?? -1)) return 'Trovoadas';
  return 'Condição não informada';
}

export function measurement(value: number | null | undefined, unit: string): string {
  if (value == null || typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  if (unit.includes('°')) {
    const rounded = Math.round(value) || 0;
    return `${rounded.toLocaleString('pt-BR')}${unit}`;
  }
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${unit}`;
}
