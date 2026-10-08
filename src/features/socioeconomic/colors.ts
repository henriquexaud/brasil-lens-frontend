import type { MapClassification } from '@/api/types';
import { indicatorCategoryId, type IndicatorCategoryId } from './indicatorCategories';

export const PALETTES = {
  greenBrasil: [
    '#EAF6ED',
    '#D9EEDE',
    '#C7E6CF',
    '#ABD9B6',
    '#8BCB99',
    '#6ABB7F',
    '#48A968',
    '#2A9753',
    '#1B8143',
    '#0B6B33',
  ],
  jadeEconomico: [
    '#EDF7F5',
    '#DDF0EB',
    '#CCE9E1',
    '#B2DDD2',
    '#95CFC0',
    '#76BFAD',
    '#55AD98',
    '#389983',
    '#27826E',
    '#176A59',
  ],
  blueOther: [
    '#EEF3FB',
    '#DFE9F8',
    '#D0DFF6',
    '#B8D0F0',
    '#9EBFE9',
    '#82ABDE',
    '#6596D0',
    '#4A80C0',
    '#376AA6',
    '#24548D',
  ],
} as const;

const DEFAULT_RAMP = PALETTES.greenBrasil;

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
