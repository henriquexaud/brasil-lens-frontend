import { useEffect, useMemo, useRef, useState } from 'react';
import { divIcon, type LeafletMouseEvent, type Map as LeafletMap, type WMSOptions } from 'leaflet';
import { Marker, Pane, Popup, useMap, useMapEvents } from 'react-leaflet';

import type {
  FireHotspotCollection,
  FireHotspotFeature,
  FireHotspotLocation,
  FireHotspotMetadata,
  FireHotspotQuery,
} from '@/api/types';
import { useFireHotspotDetails } from '@/api/queries';
import { Disclosure } from '@/components/Disclosure';
import { FIRE_SLD, formatFireDate, formatFireValue } from './fireStyles';
import { FireTileLayer } from './fireTileLayer';

interface Props {
  collection: FireHotspotCollection;
  query: FireHotspotQuery;
  onMapError: (error: boolean) => void;
}

// Abaixo disto o ponto tem 3 px e a caixa do clique cobriria dezenas de focos (a API devolve só os 20
// mais recentes dela), então o clique volta a ser do território.
const MIN_IDENTIFY_ZOOM = 7;
const IDENTIFY_PIXELS = 8;
const MAX_TOLERANCE = 0.15;
const FIRE_ATTRIBUTION = 'Focos: <a href="https://data.inpe.br/queimadas/">INPE</a>';
const RING = divIcon({ className: 'fire-ring', iconSize: [20, 20], iconAnchor: [10, 10] });

function nearClick(
  feature: FireHotspotFeature,
  location: FireHotspotLocation,
  map: LeafletMap,
): boolean {
  const longitude = feature.geometry.coordinates[0];
  const latitude = feature.geometry.coordinates[1];
  if (longitude == null || latitude == null) return false;
  return (
    map
      .latLngToContainerPoint({ lat: latitude, lng: longitude })
      .distanceTo(
        map.latLngToContainerPoint({ lat: location.latitude, lng: location.longitude }),
      ) <= IDENTIFY_PIXELS
  );
}

function FireTiles({
  metadata,
  onMapError,
}: {
  metadata: FireHotspotMetadata;
  onMapError: (error: boolean) => void;
}) {
  const map = useMap();
  const generation = useRef(0);
  const layers = useRef(new Map<FireTileLayer, number>());
  const current = useRef<string>();
  const { wmsUrl, wmsLayer, cqlFilter } = metadata;
  useEffect(() => {
    const key = `${wmsUrl}|${wmsLayer}|${cqlFilter}`;
    if (current.current === key) return;
    current.current = key;
    const options = {
      layers: wmsLayer,
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      CQL_FILTER: cqlFilter,
      SLD_BODY: FIRE_SLD,
      uppercase: true,
      pane: 'fire-hotspots',
      opacity: 0.85,
      keepBuffer: 3,
      updateWhenIdle: false,
      attribution: FIRE_ATTRIBUTION,
    } as WMSOptions;
    const layer = new FireTileLayer(wmsUrl, options);
    const order = ++generation.current;
    layers.current.set(layer, order);
    // O recorte ou a janela anterior só sai quando a nova camada terminou de carregar.
    const retire = () => {
      for (const [other, otherOrder] of layers.current) {
        if (otherOrder < order) {
          other.remove();
          layers.current.delete(other);
        }
      }
    };
    layer.on('loading', () => onMapError(false));
    layer.on('tileerror', () => onMapError(true));
    layer.once('load', retire);
    const fallback = window.setTimeout(retire, 10_000);
    layer.addTo(map);
    return () => window.clearTimeout(fallback);
  }, [map, wmsUrl, wmsLayer, cqlFilter, onMapError]);
  useEffect(() => {
    const all = layers.current;
    return () => {
      for (const layer of all.keys()) layer.remove();
      all.clear();
      current.current = undefined;
    };
  }, []);
  return null;
}

