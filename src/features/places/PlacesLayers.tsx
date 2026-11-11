import { useEffect, useMemo, useRef } from 'react';
import {
  canvas,
  circleMarker,
  divIcon,
  marker,
  layerGroup,
  type LayerGroup,
  type LeafletMouseEvent,
  type PathOptions,
  type Popup as LeafletPopup,
  type Renderer,
} from 'leaflet';
import { GeoJSON, Pane, Popup, useMap, useMapEvents } from 'react-leaflet';
import type { Feature } from 'geojson';
import type { PlaceAreas, PlacePoint } from '@/api/types';
import { Glyph } from '@/components/Icon';
import { categoryIcon, categoryIconSvg } from './categoryIcons';
import { AREA_COLORS, type PlaceTab } from './places';
import { usePlaceDetail } from './queries';

export interface PlaceFocus {
  id: number;
  latitude: number;
  longitude: number;
  /** Veio da lista do painel: o mapa vai até o lugar. */
  travel: boolean;
}

export interface PlaceDestination {
  label: string;
  detail: string | null;
  latitude: number;
  longitude: number;
}

const POINTS_PANE = 'places-points';

// O GeoJSON do react-leaflet não troca os dados de uma camada montada: cada
// resposta nova remonta os paths.
const responseIds = new WeakMap<PlaceAreas, number>();
let nextResponseId = 0;
function responseId(areas: PlaceAreas): number {
  let id = responseIds.get(areas);
  if (id === undefined) {
    id = nextResponseId++;
    responseIds.set(areas, id);
  }
  return id;
}

function AreasLayer({
  areas,
  accent,
  backdrop,
  onPick,
}: {
  areas: PlaceAreas;
  accent: string;
  backdrop: boolean;
  onPick: (focus: PlaceFocus) => void;
}) {
  const style = useMemo(
    () =>
      (feature?: Feature): PathOptions => {
        const color = AREA_COLORS[String(feature?.properties?.category)] ?? accent;
        return backdrop
          ? { stroke: false, fillColor: color, fillOpacity: 0.5, interactive: false }
          : {
              color,
              weight: 1,
              opacity: 0.9,
              fillColor: color,
              fillOpacity: 0.38,
              // O clique é da área: não seleciona o território embaixo.
              bubblingMouseEvents: false,
            };
      },
    [accent, backdrop],
  );
  return (
    <Pane
      name={backdrop ? 'places-backdrop' : 'places-areas'}
      style={{ zIndex: backdrop ? 420 : 440, pointerEvents: backdrop ? 'none' : undefined }}
    >
      <GeoJSON
        key={`${responseId(areas)}:${backdrop}`}
        data={areas}
        style={style}
        interactive={!backdrop}
        eventHandlers={
          backdrop
            ? undefined
            : {
                click: (event: LeafletMouseEvent) => {
                  const feature = (event.propagatedFrom as { feature?: Feature } | undefined)
                    ?.feature;
                  if (typeof feature?.id !== 'number') return;
                  onPick({
                    id: feature.id,
                    latitude: event.latlng.lat,
                    longitude: event.latlng.lng,
                    travel: false,
                  });
                },
              }
        }
      />
    </Pane>
  );
}

// Bem de perto são poucos pontos na vista: cada um vira o ícone do seu esporte.
const ICON_ZOOM = 15;
const ICON_RADIUS = 11;
// Folga do toque em volta do ponto, em pixels.
const PICK_SLACK = 5;

// Milhares de pontos num só canvas: um marcador SVG por ponto pesaria no arraste.
// O canvas não recebe o mouse (cobriria os territórios embaixo); o clique é
// resolvido aqui, antes dos outros, pelo ponto mais próximo.
function PointsLayer({
  points,
  layer: placeLayer,
  accent,
  zoom,
  onPick,
}: {
  points: PlacePoint[];
  layer: string;
  accent: string;
  zoom: number;
  onPick: (focus: PlaceFocus | null) => void;
}) {
  const group = useRef<LayerGroup | null>(null);
  const renderer = useRef<Renderer | null>(null);
  const icons = zoom >= ICON_ZOOM;
  const radius = zoom >= 13 ? 5 : zoom >= 11 ? 4 : 3;
  const map = useMapEvents({
    preclick(event: LeafletMouseEvent) {
      let nearest: PlacePoint | null = null;
      let best = ((icons ? ICON_RADIUS : radius) + PICK_SLACK) ** 2;
      for (const point of points) {
        const position = map.latLngToContainerPoint([point.latitude, point.longitude]);
        const distance =
          (position.x - event.containerPoint.x) ** 2 + (position.y - event.containerPoint.y) ** 2;
        if (distance <= best) {
          best = distance;
          nearest = point;
        }
      }
      onPick(
        nearest && {
          id: nearest.id,
          latitude: nearest.latitude,
          longitude: nearest.longitude,
          travel: false,
        },
      );
    },
  });

  useEffect(() => {
    if (!map.getPane(POINTS_PANE)) {
      const pane = map.createPane(POINTS_PANE);
      pane.style.zIndex = '450';
      pane.style.pointerEvents = 'none';
    }
    const drawing = canvas({ pane: POINTS_PANE, padding: 0.3 });
    const layer = layerGroup([], { pane: POINTS_PANE }).addTo(map);
    group.current = layer;
    renderer.current = drawing;
    return () => {
      layer.remove();
      drawing.remove();
      group.current = null;
      renderer.current = null;
    };
  }, [map]);

  useEffect(() => {
    const layer = group.current;
    if (!layer || !renderer.current) return;
    layer.clearLayers();
    for (const point of points) {
      const svg = icons ? categoryIconSvg(placeLayer, point.category) : undefined;
      if (svg) {
        marker([point.latitude, point.longitude], {
          pane: POINTS_PANE,
          interactive: false,
          keyboard: false,
          icon: divIcon({
            className: 'place-icon-marker',
            html: svg,
            iconSize: [ICON_RADIUS * 2, ICON_RADIUS * 2],
          }),
        }).addTo(layer);
        continue;
      }
      circleMarker([point.latitude, point.longitude], {
        renderer: renderer.current,
        pane: POINTS_PANE,
        radius,
        color: '#ffffff',
        weight: 1,
        fillColor: accent,
        fillOpacity: 0.95,
        interactive: false,
      }).addTo(layer);
    }
  }, [points, accent, radius, icons, placeLayer]);
  return null;
}

