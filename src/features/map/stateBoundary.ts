import type { MapFeature } from '@/api/types';

/**
 * Localiza o contorno da UF a partir do código IBGE (ex.: '35') ou sigla (ex.: 'SP').
 */
export function findStateOutline(
  isDrilledDown: boolean,
  parentCode: string | null | undefined,
  features: MapFeature[] | null | undefined,
): MapFeature | null {
  if (!isDrilledDown || !parentCode) return null;
  return (
    features?.find(
      (f) =>
        f.properties.ibgeCode === parentCode ||
        f.properties.abbreviation === parentCode,
    ) ?? null
  );
}
