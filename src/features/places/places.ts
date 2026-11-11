import type { PlaceContext, PlaceLayer, SpeciesGroup } from '@/api/types';

export interface PlaceTab {
  key: string;
  label: string;
  layer: PlaceLayer;
  /** Título do painel e da legenda. */
  title: string;
  one: string;
  many: string;
  /** Rótulo da opção sem filtro de categoria. */
  all: string;
  note: string;
  /** A aba mostra as espécies registradas no território, e não uma lista de lugares. */
  species?: boolean;
  /** Lugar aonde se vai: o popup oferece o caminho até lá. */
  directions?: boolean;
}

interface ContextConfig {
  tabs: PlaceTab[];
  accent: string;
  /** Dez tons, do mais claro ao mais escuro: contagem de lugares por território. */
  ramp: readonly string[];
  /** As ruas do OpenStreetMap entram de perto, para dar endereço ao ponto. */
  streets?: boolean;
}

function channel(from: string, to: string, offset: number, t: number): string {
  const a = parseInt(from.slice(offset, offset + 2), 16);
  const b = parseInt(to.slice(offset, offset + 2), 16);
  return Math.round(a + (b - a) * t)
    .toString(16)
    .padStart(2, '0');
}

/** Dez tons a partir dos cinco de referência: a barra da legenda é a mesma dos outros contextos. */
export function expandRamp(stops: readonly string[], size = 10): string[] {
  return Array.from({ length: size }, (_, index) => {
    const position = (index * (stops.length - 1)) / (size - 1);
    const base = Math.min(stops.length - 2, Math.floor(position));
    const [from, to] = [stops[base]!, stops[base + 1]!];
    return `#${[1, 3, 5].map((offset) => channel(from, to, offset, position - base)).join('')}`;
  });
}

export const PLACE_CONTEXTS: Record<PlaceContext, ContextConfig> = {
  nature: {
    accent: '#2B7A66',
    ramp: expandRamp(['#E0F0EC', '#B5D9D0', '#82BDB0', '#4C9D8D', '#1F776A']),
    tabs: [
      {
        key: 'species',
        label: 'Espécies',
        layer: 'biome',
        title: 'Biomas',
        one: 'bioma',
        many: 'biomas',
        all: 'Todos',
        note: 'Biomas do IBGE; espécies pelos registros de ocorrência do GBIF.',
        species: true,
      },
      {
        key: 'protected',
        label: 'Protegidas',
        layer: 'conservation_unit',
        title: 'Unidades de conservação',
        one: 'unidade',
        many: 'unidades',
        all: 'Todas',
        note: 'Unidades de conservação ativas no Cadastro Nacional (CNUC/MMA) que entram no território.',
      },
      {
        key: 'caves',
        label: 'Cavernas',
        layer: 'cave',
        title: 'Cavernas',
        one: 'caverna',
        many: 'cavernas',
        all: 'Todas',
        note: 'Cavidades naturais registradas no Cadastro Nacional de Informações Espeleológicas (ICMBio).',
        directions: true,
      },
    ],
  },
  resources: {
    accent: '#A3613C',
    ramp: expandRamp(['#F7E9E0', '#EDCDB9', '#DEA98A', '#C7825E', '#A35C3B']),
    tabs: [
      {
        key: 'mining',
        label: 'Lavras',
        layer: 'mining_title',
        title: 'Lavras autorizadas',
        one: 'lavra',
        many: 'lavras',
        all: 'Todas as substâncias',
        note: 'Processos minerários em fase de lavra (concessão, licenciamento, garimpo e registro de extração) no SIGMINE da ANM.',
      },
      {
        key: 'occurrences',
        label: 'Ocorrências',
        layer: 'mineral_occurrence',
        title: 'Ocorrências minerais',
        one: 'ocorrência',
        many: 'ocorrências',
        all: 'Todas as substâncias',
        note: 'Minas, garimpos, depósitos e indícios cadastrados pelo Serviço Geológico do Brasil.',
      },
      {
        key: 'oil',
        label: 'Petróleo',
        layer: 'oil_field',
        title: 'Campos de produção',
        one: 'campo',
        many: 'campos',
        all: 'Todos',
        note: 'Campos de produção de petróleo e gás natural sob contrato na ANP.',
      },
    ],
  },
  sports: {
    accent: '#B8437B',
    ramp: expandRamp(['#FBE9F1', '#F4C6DB', '#E99BBF', '#D96A9E', '#B8437B']),
    streets: true,
    tabs: [
      {
        key: 'places',
        label: 'Esportes',
        layer: 'sport',
        title: 'Locais de esporte',
        one: 'local',
        many: 'locais',
        all: 'Todos os esportes',
        note: 'Quadras, campos, pistas e piscinas de acesso aberto mapeados no OpenStreetMap; onde o mapeamento é incompleto, faltam locais.',
        directions: true,
      },
    ],
  },
};

// Cores das áreas, iguais nos dois temas.
export const AREA_COLORS: Record<string, string> = {
  amazon: '#2F7D4F',
  atlantic_forest: '#2A9D8F',
  cerrado: '#D9A441',
  caatinga: '#C97B4A',
  pampa: '#A7C957',
  pantanal: '#4A90B8',
  full_protection: '#1F6F50',
  sustainable_use: '#7FB77E',
  oil: '#4A4E69',
  gas: '#3E8FB0',
};

