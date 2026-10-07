import type { Indicator } from '@/api/types';

export type IndicatorCategoryId = 'population' | 'economy' | 'other';

export interface IndicatorCategoryConfig {
  id: IndicatorCategoryId;
  label: string;
  keys: string[];
  defaultKey: string;
  shortLabels: Record<string, string>;
}

export const INDICATOR_CATEGORIES: IndicatorCategoryConfig[] = [
  {
    id: 'population',
    label: 'População',
    keys: [
      'population',
      'urban_population',
      'population_density',
      'population_growth',
      'urbanization_rate',
    ],
    defaultKey: 'population',
    shortLabels: {
      population: 'Total',
      urban_population: 'Urbana',
      population_density: 'Densidade',
      population_growth: 'Crescimento',
      urbanization_rate: 'Urbanização',
    },
  },
  {
    id: 'economy',
    label: 'Economia',
    keys: [
      'gdp',
      'gdp_per_capita',
      'gdp_share_national',
      'gdp_agriculture',
      'gdp_industry',
      'gdp_services',
    ],
    defaultKey: 'gdp',
    shortLabels: {
      gdp: 'PIB Total',
      gdp_per_capita: 'Per capita',
      gdp_share_national: 'Part. nacional',
      gdp_agriculture: 'Agropecuária',
      gdp_industry: 'Indústria',
      gdp_services: 'Serviços',
    },
  },
  {
    id: 'other',
    label: 'Outros',
    keys: ['area_km2', 'household_income_per_capita', 'unemployment_rate'],
    defaultKey: 'area_km2',
    shortLabels: {
      area_km2: 'Área territorial',
      household_income_per_capita: 'Renda domiciliar',
      unemployment_rate: 'Taxa de desemprego',
    },
  },
];

export function indicatorCategoryId(key: string | null | undefined): IndicatorCategoryId {
  return INDICATOR_CATEGORIES.find((category) => key && category.keys.includes(key))?.id ?? 'other';
}

export function yearForIndicator(indicator: Indicator | undefined, year: string): string {
  return year === 'latest' ||
    !indicator?.availableYears.length ||
    indicator.availableYears.includes(Number(year))
    ? year
    : 'latest';
}

export interface CategorizedIndicators {
  id: IndicatorCategoryId;
  label: string;
  defaultKey: string;
  indicators: Array<{
    indicator: Indicator;
    shortLabel: string;
  }>;
}

export function groupIndicatorsByCategory(
  availableIndicators: Indicator[],
): CategorizedIndicators[] {
  const byKey = new Map<string, Indicator>(availableIndicators.map((i) => [i.key, i]));
  const usedKeys = new Set<string>();

  const result: CategorizedIndicators[] = [];

  for (const cat of INDICATOR_CATEGORIES) {
    const matched: CategorizedIndicators['indicators'] = [];
    for (const key of cat.keys) {
      const ind = byKey.get(key);
      if (ind) {
        usedKeys.add(key);
        matched.push({
          indicator: ind,
          shortLabel: cat.shortLabels[key] ?? ind.name,
        });
      }
    }

    if (matched.length > 0 && matched[0]) {
      const defaultAvailable = matched.some((m) => m.indicator.key === cat.defaultKey)
        ? cat.defaultKey
        : matched[0].indicator.key;

      result.push({
        id: cat.id,
        label: cat.label,
        defaultKey: defaultAvailable,
        indicators: matched,
      });
    }
  }
  const leftover: CategorizedIndicators['indicators'] = [];
  for (const ind of availableIndicators) {
    if (!usedKeys.has(ind.key)) {
      leftover.push({
        indicator: ind,
        shortLabel: ind.name,
      });
    }
  }

  if (leftover.length > 0) {
    const existingOther = result.find((r) => r.id === 'other');
    if (existingOther) {
      existingOther.indicators.push(...leftover);
    } else if (leftover[0]) {
      result.push({
        id: 'other',
        label: 'Outros',
        defaultKey: leftover[0].indicator.key,
        indicators: leftover,
      });
    }
  }

  return result;
}

export function getCategoryForIndicatorKey(
  key: string,
  categories: CategorizedIndicators[],
): string {
  for (const cat of categories) {
    if (cat.indicators.some((item) => item.indicator.key === key)) {
      return cat.id;
    }
  }
  return categories[0]?.id ?? '';
}

export function formatIndicatorUnit(unit?: string): string {
  if (!unit) return '';
  switch (unit) {
    case 'people':
      return 'habitantes';
    case 'people/km2':
      return 'hab. / km²';
    case 'km2':
      return 'km²';
    case 'BRL':
      return 'R$ correntes';
    case '%':
      return '%';
    case '%/year':
      return '% ao ano';
    case 'people/100k':
      return '/ 100 mil hab.';
    default:
      return unit;
  }
}
