import { useEffect, useMemo, useRef, useState } from 'react';
import type { GridLayer, LeafletMouseEvent } from 'leaflet';
import { Popup, useMapEvents } from 'react-leaflet';
import {
  CircleSymbolizer,
  LineSymbolizer,
  leafletLayer,
  type Feature,
  type LeafletLayerOptions,
  type PaintRule,
} from 'protomaps-leaflet';
import { COLORS, type TransportPreferences } from './layers';
import { sharpenGridLayer } from './sharpTiles';
import { MAJOR_ROADS, describe, isFederal, isState, roadWidth, type OsmDetail } from './osm';

const PANE = 'transport-osm';
const IDENTIFY_PIXELS = 8;
const MIN_IDENTIFY_ZOOM = 6;
// Acima do zoom dos dados, os tiles do último zoom são ampliados (overzoom).
const MAX_ZOOM = 16;

const roadClass = (feature?: Feature) => String(feature?.props.class ?? '');
const width =
  (scale = 1, extra = 0) =>
  (zoom: number, feature?: Feature) =>
    roadWidth(roadClass(feature), zoom) * scale + extra;

function roadRules(mode: TransportPreferences['roads']): PaintRule[] {
  if (mode === 'all') {
    return [
      {
        dataLayer: 'roads',
        filter: (_, f) => !MAJOR_ROADS.has(roadClass(f)),
        symbolizer: new LineSymbolizer({ color: COLORS.roadMinor, width: width(), opacity: 0.9 }),
      },
      {
        dataLayer: 'cycle',
        filter: (_, f) => f.props.class === 'cycleway',
        symbolizer: new LineSymbolizer({ color: COLORS.cycle, width: 1.6 }),
      },
      {
        dataLayer: 'cycle',
        filter: (_, f) => f.props.class === 'lane',
        symbolizer: new LineSymbolizer({ color: COLORS.cycle, width: 1.6, dash: [3, 3] }),
      },
      {
        dataLayer: 'roads',
        filter: (_, f) => MAJOR_ROADS.has(roadClass(f)),
        symbolizer: new LineSymbolizer({ color: COLORS.road, width: width() }),
      },
    ];
  }
  const selected = mode === 'federal' ? isFederal : isState;
  return [
    // O resto da malha fica como contexto discreto, para a rede escolhida se destacar.
    {
      dataLayer: 'roads',
      filter: (_, f) => !selected(f.props),
      symbolizer: new LineSymbolizer({ color: COLORS.context, width: width(0.7), opacity: 0.55 }),
    },
    {
      dataLayer: 'roads',
      filter: (_, f) => selected(f.props),
      symbolizer: new LineSymbolizer({ color: COLORS.road, width: width(1, 0.4) }),
    },
  ];
}

const URBAN_RAIL = new Set(['subway', 'light_rail', 'tram', 'monorail', 'funicular']);

function railRules(): PaintRule[] {
  return [
    {
      dataLayer: 'rail',
      filter: (_, f) => !URBAN_RAIL.has(String(f.props.class)),
      symbolizer: new LineSymbolizer({
        color: COLORS.rail,
        width: (z: number, f?: Feature) => (f?.props.service ? 0.6 : z < 8 ? 1.2 : 1.8),
        opacity: (_: number, f?: Feature) => (f?.props.service ? 0.6 : 1),
      }),
    },
    {
      dataLayer: 'rail',
      filter: (_, f) => URBAN_RAIL.has(String(f.props.class)),
      symbolizer: new LineSymbolizer({ color: COLORS.railUrban, width: 2, dash: [5, 3] }),
    },
    {
      dataLayer: 'stations',
      minzoom: 12,
      symbolizer: new CircleSymbolizer({
        radius: 3,
        fill: '#ffffff',
        stroke: COLORS.rail,
        width: 1.5,
      }),
    },
  ];
}

function waterRules(): PaintRule[] {
  return [
    {
      dataLayer: 'ferry',
      symbolizer: new LineSymbolizer({ color: COLORS.water, width: 1.4, dash: [4, 4] }),
    },
  ];
}

