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
  // Meio ambiente: terra para desmatamento (distinta do vermelho dos focos) e
  // verde-musgo para floresta (distinto do verde de População).
  earthDeforestation: [
    '#FAF1E4',
    '#F4E0C2',
    '#EDCB9C',
    '#E4B277',
    '#D99757',
    '#C97D41',
    '#B36533',
    '#994F29',
    '#7C3D22',
    '#5F2E1B',
  ],
  mossForest: [
    '#EEF5E7',
    '#DCEACB',
    '#C5DCA9',
    '#A9CB86',
    '#8AB866',
    '#6BA34E',
    '#4F8B3D',
    '#387331',
    '#265C27',
    '#17461D',
  ],
  // Educação: violeta, distinto dos verdes, do azul de Outros e das cores do clima.
  violetEducation: [
    '#F3F0FA',
    '#E6E0F5',
    '#D7CDEF',
    '#C2B3E6',
    '#AA96DB',
    '#917ACD',
    '#7A60BD',
    '#6449A9',
    '#4F3792',
    '#3C2878',
  ],
} as const;

const DEFAULT_RAMP = PALETTES.greenBrasil;

type PaletteKey = keyof typeof PALETTES;
const CATEGORY_PALETTES: Record<IndicatorCategoryId, PaletteKey> = {
  population: 'greenBrasil',
  economy: 'jadeEconomico',
  other: 'blueOther',
};

const INDICATOR_PALETTES: Record<string, PaletteKey> = {
  deforestation_prodes: 'earthDeforestation',
  forest_cover: 'mossForest',
};

export function paletteForIndicator(key: string | null | undefined): readonly string[] {
  if (!key) return DEFAULT_RAMP;
  // Toda rede e tipo da Educação (higher_ed_*) usa a mesma paleta.
  if (key.startsWith('higher_ed_')) return PALETTES.violetEducation;
  return PALETTES[INDICATOR_PALETTES[key] ?? CATEGORY_PALETTES[indicatorCategoryId(key)]];
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
