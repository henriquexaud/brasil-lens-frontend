// Classificação e textos das feições do OpenStreetMap nos tiles de transporte.
// Puro (sem Leaflet), para os estilos e o popup usarem a mesma regra.

export type OsmProps = Record<string, unknown>;

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** Siglas da via (`ref`), que no Brasil separam federais (BR-) e estaduais (SP-…). */
export function refs(props: OsmProps): string[] {
  return text(props.ref)
    .split(/[;/]/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

export const isFederal = (props: OsmProps) => refs(props).some((ref) => /^BR-?\d/.test(ref));
export const isState = (props: OsmProps) =>
  refs(props).some((ref) => /^[A-Z]{2}-?\d/.test(ref) && !ref.startsWith('BR'));

export const MAJOR_ROADS = new Set([
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'motorway_link',
  'trunk_link',
  'primary_link',
  'secondary_link',
  'tertiary_link',
]);

// Largura (px) de cada classe ao longo do zoom: [zoom, largura], interpolado.
const WIDTH: Record<string, [number, number][]> = {
  motorway: [
    [4, 0.8],
    [8, 1.4],
    [12, 2.4],
    [16, 4.5],
  ],
  trunk: [
    [4, 0.8],
    [8, 1.4],
    [12, 2.4],
    [16, 4.5],
  ],
  primary: [
    [7, 0.7],
    [10, 1.2],
    [13, 2],
    [16, 3.6],
  ],
  secondary: [
    [9, 0.6],
    [12, 1.2],
    [16, 3],
  ],
  tertiary: [
    [10, 0.5],
    [13, 1],
    [16, 2.4],
  ],
  link: [
    [9, 0.4],
    [13, 0.9],
    [16, 1.8],
  ],
  minor: [
    [12, 0.35],
    [14, 0.8],
    [16, 1.6],
  ],
};

function interpolate(stops: [number, number][], zoom: number): number {
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  if (zoom <= first[0]) return first[1];
  if (zoom >= last[0]) return last[1];
  for (let index = 1; index < stops.length; index++) {
    const [z1, w1] = stops[index - 1]!;
    const [z2, w2] = stops[index]!;
    if (zoom <= z2) return w1 + ((w2 - w1) * (zoom - z1)) / (z2 - z1);
  }
  return last[1];
}

export function roadWidth(roadClass: string, zoom: number): number {
  const key = roadClass.endsWith('_link') ? 'link' : roadClass in WIDTH ? roadClass : 'minor';
  return interpolate(WIDTH[key]!, zoom);
}

const ROAD_LABEL: Record<string, string> = {
  motorway: 'Rodovia de pista dupla',
  trunk: 'Rodovia principal',
  primary: 'Via primária',
  secondary: 'Via secundária',
  tertiary: 'Via terciária',
  unclassified: 'Via local',
  residential: 'Rua',
  living_street: 'Rua de pedestres e veículos',
  road: 'Via',
};
const RAIL_LABEL: Record<string, string> = {
  rail: 'Ferrovia',
  narrow_gauge: 'Ferrovia de bitola estreita',
  light_rail: 'VLT',
  subway: 'Metrô',
  tram: 'Bonde',
  monorail: 'Monotrilho',
  funicular: 'Funicular',
};
const SURFACE: Record<string, string> = {
  asphalt: 'Asfalto',
  paved: 'Pavimentada',
  concrete: 'Concreto',
  paving_stones: 'Paralelepípedo',
  sett: 'Paralelepípedo',
  cobblestone: 'Paralelepípedo',
  unpaved: 'Sem pavimento',
  gravel: 'Cascalho',
  compacted: 'Terra compactada',
  dirt: 'Terra',
  earth: 'Terra',
  ground: 'Terra',
  sand: 'Areia',
};
const USAGE: Record<string, string> = {
  main: 'Linha principal',
  branch: 'Ramal',
  industrial: 'Industrial',
  tourism: 'Turística',
  military: 'Militar',
};

export interface OsmDetail {
  title: string;
  kind: string;
  rows: { label: string; value: string }[];
}

/** O que o popup mostra de uma feição clicada, em pt-BR. */
export function describe(layer: string, props: OsmProps): OsmDetail {
  const name = text(props.name);
  const ref = refs(props).join(' / ');
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: string | undefined) => {
    if (value) rows.push({ label, value });
  };
  if (layer === 'roads') {
    const kind = ROAD_LABEL[text(props.class)] ?? 'Via';
    add('Superfície', SURFACE[text(props.surface)]);
    if (ref && name) add('Nome', name);
    return { title: ref || name || kind, kind, rows };
  }
  if (layer === 'cycle') {
    const kind = props.class === 'lane' ? 'Ciclofaixa' : 'Ciclovia';
    return { title: name || kind, kind, rows };
  }
  if (layer === 'rail') {
    const kind = RAIL_LABEL[text(props.class)] ?? 'Ferrovia';
    add('Uso', USAGE[text(props.usage)]);
    add('Operação', text(props.operator));
    return { title: name || kind, kind, rows };
  }
  if (layer === 'stations') {
    const kind = props.station === 'subway' ? 'Estação de metrô' : 'Estação';
    add('Rede', text(props.network));
    return { title: name || kind, kind, rows };
  }
  if (layer === 'ferry') return { title: name || 'Balsa', kind: 'Travessia por balsa', rows };
  return { title: name || 'Feição', kind: '', rows };
}
