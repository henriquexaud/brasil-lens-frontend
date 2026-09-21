/**
 * Formatação pt-BR.
 *
 * A API entrega valor, unidade e `decimalPlaces`; aqui só transformamos isso em
 * texto. Nenhuma regra de negócio: o frontend não calcula indicador, não decide
 * intervalo e não normaliza valor.
 */
import type { TerritoryLevel } from '@/api/types';

const UNIT_SUFFIX: Record<string, string> = {
  people: 'hab.',
  km2: 'km²',
  'people/km2': 'hab./km²',
  '%': '%',
  // Taxa anualizada: sem o "a.a." o número seria lido como variação total.
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

/** O símbolo de porcentagem cola no número; as demais unidades não. */
const ATTACHED_SUFFIXES = new Set(['%']);

/**
 * Rótulo da unidade para a legenda.
 *
 * A faixa da legenda mostra números compactos ("13,5 mil"), e sem a unidade no
 * título não se sabe se são pessoas, km² ou reais.
 */
export function unitLabel(unit: string): string {
  return UNIT_LABEL[unit] ?? unit;
}

export function formatValue(value: number | null, unit: string, decimalPlaces: number): string {
  if (value === null) return 'sem dado';

  if (unit === 'BRL') {
    return formatCurrency(value, decimalPlaces);
  }

  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(value);

  const suffix = UNIT_SUFFIX[unit];
  if (!suffix) return formatted;
  return ATTACHED_SUFFIXES.has(suffix) ? `${formatted}${suffix}` : `${formatted} ${suffix}`;
}

/** Valores em reais ficam ilegíveis sem escala: R$ 3.444.814.033.000 → R$ 3,44 tri. */
function formatCurrency(value: number, decimalPlaces: number): string {
  const abs = Math.abs(value);
  const scales: Array<[number, string]> = [
    [1e12, 'tri'],
    [1e9, 'bi'],
    [1e6, 'mi'],
  ];

  for (const [threshold, label] of scales) {
    if (abs >= threshold) {
      const scaled = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value / threshold);
      return `R$ ${scaled} ${label}`;
    }
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimalPlaces > 2 ? 2 : decimalPlaces,
    maximumFractionDigits: decimalPlaces > 2 ? 2 : decimalPlaces,
  }).format(value);
}

/** Forma compacta para a legenda, onde o espaço é curto. */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
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

/**
 * Plural do nível, capitalizado ("Estados", "Municípios").
 *
 * Tabela explícita em vez de colar um "s" no rótulo singular — que produziria
 * "Regiãos" e "Paíss".
 */
const LEVEL_PLURAL_LABEL: Record<TerritoryLevel, string> = {
  country: 'Países',
  region: 'Regiões',
  state: 'Estados',
  municipality: 'Municípios',
};

export function levelPluralLabel(level: TerritoryLevel): string {
  return LEVEL_PLURAL_LABEL[level];
}

/**
 * Tempo relativo curto ("há 5 min", "há 2 h") — só faz sentido onde o dado
 * muda sozinho, sem ação do usuário (estações, alertas, frescor de fonte no
 * contexto Clima). No resto do produto o ano de referência já diz "quando" o
 * valor vale, então esta função não tem uso lá.
 */
export function formatRelativeTime(isoTimestamp: string): string {
  const diffSeconds = Math.max(
    0,
    Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 1000),
  );

  if (diffSeconds < 60) return 'agora mesmo';
  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} d`;
}
