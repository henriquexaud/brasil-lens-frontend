import type { MapClassification } from '@/api/types';
import { indicatorCategoryId, type IndicatorCategoryId } from './indicatorCategories';

const DEFAULT_RAMP = [
  '#f5f4c9',
  '#e1edbb',
  '#bce0be',
  '#87cbbd',
  '#56b3bd',
  '#3899b4',
  '#327fa6',
  '#316993',
  '#345680',
] as const;

export const PALETTES = {
  greenBrasil: ['#EAF6ED', '#C3E4CB', '#7BC48B', '#2E9C57', '#0B6B33'],
  jadeEconomico: ['#EDF7F5', '#C8E7DF', '#86C8B7', '#3C9F88', '#176A59'],
  blueOther: ['#EEF3FB', '#CCDDF5', '#91B6E5', '#4F86C6', '#24548D'],
} as const;

type PaletteKey = keyof typeof PALETTES;
const CATEGORY_PALETTES: Record<IndicatorCategoryId, PaletteKey> = {
  population: 'greenBrasil',
  economy: 'jadeEconomico',
  other: 'blueOther',
};

export function paletteForIndicator(key: string | null | undefined): readonly string[] {
  return key ? PALETTES[CATEGORY_PALETTES[indicatorCategoryId(key)]] : DEFAULT_RAMP;
}

export const NO_DATA_COLOR = '#e2e5ea';

function rampDarkest(ramp: readonly string[]): string {
  return ramp[ramp.length - 1] ?? NO_DATA_COLOR;
}

export function classColors(classes: number, ramp: readonly string[] = DEFAULT_RAMP): string[] {
  if (classes <= 1) return [rampDarkest(ramp)];
  return Array.from({ length: classes }, (_, index) => {
    const position = Math.round((index * (ramp.length - 1)) / (classes - 1));
    return ramp[position] ?? NO_DATA_COLOR;
  });
}

export function colorForClass(
  classIndex: number | null,
  classification: MapClassification | null,
  ramp: readonly string[] = DEFAULT_RAMP,
): string {
  if (classIndex === null || classification === null) return NO_DATA_COLOR;
  const colors = classColors(classification.classes, ramp);
  return colors[classIndex] ?? NO_DATA_COLOR;
}
