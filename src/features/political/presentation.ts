import type { PoliticalMetric, PoliticalValues, PoliticalValue } from '../../api/types';
import type { TerritoryPresentation } from '../map/TerritoryPresentation';
import { metricLabel, officeLabel } from './selection';

// Cores identificam siglas, sem ordenar ou classificar posições políticas.
const PARTY_COLORS: Record<string, string> = {
  PT: '#cf4b56',
  PL: '#3267ae',
  MDB: '#238b74',
  PSD: '#885eb2',
  PP: '#dc9742',
  REPUBLICANOS: '#4b7f91',
  PDT: '#49a8bd',
  PSB: '#c5ac36',
  PSDB: '#4b8acf',
  UNIÃO: '#9b7543',
  UNIAO: '#9b7543',
  PSOL: '#b36093',
  PODE: '#799341',
  NOVO: '#ea7843',
  AVANTE: '#3aaca0',
  SOLIDARIEDADE: '#af8a73',
  PV: '#419a59',
};
const NUMERIC_COLORS = [
  '#dcebf1',
  '#c5dde8',
  '#aecfde',
  '#95bfd3',
  '#7caec6',
  '#639db9',
  '#4a8baa',
  '#34789a',
  '#296584',
  '#1e526e',
];
type NumericBounds = readonly number[] & { readonly length: 11 };
const DEFAULT_BOUNDS: NumericBounds = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const NUMERIC_BOUNDS: Partial<Record<PoliticalMetric, NumericBounds>> = {
  leader_share: [0, 20, 30, 35, 40, 45, 50, 55, 60, 65, 100],
  margin: [0, 1, 2, 3, 5, 7.5, 10, 15, 20, 30, 100],
  turnout: [0, 50, 60, 65, 70, 75, 80, 85, 90, 95, 100],
  abstention: [0, 5, 10, 15, 20, 25, 30, 35, 40, 50, 100],
  invalid_votes: [0, 1, 2, 3, 5, 7.5, 10, 15, 20, 30, 100],
  blank_votes: [0, 0.5, 1, 2, 3, 4, 5, 7.5, 10, 20, 100],
  null_votes: [0, 0.5, 1, 2, 3, 4, 5, 7.5, 10, 20, 100],
};
export const NEUTRAL = 'var(--map-neutral, #d6ded8)';
export const TIE_COLOR = '#8d8595';

// Só ajusta caixa: não acrescenta acentos nem altera a grafia do TSE.
const NAME_PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const NAME_ACRONYMS = new Set(
  'PT PL MDB PSD PP PDT PSB PSDB PSOL PV PM PRF PC AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO II III IV VI VII VIII IX'.split(
    ' ',
  ),
);
export function candidateName(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean !== clean.toLocaleUpperCase('pt-BR')) return clean;
  return clean.replace(/\p{L}[\p{L}\p{M}]*/gu, (word, offset: number) => {
    if (NAME_ACRONYMS.has(word)) return word;
    const lower = word.toLocaleLowerCase('pt-BR');
    return offset > 0 && NAME_PARTICLES.has(lower)
      ? lower
      : lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
  });
}

export function numericBands(metric: PoliticalMetric) {
  const bounds = NUMERIC_BOUNDS[metric] ?? DEFAULT_BOUNDS;
  return NUMERIC_COLORS.map((color, i) => {
    const lower = bounds[i]!;
    const upper = bounds[i + 1]!;
    return {
      color,
      lower,
      upper,
      label: `${lower.toLocaleString('pt-BR')}–${upper.toLocaleString('pt-BR')}`,
      name: `${lower.toLocaleString('pt-BR')} a ${upper.toLocaleString('pt-BR')}${metric === 'margin' ? ' p.p.' : '%'}`,
    };
  });
}

export function numericColor(value: number, metric: PoliticalMetric) {
  const bounds = NUMERIC_BOUNDS[metric] ?? DEFAULT_BOUNDS;
  let index = 0;
  while (index < NUMERIC_COLORS.length - 1 && value >= bounds[index + 1]!) index++;
  return NUMERIC_COLORS[index]!;
}
export function categorical(metric: PoliticalMetric) {
  return ['leading_candidate', 'leading_party', 'representation'].includes(metric);
}
export function partyColor(party: string | null) {
  if (!party) return NEUTRAL;
  if (PARTY_COLORS[party]) return PARTY_COLORS[party];
  const hash = [...party].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  return `hsl(${hash % 360} 52% 46%)`;
}
export function formatMapped(item: PoliticalValue, metric: PoliticalMetric): string {
  if (item.value === null) return 'Sem dados';
  if (categorical(metric)) {
    if (item.tie) return 'Empate';
    if (!item.label) return 'Sem dados';
    return metric === 'leading_party' || item.label === item.party
      ? item.label
      : candidateName(item.label);
  }
  return `${item.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${metric === 'margin' ? ' p.p.' : '%'}`;
}
export function presentationFor(data: PoliticalValues): TerritoryPresentation {
  const numeric = !categorical(data.metric);
  return {
    key: `political:${data.year}:${data.office}:${data.round}:${data.metric}`,
    colors: new Map(
      data.values.map((item) => [
        item.ibgeCode,
        item.value === null
          ? NEUTRAL
          : numeric
            ? numericColor(item.value, data.metric)
            : item.tie
              ? TIE_COLOR
              : partyColor(item.party),
      ]),
    ),
    values: new Set(data.values.filter((item) => item.value !== null).map((item) => item.ibgeCode)),
    tooltips: new Map(
      data.values.map((item) => [
        item.ibgeCode,
        {
          value: formatMapped(item, data.metric),
          meta: `${officeLabel(data.office)} · ${data.year}${data.round ? ` · ${data.round}º turno` : ' · Eleitos no pleito'} · ${metricLabel(data.metric)}${item.party && !numeric ? ` · ${item.party}` : ''}${data.status === 'partial' ? ' · Parcial' : ''}`,
        },
      ]),
    ),
  };
}
