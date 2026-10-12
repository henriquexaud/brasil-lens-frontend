import type { MapFeatureCollection } from '../api/types';

export interface RankedTerritory {
  ibgeCode: string;
  name: string;
  value: number;
}

export function territoryExtremes(
  values: { ibgeCode: string; value: number | null }[],
  collection: MapFeatureCollection,
) {
  const names = new Map(collection.features.map((item) => [item.id, item.properties.name]));
  const valid = values.filter(
    (item): item is { ibgeCode: string; value: number } =>
      item.value !== null && Number.isFinite(item.value),
  );
  // Uma malha incompleta não pode transformar os locais visíveis em extremos do recorte.
  if (valid.some((item) => !names.has(item.ibgeCode))) return null;
  const sorted: RankedTerritory[] = valid
    .map((item) => ({ ...item, name: names.get(item.ibgeCode)! }))
    .sort((a, b) => b.value - a.value || a.ibgeCode.localeCompare(b.ibgeCode));
  if (sorted.length < 2 || sorted[0]!.value === sorted.at(-1)!.value) return null;
  const size = Math.min(3, Math.floor(sorted.length / 2));
  const highest = sorted.slice(0, size);
  const ids = new Set(highest.map((item) => item.ibgeCode));
  const lowest = sorted
    .filter((item) => !ids.has(item.ibgeCode))
    .sort((a, b) => a.value - b.value || a.ibgeCode.localeCompare(b.ibgeCode))
    .slice(0, size);
  return { highest, lowest, count: sorted.length };
}
