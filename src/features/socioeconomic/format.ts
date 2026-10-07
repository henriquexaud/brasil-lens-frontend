import type { TerritoryLevel } from '@/api/types';

const UNIT_SUFFIX: Record<string, string> = {
  people: 'hab.',
  km2: 'km²',
  'people/km2': 'hab./km²',
  '%': '%',
  '%/year': '% a.a.',
  'people/100k': '/100 mil hab.',
};

const UNIT_LABEL: Record<string, string> = {
  people: 'habitantes',
  km2: 'km²',
  'people/km2': 'hab./km²',
  BRL: 'R$',
  '%': '%',
  '%/year': '% ao ano',
  'people/100k': 'pessoas por 100 mil habitantes',
};

const ATTACHED_SUFFIXES = new Set(['%']);
const numberFormats = new Map<number, Intl.NumberFormat>();
const currencyFormats = new Map<number, Intl.NumberFormat>();
const scaledCurrencyFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compactFormat = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const CURRENCY_SCALES: Array<[number, string]> = [
  [1e12, 'tri'],
  [1e9, 'bi'],
  [1e6, 'mi'],
];

function numberFormat(decimalPlaces: number, currency = false): Intl.NumberFormat {
  const precision = currency ? Math.min(decimalPlaces, 2) : decimalPlaces;
  const cache = currency ? currencyFormats : numberFormats;
  let formatter = cache.get(precision);
  if (!formatter) {
    formatter = new Intl.NumberFormat('pt-BR', {
      ...(currency ? { style: 'currency', currency: 'BRL' } : {}),
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
    cache.set(precision, formatter);
  }
  return formatter;
}

export function unitLabel(unit: string): string {
  return UNIT_LABEL[unit] ?? unit;
}

export function formatValue(value: number | null, unit: string, decimalPlaces: number): string {
  if (value === null) return 'sem dado';

  if (unit === 'BRL') {
    return formatCurrency(value, decimalPlaces);
  }

  const formatted = numberFormat(decimalPlaces).format(value);

  const suffix = UNIT_SUFFIX[unit];
  if (!suffix) return formatted;
  return ATTACHED_SUFFIXES.has(suffix) ? `${formatted}${suffix}` : `${formatted} ${suffix}`;
}

function formatCurrency(value: number, decimalPlaces: number): string {
  const abs = Math.abs(value);
  for (const [threshold, label] of CURRENCY_SCALES) {
    if (abs >= threshold) {
      const scaled = scaledCurrencyFormat.format(value / threshold);
      return `R$ ${scaled} ${label}`;
    }
  }

  return numberFormat(decimalPlaces, true).format(value);
}

export function formatCompact(value: number): string {
  return compactFormat.format(value);
}

const LEVEL_LABEL: Record<TerritoryLevel, string> = {
  country: 'País',
  region: 'Região',
  state: 'Estado',
  municipality: 'Município',
};

export function levelLabel(level: TerritoryLevel): string {
  return LEVEL_LABEL[level];
}
