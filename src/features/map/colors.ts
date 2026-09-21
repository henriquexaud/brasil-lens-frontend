/**
 * Cores da coropleta e paletas por contexto/variável.
 *
 * Divisão de responsabilidade com a API: o backend decide **valores, intervalos
 * e normalização**; o frontend decide **cor, tema e apresentação**. Nenhuma cor
 * vem da API, e nenhuma quebra de classe é calculada aqui.
 *
 * As famílias de cor abaixo (`PALETTES`) e o mapeamento indicador → família
 * (`INDICATOR_PALETTES`) são a fonte da verdade em código do sistema descrito
 * em `frontend/docs/COLOR_SYSTEM.md` — qualquer indicador ou camada novos
 * devem escolher uma família de lá antes de inventar cor nova.
 */
import type { MapClassification } from '@/api/types';

/**
 * Rampa neutra de fallback (estilo YlGnBu do ColorBrewer) — usada só quando um
 * indicador não tem entrada em `INDICATOR_PALETTES` (hoje, apenas
 * `disaster_affected_people`; ver `COLOR_SYSTEM.md`).
 */
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

/**
 * Famílias de cor por tipo de dado. Valores exatamente como definidos no
 * sistema de cores do produto (`COLOR_SYSTEM.md`) — não ajustar aqui sem
 * atualizar o documento.
 *
 * `electionDiverging` é a única não-sequencial: usa dois extremos que se
 * afastam de um centro neutro ("equilíbrio"), não um mínimo→máximo. Ainda sem
 * indicador que a use — ver `COLOR_SYSTEM.md`.
 */
export const PALETTES = {
  greenBrasil: ['#EAF6ED', '#C3E4CB', '#7BC48B', '#2E9C57', '#0B6B33'],
  jadeEconomico: ['#EDF7F5', '#C8E7DF', '#86C8B7', '#3C9F88', '#176A59'],
  electionDiverging: ['#1D4E89', '#7FA9D6', '#E8E3DC', '#D98C8C', '#A63232'],
  rain: ['#EDF6FD', '#BFDDF4', '#78B8E6', '#2D87C8', '#0E5A96'],
  temperature: [
    '#2454C6',
    '#2F7DE1',
    '#47B3E8',
    '#79DCE2',
    '#D8F4F0',
    '#FFF5A6',
    '#FFD447',
    '#FF9B38',
    '#F04432',
  ],
  humidity: ['#EDF9F8', '#BFE9E4', '#75CFC2', '#2EA79A', '#176D67'],
  wind: ['#F1F4FA', '#D3DDF0', '#A5B8DE', '#718EC4', '#46659E'],
  drought: ['#FBF6E9', '#EFD9A8', '#D9B56A', '#B88734', '#7F5A1E'],
  flora: ['#EEF7EA', '#CBE5BE', '#95C97B', '#4D9D4A', '#216B2E'],
  fauna: ['#FAF4E6', '#E8D3A1', '#C9AE63', '#9A7B31', '#664F1D'],
  conservation: ['#EDF8F4', '#C8E7DB', '#84C7AA', '#3F9B77', '#1E6651'],
} as const satisfies Record<string, readonly string[]>;

export type PaletteKey = keyof typeof PALETTES;

/** Faixas térmicas fixas em intervalos de 5°C (do azul profundo ao vermelho intenso). */
export const TEMPERATURE_SCALE = [
  { max: 0, color: '#2454C6', label: '≤0°', min: -Infinity, name: 'Até 0°C' },
  { max: 5, color: '#2F7DE1', label: '0–5°', min: 0, name: '0°C a 5°C' },
  { max: 10, color: '#47B3E8', label: '5–10°', min: 5, name: '5°C a 10°C' },
  { max: 15, color: '#79DCE2', label: '10–15°', min: 10, name: '10°C a 15°C' },
  { max: 20, color: '#D8F4F0', label: '15–20°', min: 15, name: '15°C a 20°C' },
  { max: 25, color: '#FFF5A6', label: '20–25°', min: 20, name: '20°C a 25°C' },
  { max: 30, color: '#FFD447', label: '25–30°', min: 25, name: '25°C a 30°C' },
  { max: 35, color: '#FF9B38', label: '30–35°', min: 30, name: '30°C a 35°C' },
  { max: Infinity, color: '#F04432', label: '>35°', min: 35, name: 'Acima de 35°C' },
] as const;

export type TemperatureBand = (typeof TEMPERATURE_SCALE)[number];

export function colorForTemperature(temp: number | null | undefined): string {
  if (temp === null || temp === undefined || Number.isNaN(temp)) {
    return NO_DATA_COLOR;
  }
  for (const band of TEMPERATURE_SCALE) {
    if (temp <= band.max) {
      return band.color;
    }
  }
  return TEMPERATURE_SCALE[TEMPERATURE_SCALE.length - 1]?.color ?? NO_DATA_COLOR;
}

export function bandForTemperature(temp: number | null | undefined): TemperatureBand | undefined {
  if (temp === null || temp === undefined || Number.isNaN(temp)) {
    return undefined;
  }
  for (const band of TEMPERATURE_SCALE) {
    if (temp <= band.max) {
      return band;
    }
  }
  return TEMPERATURE_SCALE[TEMPERATURE_SCALE.length - 1];
}

/**
 * Indicador → família de cor, para os indicadores que existem hoje.
 * `disaster_affected_people` fica de fora de propósito: nenhuma família de
 * clima descreve "pessoas afetadas por desastre", e o contexto clima está
 * deixando de usar coroplética como visão principal — ver
 * `docs/COLOR_SYSTEM.md`.
 */
const INDICATOR_PALETTES: Record<string, PaletteKey> = {
  population: 'greenBrasil',
  population_growth: 'greenBrasil',
  area_km2: 'greenBrasil',
  population_density: 'greenBrasil',
  urban_population: 'greenBrasil',
  urbanization_rate: 'greenBrasil',
  gdp: 'jadeEconomico',
  gdp_per_capita: 'jadeEconomico',
  gdp_share_national: 'jadeEconomico',
  gdp_agriculture: 'jadeEconomico',
  gdp_industry: 'jadeEconomico',
  gdp_services: 'jadeEconomico',
  household_income_per_capita: 'jadeEconomico',
  unemployment_rate: 'jadeEconomico',
};

/** Rampa de cor de um indicador — a família mapeada, ou o fallback neutro. */
export function paletteForIndicator(key: string | null | undefined): readonly string[] {
  const paletteKey = key ? INDICATOR_PALETTES[key] : undefined;
  return paletteKey ? PALETTES[paletteKey] : DEFAULT_RAMP;
}

/** Território sem dado: cinza neutro, distinguível de qualquer passo da rampa. */
export const NO_DATA_COLOR = '#e2e5ea';

/** Extremo superior da rampa, usado quando há uma única classe. */
function rampDarkest(ramp: readonly string[]): string {
  return ramp[ramp.length - 1] ?? NO_DATA_COLOR;
}

export const BORDER_COLOR = '#ffffff';
/** Realce leve e passageiro do cursor. */
export const HOVER_COLOR = '#475569';
/** Contorno assertivo e permanente do território selecionado. */
export const SELECTED_COLOR = '#0f172a';

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
