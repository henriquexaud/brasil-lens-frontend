import type { BoundingBox, TransportLayer } from '@/api/types';

export type TransportTab = 'roads' | 'rail' | 'waterways';
export type RoadClass = 'road_federal' | 'road_state' | 'road_local';

export interface TransportPreferences {
  tab: TransportTab;
  roads: RoadClass;
  showStreets: boolean;
}

export const DEFAULT_TRANSPORT: TransportPreferences = {
  tab: 'roads',
  roads: 'road_federal',
  showStreets: false,
};

const TABS: TransportTab[] = ['roads', 'rail', 'waterways'];
const ROAD_CLASSES: RoadClass[] = ['road_federal', 'road_state', 'road_local'];

export function validTransport(value: unknown): value is TransportPreferences {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    TABS.includes(item.tab as TransportTab) &&
    ROAD_CLASSES.includes(item.roads as RoadClass) &&
    typeof item.showStreets === 'boolean'
  );
}

export const TAB_OPTIONS: { value: TransportTab; label: string }[] = [
  { value: 'roads', label: 'Rodovias' },
  { value: 'rail', label: 'Ferrovias' },
  { value: 'waterways', label: 'Hidrovias' },
];

export const ROAD_OPTIONS: { value: RoadClass; label: string; title: string }[] = [
  { value: 'road_federal', label: 'Federais', title: 'Rodovias federais do SNV (DNIT)' },
  { value: 'road_state', label: 'Estaduais', title: 'Rodovias estaduais e distritais' },
  {
    value: 'road_local',
    label: 'Locais',
    title: 'Rodovias municipais e sem jurisdição informada',
  },
];

// Cores do traçado, iguais nos dois temas e fora das famílias de alerta e fogo.
export const LAYER_STYLE: Record<TransportLayer, { color: string; weight: number }> = {
  road_federal: { color: '#A15C07', weight: 1.7 },
  road_state: { color: '#A15C07', weight: 1.3 },
  road_local: { color: '#A15C07', weight: 0.9 },
  rail: { color: '#6D3FC0', weight: 1.5 },
  waterway: { color: '#0E6BA8', weight: 1.7 },
  port: { color: '#0E6BA8', weight: 1 },
};

export const LAYER_LABEL: Record<TransportLayer, string> = {
  road_federal: 'Rodovias federais',
  road_state: 'Rodovias estaduais',
  road_local: 'Rodovias locais',
  rail: 'Ferrovias',
  waterway: 'Hidrovias',
  port: 'Portos',
};

/** Camadas de linha desenhadas em cada aba; Hidrovias também mostra os portos. */
export function lineLayer(preferences: TransportPreferences): TransportLayer {
  if (preferences.tab === 'rail') return 'rail';
  if (preferences.tab === 'waterways') return 'waterway';
  return preferences.roads;
}

// Mesmas faixas de `services/transport.DETAILS` no backend.
export function networkDetail(zoom: number): number {
  return zoom < 6 ? 4 : zoom < 8 ? 6 : zoom < 10 ? 8 : 10;
}

const GRID: Record<number, number> = { 6: 4, 8: 1, 10: 0.25 };

/** Área pedida à API: a vista encaixada numa grade grossa, para pequenos
 * deslocamentos reaproveitarem a mesma resposta. Sem área abaixo do zoom 6.
 * Dentro de uma UF, a área não passa da UF: na vista regional, a tela inteira
 * pegaria as estaduais de meio país. */
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
