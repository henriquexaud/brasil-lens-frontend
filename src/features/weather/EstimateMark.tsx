import type { WeatherCity } from '@/api/types';

/** O que o "≈" quer dizer: o valor foi interpolado a partir de cidades medidas. */
export const ESTIMATE_DESCRIPTION = 'Estimado a partir de cidades próximas';

/** Mapa do Brasil depois das capitais: cada UF resume o seu território. */
export const STATE_AVERAGE_DESCRIPTION =
  'Cada estado é a média de pontos do seu território, ponderada pela área';

export function isStateAverage(city: Pick<WeatherCity, 'samplePoints'>): boolean {
  return (city.samplePoints ?? 0) > 1;
}

/**
 * Marca discreta de valor estimado, colocada antes do número. O "≈" basta para
 * quem vê; a explicação completa fica no `title` e no texto para leitor de tela.
 */
export function EstimateMark({ city }: { city: Pick<WeatherCity, 'isInferred'> | undefined }) {
  if (!city?.isInferred) return null;
  return (
    <span className="estimate-mark" title={ESTIMATE_DESCRIPTION}>
      <span aria-hidden="true">≈</span>
      <span className="sr-only">estimado:</span>
    </span>
  );
}
