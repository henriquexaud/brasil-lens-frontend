import type { MapFeature } from '@/api/types';

export function findStateOutline(
  isDrilledDown: boolean,
  parentCode: string | null | undefined,
  features: MapFeature[] | null | undefined,
): MapFeature | null {
  if (!isDrilledDown || !parentCode) return null;
  return (
    features?.find(
      (f) => f.properties.ibgeCode === parentCode || f.properties.abbreviation === parentCode,
    ) ?? null
  );
}

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
