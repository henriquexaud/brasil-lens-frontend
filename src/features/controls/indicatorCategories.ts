import type { Indicator } from '@/api/types';

export interface IndicatorCategoryConfig {
  id: string;
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
    keys: [
      'area_km2',
      'household_income_per_capita',
      'unemployment_rate',
    ],
    defaultKey: 'area_km2',
    shortLabels: {
      area_km2: 'Área territorial',
      household_income_per_capita: 'Renda domiciliar',
      unemployment_rate: 'Taxa de desemprego',
    },
  },
];

export interface CategorizedIndicators {
  id: string;
  label: string;
  defaultKey: string;
  indicators: Array<{
    indicator: Indicator;
    shortLabel: string;
  }>;
}

/**
 * Agrupa os indicadores da API nas 3 categorias principais:
 * População, Economia e Outros.
 */
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
      // Usa como defaultKey o primeiro disponível caso o defaultKey canônico não esteja presente
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

  // Captura indicadores não mapeados em nenhuma categoria e anexa a "Outros"
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

/**
 * Retorna o ID da categoria à qual pertence o indicador selecionado.
 */
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

/**
 * Rótulo amigável curto de unidade para badge de metadados.
 */
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
