import type { MapFeatureCollection, MapValuesResponse } from '@/api/types';
import { TerritoryRanking } from '@/components/TerritoryRanking';
import { formatValue } from './format';

const RANKING_TITLES: Record<string, string> = {
  population: 'Mais e menos populosos',
  population_density: 'Maior e menor densidade',
  gdp: 'Maior e menor PIB',
  gdp_per_capita: 'Maior e menor PIB por habitante',
  household_income_per_capita: 'Maior e menor renda por habitante',
  unemployment_rate: 'Maior e menor desemprego',
};

export function IndicatorRanking({
  data,
  collection,
  onSelect,
}: {
  data: MapValuesResponse;
  collection: MapFeatureCollection;
  onSelect: (code: string) => void;
}) {
  const { indicator } = data;
  const title = RANKING_TITLES[indicator.key];
  if (!title || indicator.year === null) return null;
  return (
    <TerritoryRanking
      key={`${indicator.key}:${indicator.year}:${data.parent}`}
      title={title}
      values={data.values}
      collection={collection}
      formatValue={(value) => formatValue(value, indicator.unit, indicator.decimalPlaces)}
      note={String(indicator.year)}
      onSelect={onSelect}
    />
  );
}
