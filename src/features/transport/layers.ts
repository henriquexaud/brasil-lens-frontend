import type { BoundingBox, TransportLayer } from '@/api/types';

export type TransportTab = 'roads' | 'rail' | 'waterways';
export type RoadMode = 'federal' | 'state' | 'all';

export interface TransportPreferences {
  tab: TransportTab;
  roads: RoadMode;
}

export const DEFAULT_TRANSPORT: TransportPreferences = { tab: 'roads', roads: 'all' };

const TABS: TransportTab[] = ['roads', 'rail', 'waterways'];
// A primeira versão guardava a camada oficial (`road_federal`…) e as ruas do IBGE.
const LEGACY_ROADS: Record<string, RoadMode> = {
  road_federal: 'federal',
  road_state: 'state',
  road_local: 'all',
};

export function normalizeTransport(value: unknown): TransportPreferences | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const item = value as Record<string, unknown>;
  const roads = LEGACY_ROADS[String(item.roads)] ?? item.roads;
  if (!TABS.includes(item.tab as TransportTab)) return undefined;
  if (roads !== 'federal' && roads !== 'state' && roads !== 'all') return undefined;
  return { tab: item.tab as TransportTab, roads };
}

export const TAB_OPTIONS: { value: TransportTab; label: string }[] = [
  { value: 'roads', label: 'Rodovias' },
  { value: 'rail', label: 'Ferrovias' },
  { value: 'waterways', label: 'Hidrovias' },
];

export const ROAD_OPTIONS: { value: RoadMode; label: string; title: string }[] = [
  {
    value: 'all',
    label: 'Todas',
    title: 'Toda a malha viária; ruas e ciclovias aparecem ao aproximar o mapa',
  },
  { value: 'federal', label: 'Federais', title: 'Rodovias federais (BR)' },
  { value: 'state', label: 'Estaduais', title: 'Rodovias estaduais e distritais' },
];

// Cores do traçado, iguais nos dois temas e fora das famílias de alerta e fogo.
export const COLORS = {
  road: '#A15C07',
  roadMinor: '#C69458',
  context: '#9AA3AF',
  cycle: '#1F8A70',
  rail: '#6D3FC0',
  railUrban: '#9474D6',
  water: '#0E6BA8',
} as const;

export const LAYER_STYLE: Record<TransportLayer, { color: string; weight: number }> = {
  road_federal: { color: COLORS.road, weight: 1.7 },
  road_state: { color: COLORS.road, weight: 1.3 },
  road_local: { color: COLORS.road, weight: 0.9 },
  rail: { color: COLORS.rail, weight: 1.5 },
  waterway: { color: COLORS.water, weight: 1.7 },
  port: { color: COLORS.water, weight: 1 },
};

export const LAYER_LABEL: Record<TransportLayer, string> = {
  road_federal: 'Rodovias federais',
  road_state: 'Rodovias estaduais',
  road_local: 'Rodovias locais',
  rail: 'Ferrovias',
  waterway: 'Hidrovias',
  port: 'Portos',
};

/** Extensão oficial (DNIT/IBGE) que o painel destaca em cada aba e modo. */
export function summaryLayers(preferences: TransportPreferences): TransportLayer[] {
  if (preferences.tab === 'rail') return ['rail'];
  if (preferences.tab === 'waterways') return ['waterway'];
  if (preferences.roads === 'federal') return ['road_federal'];
  if (preferences.roads === 'state') return ['road_state'];
  return ['road_federal', 'road_state', 'road_local'];
}

// Mesmas faixas de `services/transport.DETAILS` no backend.
export function networkDetail(zoom: number): number {
  return zoom < 6 ? 4 : zoom < 8 ? 6 : zoom < 10 ? 8 : 10;
}

const GRID: Record<number, number> = { 6: 4, 8: 1, 10: 0.25 };

/** Área pedida à API: a vista encaixada numa grade grossa, para pequenos
 * deslocamentos reaproveitarem a mesma resposta. Sem área abaixo do zoom 6.
 * Dentro de uma UF, a área não passa da UF. */
export function networkArea(
  detail: number,
  bbox: string | undefined,
  limit?: BoundingBox | null,
): string | undefined {
  const step = GRID[detail];
  if (!step || !bbox) return undefined;
  const [west = 0, south = 0, east = 0, north = 0] = bbox.split(',').map(Number);
  const floor = (value: number) => Math.floor(value / step) * step;
  const ceil = (value: number) => Math.ceil(value / step) * step;
  const area = [
    Math.max(-180, floor(west), limit ? floor(limit[0]) : -180),
    Math.max(-90, floor(south), limit ? floor(limit[1]) : -90),
    Math.min(180, ceil(east), limit ? ceil(limit[2]) : 180),
    Math.min(90, ceil(north), limit ? ceil(limit[3]) : 90),
  ];
  if (area[0]! >= area[2]! || area[1]! >= area[3]!) return undefined;
  return area.map((value) => value.toFixed(2)).join(',');
}

const ATTRIBUTE_LABELS: Record<string, string> = {
  snv: 'Código SNV',
  stretch: 'Trecho',
  surface: 'Superfície',
  administration: 'Administração',
  concession: 'Concessão',
  gauge: 'Bitola',
  electrified: 'Eletrificada',
  operator: 'Operação',
  operating: 'Em operação',
  regime: 'Regime',
  cargo: 'Transporte',
};

export function attributeRows(attributes: Record<string, string> | null | undefined) {
  return Object.entries(attributes ?? {})
    .filter(([key]) => key in ATTRIBUTE_LABELS)
    .map(([key, value]) => ({ label: ATTRIBUTE_LABELS[key]!, value }));
}

export function formatTotal(layer: TransportLayer, value: number | null | undefined): string {
  if (value == null) return 'Sem dados';
  if (layer === 'port') {
    return value === 1 ? '1 porto' : `${value.toLocaleString('pt-BR')} portos`;
  }
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: value < 100 ? 1 : 0 })} km`;
}