export function paintRules(preferences: TransportPreferences): PaintRule[] {
  if (preferences.tab === 'rail') return railRules();
  if (preferences.tab === 'waterways') return waterRules();
  return roadRules(preferences.roads);
}

// Camadas dos tiles que o clique consulta em cada aba.
const IDENTIFIABLE: Record<TransportPreferences['tab'], string[]> = {
  roads: ['cycle', 'roads'],
  rail: ['stations', 'rail'],
  waterways: ['ferry'],
};

export function OsmTransportLayer({
  url,
  maxDataZoom,
  preferences,
}: {
  url: string;
  maxDataZoom: number;
  preferences: TransportPreferences;
}) {
  const layerRef = useRef<ReturnType<typeof leafletLayer> | null>(null);
  const [picked, setPicked] = useState<{ position: [number, number]; detail: OsmDetail } | null>(
    null,
  );
  const timer = useRef<number>();
  const rules = useMemo(() => paintRules(preferences), [preferences]);
  const map = useMapEvents({
    click(event: LeafletMouseEvent) {
      window.clearTimeout(timer.current);
      const layer = layerRef.current;
      if (!layer || map.getZoom() < MIN_IDENTIFY_ZOOM) return;
      const { lat, lng } = event.latlng;
      // Espera o duplo clique (que abre o território) antes de mostrar a via.
      timer.current = window.setTimeout(() => {
        const wanted = IDENTIFIABLE[preferences.tab];
        const found = [...layer.queryTileFeaturesDebug(lng, lat, IDENTIFY_PIXELS).values()]
          .flat()
          .filter((item) => wanted.includes(item.layerName))
          .sort((a, b) => wanted.indexOf(a.layerName) - wanted.indexOf(b.layerName))[0];
        setPicked(
          found
            ? { position: [lat, lng], detail: describe(found.layerName, found.feature.props) }
            : null,
        );
      }, 240);
    },
    dblclick() {
      window.clearTimeout(timer.current);
      setPicked(null);
    },
    movestart() {
      window.clearTimeout(timer.current);
    },
  });
  useEffect(() => {
    // O pane nasce antes da camada (o GridLayer não cria o próprio).
    if (!map.getPane(PANE)) {
      const pane = map.createPane(PANE);
      pane.style.zIndex = '438';
      pane.style.pointerEvents = 'none';
    }
    const layer = leafletLayer({
      url,
      maxDataZoom,
      // Nossos tiles são de 256 px (Planetiler). O padrão do protomaps-leaflet (1)
      // supõe 512 px e desenhava cada tile com os dados de um zoom abaixo: ruas e
      // estaduais entravam um zoom depois, com a geometria simplificada demais.
      levelDiff: 0,
      maxZoom: MAX_ZOOM,
      pane: PANE,
      paintRules: rules,
      labelRules: [],
      // Tiles só depois do gesto: durante a animação, níveis intermediários
      // eram pedidos e abandonados.
      updateWhenZooming: false,
      attribution:
        '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>',
    } as LeafletLayerOptions);
    const unsharpen = sharpenGridLayer(layer as unknown as GridLayer, map);
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      unsharpen();
      layer.remove();
      layerRef.current = null;
    };
    // As regras mudam sem recriar a camada (efeito abaixo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, url, maxDataZoom]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || layer.paintRules === rules) return;
    layer.paintRules = rules;
    layer.rerenderTiles();
    setPicked(null);
  }, [rules]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <>
      {picked && (
        <Popup
          key={picked.position.join(',')}
          position={picked.position}
          className="fire-popup transport-popup"
          maxWidth={285}
          autoPan={false}
        >
          <strong className="fire-popup-title">{picked.detail.title}</strong>
          {picked.detail.kind && picked.detail.kind !== picked.detail.title && (
            <span className="fire-popup-meta">{picked.detail.kind}</span>
          )}
          {picked.detail.rows.length > 0 && (
            <dl className="fire-metrics">
              {picked.detail.rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="source-note">OpenStreetMap</p>
        </Popup>
      )}
    </>
  );
}
