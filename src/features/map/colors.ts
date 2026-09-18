/**
 * Cores da coropleta.
 *
 * Divisão de responsabilidade com a API: o backend decide **valores, intervalos
 * e normalização**; o frontend decide **cor, tema e apresentação**. Nenhuma cor
 * vem da API, e nenhuma quebra de classe é calculada aqui.
 *
 * A rampa é inspirada na YlGnBu do ColorBrewer: sequencial (transmite ordem), com extremo azul suavizado para preservar a cartografia. Como o número de classes é decidido pela API,
 * amostramos a rampa de 9 passos em vez de manter uma tabela por contagem.
 */
import type { MapClassification } from '@/api/types';

const RAMP = [
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

/** Extremo superior da rampa, usado quando há uma única classe. */
const RAMP_DARKEST = '#345680';

/** Território sem dado: cinza neutro, distinguível de qualquer passo da rampa. */
export const NO_DATA_COLOR = '#e2e5ea';

export const BORDER_COLOR = '#ffffff';
/** Realce leve e passageiro do cursor. */
export const HOVER_COLOR = '#475569';
/** Contorno assertivo e permanente do território selecionado. */
export const SELECTED_COLOR = '#0f172a';

export function classColors(classes: number): string[] {
  if (classes <= 1) return [RAMP_DARKEST];
  return Array.from({ length: classes }, (_, index) => {
    const position = Math.round((index * (RAMP.length - 1)) / (classes - 1));
    return RAMP[position] ?? NO_DATA_COLOR;
  });
}

export function colorForClass(
  classIndex: number | null,
  classification: MapClassification | null,
): string {
  if (classIndex === null || classification === null) return NO_DATA_COLOR;
  const colors = classColors(classification.classes);
  return colors[classIndex] ?? NO_DATA_COLOR;
}
