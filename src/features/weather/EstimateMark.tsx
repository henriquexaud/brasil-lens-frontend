import type { WeatherCity } from '@/api/types';

/** O que o "≈" quer dizer: o valor foi interpolado a partir de cidades medidas. */
export const ESTIMATE_DESCRIPTION = 'Estimado a partir de cidades próximas';

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
