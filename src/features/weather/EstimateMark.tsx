import type { WeatherCity } from '@/api/types';

export const ESTIMATE_DESCRIPTION = 'Estimado a partir de cidades próximas';

export const STATE_AVERAGE_DESCRIPTION =
  'Cada estado é a média de pontos do seu território, ponderada pela área';

export function isStateAverage(city: Pick<WeatherCity, 'samplePoints'>): boolean {
  return (city.samplePoints ?? 0) > 1;
}

export function EstimateMark({ city }: { city: Pick<WeatherCity, 'isInferred'> | undefined }) {
  if (!city?.isInferred) return null;
  return (
    <span className="estimate-mark" title={ESTIMATE_DESCRIPTION}>
      <span aria-hidden="true">≈</span>
      <span className="sr-only">estimado:</span>
    </span>
  );
}
