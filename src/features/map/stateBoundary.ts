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

/**
 * Prioriza o contorno detalhado (detail LOD) com fallback seguro para overview.
 */
export function resolveSelectedStateOutline(
  isDrilledDown: boolean,
  parentCode: string | null | undefined,
  detailFeatures: MapFeature[] | null | undefined,
  overviewFeatures?: MapFeature[] | null | undefined,
): MapFeature | null {
  if (!isDrilledDown || !parentCode) return null;
  const detailed = findStateOutline(isDrilledDown, parentCode, detailFeatures);
  if (detailed) {
    return detailed.id.endsWith(':detail')
      ? detailed
      : { ...detailed, id: `${detailed.id}:detail` };
  }
  return findStateOutline(isDrilledDown, parentCode, overviewFeatures);
}