export function FireHotspotsLayer({ collection, query, onMapError }: Props) {
  const { metadata } = collection;
  const [location, setLocation] = useState<FireHotspotLocation | null>(null);
  const timer = useRef<number>();
  const details = useFireHotspotDetails(query, location);
  const map = useMapEvents({
    click(event: LeafletMouseEvent) {
      window.clearTimeout(timer.current);
      if (map.getZoom() < MIN_IDENTIFY_ZOOM) {
        setLocation(null);
        return;
      }
      const point = event.latlng;
      const nearby = map.containerPointToLatLng(
        event.containerPoint.add([IDENTIFY_PIXELS, IDENTIFY_PIXELS]),
      );
      timer.current = window.setTimeout(
        () =>
          setLocation({
            latitude: point.lat,
            longitude: point.lng,
            at: metadata.windowEnd,
            tolerance: Math.min(
              MAX_TOLERANCE,
              Math.max(0.0001, Math.abs(nearby.lat - point.lat), Math.abs(nearby.lng - point.lng)),
            ),
          }),
        240,
      );
    },
    dblclick() {
      window.clearTimeout(timer.current);
      setLocation(null);
    },
    movestart() {
      window.clearTimeout(timer.current);
      setLocation(null);
    },
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    window.clearTimeout(timer.current);
    setLocation(null);
  }, [query.level, query.parent, metadata.windowEnd]);
  const feature = details.data?.features.find(
    (item) => location !== null && nearClick(item, location, map),
  );
  const properties = feature?.properties;
  const [longitude, latitude] = feature?.geometry.coordinates ?? [];
  // O Popup do react-leaflet reabre a cada mudança de identidade do `position`.
  const anchor = useMemo<[number, number] | undefined>(
    () => (latitude != null && longitude != null ? [latitude, longitude] : undefined),
    [latitude, longitude],
  );
  const clicked = useMemo<[number, number] | undefined>(
    () => (location ? [location.latitude, location.longitude] : undefined),
    [location],
  );
  const values = properties
    ? [
        ['Potência radiativa', formatFireValue(properties.frp, ' MW')],
        ['Índice de risco de fogo', formatFireValue(properties.fireRisk)],
        ['Dias sem chuva', formatFireValue(properties.daysWithoutRain)],
        ['Precipitação', formatFireValue(properties.precipitationMm, ' mm')],
        ['Bioma', properties.biome],
      ]
    : [];
  return (
    <>
      <Pane name="fire-hotspots" style={{ zIndex: 435, pointerEvents: 'none' }}>
        <FireTiles metadata={metadata} onMapError={onMapError} />
        {feature && (
          <Marker
            position={anchor!}
            icon={RING}
            interactive={false}
            keyboard={false}
            pane="fire-hotspots"
          />
        )}
      </Pane>
      {location && (feature || details.error) && (
        <Popup
          key={feature?.id ?? `${location.latitude}:${location.longitude}`}
          position={anchor ?? clicked!}
          className="fire-popup"
          maxWidth={285}
          autoPan={false}
        >
          {properties ? (
            <>
              <strong className="fire-popup-title">
                {properties.municipality ?? 'Foco de calor'}
              </strong>
              {properties.state && <span className="fire-popup-meta">{properties.state}</span>}
              <p className="fire-popup-meta">
                {formatFireDate(properties.detectedAt)} · {properties.satellite}
              </p>
              <dl className="fire-metrics">
                {values
                  .filter(([, value]) => value !== null)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
              {(details.data?.matchedCount ?? 0) > 1 && (
                <Disclosure
                  title={`${details.data!.matchedCount.toLocaleString('pt-BR')} detecções próximas`}
                >
                  <p className="source-note">
                    Detecções mais recentes neste ponto e entorno; um incêndio pode ser observado
                    várias vezes.
                  </p>
                  <ul className="fire-nearby">
                    {details.data!.features.slice(0, 5).map(({ id, properties: item }) => (
                      <li key={id}>
                        {formatFireDate(item.detectedAt)} · {item.satellite}
                      </li>
                    ))}
                  </ul>
                </Disclosure>
              )}
              <p className="source-note">
                Detecção por satélite ·{' '}
                <a href={metadata.sourceUrl} target="_blank" rel="noreferrer">
                  INPE
                </a>
              </p>
            </>
          ) : (
            <p>Não foi possível consultar este foco.</p>
          )}
        </Popup>
      )}
    </>
  );
}
