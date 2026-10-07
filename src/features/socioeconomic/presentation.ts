import type { MapValuesResponse } from '@/api/types';
import type { TerritoryPresentation } from '@/features/map/TerritoryPresentation';
import { classColors, paletteForIndicator, NO_DATA_COLOR } from './colors';
import { formatValue } from './format';

export function presentationFor(data: MapValuesResponse): TerritoryPresentation {
  const { indicator, classification } = data;
  const colors = classColors(classification?.classes ?? 1, paletteForIndicator(indicator.key));
  return {
    key: `socioeconomic:${indicator.key}:${indicator.year ?? indicator.requestedYear}`,
    colors: new Map(
      data.values.map((item) => [
        item.ibgeCode,
        item.classIndex === null
          ? `var(--map-neutral, ${NO_DATA_COLOR})`
          : (colors[item.classIndex] ?? NO_DATA_COLOR),
      ]),
    ),
    values: new Set(data.values.filter((item) => item.value !== null).map((item) => item.ibgeCode)),
    tooltips: new Map(
      data.values.map((item) => [
        item.ibgeCode,
        {
          value: formatValue(item.value, indicator.unit, indicator.decimalPlaces),
          meta: `${indicator.name}${indicator.year === null ? '' : ` · ${indicator.year}`}`,
        },
      ]),
    ),
  };
}