export const SPECIES_GROUPS: { value: SpeciesGroup; label: string; noun: string }[] = [
  { value: 'birds', label: 'Aves', noun: 'aves' },
  { value: 'mammals', label: 'Mamíferos', noun: 'mamíferos' },
  { value: 'reptiles', label: 'Répteis', noun: 'répteis' },
  { value: 'amphibians', label: 'Anfíbios', noun: 'anfíbios' },
  { value: 'insects', label: 'Insetos', noun: 'insetos' },
  { value: 'plants', label: 'Plantas', noun: 'plantas' },
  { value: 'fungi', label: 'Fungos', noun: 'fungos' },
  { value: 'threatened', label: 'Ameaçadas', noun: 'espécies ameaçadas' },
];

export const THREAT_LABEL = {
  CR: 'Criticamente em perigo',
  EN: 'Em perigo',
  VU: 'Vulnerável',
} as const;

export interface PlacePreferences {
  tab: string;
  /** Categoria escolhida em cada aba; ausente é "todas". */
  categories: Record<string, string>;
  group: SpeciesGroup;
}

export type PlacesSession = Partial<Record<PlaceContext, PlacePreferences>>;

export function defaultPreferences(context: PlaceContext): PlacePreferences {
  return { tab: PLACE_CONTEXTS[context].tabs[0]!.key, categories: {}, group: 'birds' };
}

function normalizeOne(context: PlaceContext, value: unknown): PlacePreferences | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const item = value as Record<string, unknown>;
  const tabs = PLACE_CONTEXTS[context].tabs.map((tab) => tab.key);
  if (!tabs.includes(String(item.tab))) return undefined;
  const categories: Record<string, string> = {};
  if (typeof item.categories === 'object' && item.categories !== null) {
    for (const [tab, category] of Object.entries(item.categories))
      if (tabs.includes(tab) && typeof category === 'string' && /^[a-z_]{1,32}$/.test(category))
        categories[tab] = category;
  }
  const group = SPECIES_GROUPS.some((option) => option.value === item.group)
    ? (item.group as SpeciesGroup)
    : 'birds';
  return { tab: String(item.tab), categories, group };
}

export function normalizePlaces(value: unknown): PlacesSession | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const source = value as Record<string, unknown>;
  const result: PlacesSession = {};
  for (const context of Object.keys(PLACE_CONTEXTS) as PlaceContext[]) {
    const preferences = normalizeOne(context, source[context]);
    if (preferences) result[context] = preferences;
  }
  return Object.keys(result).length ? result : undefined;
}

/**
 * Área dos pontos de perto, numa grade mais fina que a do traçado: numa cidade
 * grande, a célula grossa passa do teto de pontos da API e a vista ficaria com
 * buracos que nenhum zoom resolve.
 */
export function pointArea(zoom: number, bbox: string | undefined): string | undefined {
  if (!bbox) return undefined;
  const step = zoom >= 14 ? 0.02 : 0.1;
  const [west = 0, south = 0, east = 0, north = 0] = bbox.split(',').map(Number);
  const snap = (value: number, round: (value: number) => number) =>
    (round(value / step) * step).toFixed(2);
  return [
    snap(west, Math.floor),
    snap(south, Math.floor),
    snap(east, Math.ceil),
    snap(north, Math.ceil),
  ].join(',');
}

export function formatCount(value: number): string {
  return value.toLocaleString('pt-BR');
}

export function countLabel(value: number, tab: PlaceTab): string {
  return `${formatCount(value)} ${value === 1 ? tab.one : tab.many}`;
}

export interface CountScale {
  /** Limite superior (inclusive) de cada faixa, em ordem. */
  breaks: number[];
  colors: string[];
}

/**
 * Faixas de contagem por quantis dos territórios com pelo menos um lugar. Com
 * poucos valores distintos, cada valor vira uma faixa.
 */
export function countScale(values: number[], ramp: readonly string[]): CountScale | null {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const breaks: number[] = [];
  for (let index = 1; index <= ramp.length; index++) {
    const position = Math.ceil((index * sorted.length) / ramp.length) - 1;
    const value = sorted[Math.max(0, position)]!;
    if (breaks[breaks.length - 1] !== value) breaks.push(value);
  }
  const colors = breaks.map((_, index) => {
    const position =
      breaks.length === 1
        ? ramp.length - 1
        : Math.round((index * (ramp.length - 1)) / (breaks.length - 1));
    return ramp[position]!;
  });
  return { breaks, colors };
}

export function colorForCount(value: number, scale: CountScale): string {
  const index = scale.breaks.findIndex((limit) => value <= limit);
  return scale.colors[index < 0 ? scale.colors.length - 1 : index]!;
}

export function scaleBands(scale: CountScale): { color: string; label: string }[] {
  return scale.breaks.map((limit, index) => {
    const from = index === 0 ? 1 : scale.breaks[index - 1]! + 1;
    return {
      color: scale.colors[index]!,
      label: from === limit ? formatCount(limit) : `${formatCount(from)}–${formatCount(limit)}`,
    };
  });
}
