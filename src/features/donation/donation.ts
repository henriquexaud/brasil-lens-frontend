// Doação simulada por Pix: o valor só sobe, entre 5 centavos e 200 reais, e
// cada aumento troca o agradecimento. Valores em centavos para não somar
// frações de real com erro de ponto flutuante.

export const MIN_CENTS = 5;
export const MAX_CENTS = 20000;

export interface Piece {
  cents: number;
  label: string;
  kind: 'coin' | 'note';
  /** Cor de fundo, de longe parecida com a da moeda ou da cédula real. */
  tone: string;
  ink: string;
}

export const PIECES: Piece[] = [
  { cents: 5, label: '5¢', kind: 'coin', tone: '#C98B4A', ink: '#3B2510' },
  { cents: 10, label: '10¢', kind: 'coin', tone: '#D6B25A', ink: '#3A2C0C' },
  { cents: 25, label: '25¢', kind: 'coin', tone: '#D9B95F', ink: '#3A2C0C' },
  { cents: 50, label: '50¢', kind: 'coin', tone: '#C9CDD2', ink: '#2B3036' },
  { cents: 100, label: 'R$ 1', kind: 'coin', tone: '#D8C27A', ink: '#33290F' },
  { cents: 500, label: 'R$ 5', kind: 'note', tone: '#B9A3D6', ink: '#2E1F45' },
  { cents: 1000, label: 'R$ 10', kind: 'note', tone: '#E4A9A0', ink: '#4A1D17' },
  { cents: 2000, label: 'R$ 20', kind: 'note', tone: '#F2D27A', ink: '#4A3A0B' },
  { cents: 5000, label: 'R$ 50', kind: 'note', tone: '#E6B07D', ink: '#4A2A0E' },
  { cents: 10000, label: 'R$ 100', kind: 'note', tone: '#9EC3E6', ink: '#123A5C' },
  { cents: 20000, label: 'R$ 200', kind: 'note', tone: '#C9C1B2', ink: '#3A342A' },
];

/** Degraus do controle deslizante: finos nos centavos, largos nas notas. */
export const LADDER = [
  5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 2500, 3000,
  4000, 5000, 7500, 10000, 12500, 15000, 17500, 20000,
];

/** Degrau do controle para um valor: o maior que não passa dele. */
export function ladderIndex(cents: number): number {
  let index = 0;
  for (let i = 0; i < LADDER.length; i++) if (LADDER[i]! <= cents) index = i;
  return index;
}

/** O valor só aumenta e nunca passa de R$ 200. */
export function raise(current: number, next: number): number {
  return Math.min(MAX_CENTS, Math.max(current, next));
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const THANKS = [
  'Obrigado! Com isso, um pixel do mapa já ficou mais nítido.',
  'Muito obrigado! A gratidão aqui acabou de subir um nível de zoom.',
  'Valeu demais! Até as estradas de terra mandaram um aceno.',
  'Que generosidade! Um rio inteiro passou a correr mais contente.',
  'Obrigadíssimo! Acabamos de pavimentar uma rodovia estadual de carinho.',
  'Previsão para hoje: 100% de gratidão, com pancadas de alegria à tarde.',
  'Os 5.570 municípios agradecem, um por um, em ordem de código IBGE.',
  'Isso já dá para duplicar uma BR inteira de agradecimentos.',
  'O IBGE ainda não tem tabela para medir tanta gentileza.',
  'O satélite da tela de entrada deu mais uma volta só para comemorar.',
  'Você virou camada permanente do mapa. Obrigado mesmo!',
  'Os quantis não dão conta: sua generosidade está fora da escala.',
];

/** Agradecimento do n-ésimo aumento (0 = ainda não aumentou). */
export function thanks(raises: number, cents: number): string {
  if (cents >= MAX_CENTS)
    return 'R$ 200! Teto alcançado e coração lotado. Obrigado por acreditar no Brasil Lens.';
  if (raises === 0)
    return 'Escolha uma moeda, uma nota ou deslize o controle. Aqui o valor só sobe.';
  return (
    THANKS[raises - 1] ?? `Mais um degrau: ${formatCents(cents)}. Obrigado de novo, de verdade!`
  );
}

/** Módulos de um QR de mentira (29×29): padrão estável para cada valor, com os
 * três marcadores de canto e o centro livre para o símbolo. Não é um Pix válido. */
export function fakeQr(seed: string, size = 29): boolean[][] {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const finder = (r: number, c: number) => {
    for (const [top, left] of [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ] as const) {
      const y = r - top;
      const x = c - left;
      if (y >= -1 && y <= 7 && x >= -1 && x <= 7) {
        if (y < 0 || y > 6 || x < 0 || x > 6) return false;
        return y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4);
      }
    }
    return null;
  };
  const middle = (size - 1) / 2;
  return Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      const fixed = finder(r, c);
      if (fixed !== null) return fixed;
      if (Math.abs(r - middle) <= 3 && Math.abs(c - middle) <= 3) return false;
      return next() < 0.48;
    }),
  );
}