// Sem a camada de pontos, um clique fora de qualquer área fecha o lugar aberto.
function ClickAway({ onClose }: { onClose: () => void }) {
  useMapEvents({ click: onClose });
  return null;
}

function PlacePopup({
  focus,
  tab,
  travelZoom,
  onClose,
  onDirections,
}: {
  focus: PlaceFocus;
  tab: PlaceTab;
  travelZoom: number;
  onClose: () => void;
  onDirections: (destination: PlaceDestination) => void;
}) {
  const map = useMap();
  const detail = usePlaceDetail(focus.id);
  const place = detail.data;
  const popup = useRef<LeafletPopup>(null);
  // Fechar é do usuário (o ×, um clique fora). Uma remontagem também dispara
  // `popupclose`, mas reabre em seguida: só vale o fechamento que permanece.
  useMapEvents({
    popupclose: () => {
      window.setTimeout(() => {
        if (popup.current && !popup.current.isOpen()) onClose();
      }, 0);
    },
  });
  useEffect(() => {
    if (!focus.travel) return;
    map.setView([focus.latitude, focus.longitude], Math.max(map.getZoom(), travelZoom), {
      animate: true,
    });
  }, [map, focus, travelZoom]);
  const where = place?.municipality
    ? `${place.municipality.name}${place.municipality.state ? `, ${place.municipality.state}` : ''}`
    : null;
  const kind = place?.categoryLabel ?? place?.layerLabel;
  return (
    <Popup
      ref={popup}
      position={[focus.latitude, focus.longitude]}
      className="fire-popup transport-popup places-popup"
      maxWidth={285}
      autoPan={false}
      // Quem fecha no clique é a camada de pontos, que sabe se ele caiu noutro lugar.
      closeOnClick={false}
    >
      {!place ? (
        <span className="fire-popup-meta" role="status">
          {detail.error ? 'Não foi possível carregar este lugar.' : 'Carregando…'}
        </span>
      ) : (
        <>
          <strong className="fire-popup-title places-popup-title">
            {categoryIcon(place.layer, place.category, 16)}
            {place.name ?? kind}
          </strong>
          <span className="fire-popup-meta">
            {[place.name ? kind : null, where].filter(Boolean).join(' · ')}
          </span>
          {place.attributes.length > 0 && (
            <dl className="fire-metrics">
              {place.attributes.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="source-note places-popup-footer">
            {place.source?.label}
            {tab.directions && (
              <>
                <button
                  type="button"
                  className="places-directions"
                  onClick={() =>
                    onDirections({
                      label: place.name ?? kind ?? tab.one,
                      detail: where,
                      latitude: place.latitude,
                      longitude: place.longitude,
                    })
                  }
                >
                  <Glyph name="route" size={12} />
                  Como chegar
                </button>
              </>
            )}
          </p>
        </>
      )}
    </Popup>
  );
}

export function PlacesLayers({
  tab,
  accent,
  zoom,
  areas,
  points,
  travelZoom,
  focus,
  onFocus,
  onDirections,
}: {
  tab: PlaceTab;
  accent: string;
  zoom: number;
  areas?: PlaceAreas;
  points?: PlacePoint[];
  /** Zoom mínimo ao ir até um lugar escolhido na lista. */
  travelZoom: number;
  focus: PlaceFocus | null;
  onFocus: (focus: PlaceFocus | null) => void;
  /** Abre no próprio mapa a rota até o lugar. */
  onDirections: (destination: PlaceDestination) => void;
}) {
  return (
    <>
      {areas && areas.features.length > 0 && (
        <AreasLayer
          areas={areas}
          accent={accent}
          backdrop={Boolean(tab.species)}
          onPick={onFocus}
        />
      )}
      {points ? (
        <PointsLayer
          points={points}
          layer={tab.layer}
          accent={accent}
          zoom={zoom}
          onPick={onFocus}
        />
      ) : (
        focus && <ClickAway onClose={() => onFocus(null)} />
      )}
      {focus && (
        <PlacePopup
          focus={focus}
          tab={tab}
          travelZoom={travelZoom}
          onClose={() => onFocus(null)}
          onDirections={onDirections}
        />
      )}
    </>
  );
}
