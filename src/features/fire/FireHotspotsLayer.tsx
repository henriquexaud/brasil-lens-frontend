import { useEffect, useMemo, useRef, useState } from 'react';
import type { LeafletMouseEvent, Map as LeafletMap, WMSParams } from 'leaflet';
import { Pane, Popup, WMSTileLayer, useMapEvents } from 'react-leaflet';

import type {
  FireHotspotCollection,
  FireHotspotFeature,
  FireHotspotLocation,
  FireHotspotQuery,
} from '@/api/types';
import { useFireHotspotDetails } from '@/api/queries';
import { Disclosure } from '@/components/Disclosure';
import { FIRE_SLD, formatFireDate, formatFireValue } from './fireStyles';

interface Props {
  collection: FireHotspotCollection;
  query: FireHotspotQuery;
  onMapError: (error: boolean) => void;
}

/** Abaixo disso os pontos se sobrepõem e o clique continua sendo o da UF/município. */
const MIN_IDENTIFY_ZOOM = 9;
const IDENTIFY_PIXELS = 10;

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

/** Tiles mantêm a cobertura completa. O JSON só é consultado no ponto clicado. */
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
      // O duplo clique continua pertencendo à navegação territorial.
      timer.current = window.setTimeout(
        () =>
          setLocation({
            latitude: point.lat,
            longitude: point.lng,
            at: metadata.windowEnd,
            tolerance: Math.min(
              0.05,
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
  const params = useMemo(
    () =>
      ({
        layers: metadata.wmsLayer,
        format: 'image/png',
        transparent: true,
        version: '1.1.1',
        CQL_FILTER: metadata.cqlFilter,
        SLD_BODY: FIRE_SLD,
      }) as WMSParams & { CQL_FILTER: string; SLD_BODY: string },
    [metadata.wmsLayer, metadata.cqlFilter],
  );
  const events = useMemo(
    () => ({
      loading: () => onMapError(false),
      tileerror: () => onMapError(true),
    }),
    [onMapError],
  );
  const feature = details.data?.features.find(
    (item) => location !== null && nearClick(item, location, map),
  );
  const properties = feature?.properties;
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
        <WMSTileLayer
          url={metadata.wmsUrl}
          params={params}
          eventHandlers={events}
          uppercase
          updateWhenIdle
          keepBuffer={1}
          opacity={0.85}
          attribution='Focos: <a href="https://data.inpe.br/queimadas/">INPE</a>'
        />
      </Pane>
      {location && (feature || details.error) && (
        <Popup
          key={`${location.latitude}:${location.longitude}`}
          position={[location.latitude, location.longitude]}
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
