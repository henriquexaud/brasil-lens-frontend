import { useEffect, useMemo, useRef, useState } from 'react';
import type { LeafletMouseEvent, PathOptions, WMSParams } from 'leaflet';
import { CircleMarker, GeoJSON, Pane, Popup, WMSTileLayer, useMapEvents } from 'react-leaflet';
import type {
  TransportCatalog,
  TransportFeatureProperties,
  TransportLayer,
  TransportNetwork,
} from '@/api/types';
import { LAYER_LABEL, LAYER_STYLE, attributeRows } from './layers';
import { useTransportIdentify, type TransportLocation } from './queries';

const IDENTIFY_PIXELS = 8;

// O GeoJSON do react-leaflet não troca os dados de uma camada montada: cada
// resposta nova remonta o path (um só por camada, então é barato).
const responseIds = new WeakMap<TransportNetwork, number>();
let nextResponseId = 0;
function responseId(network: TransportNetwork): number {
  let id = responseIds.get(network);
  if (id === undefined) {
    id = nextResponseId++;
    responseIds.set(network, id);
  }
  return id;
}
const MIN_IDENTIFY_ZOOM = 6;

// Ruas do IBGE em traço fino e neutro, legível sobre o terreno nos dois temas.
const STREETS_SLD = (layer: string) =>
  `<StyledLayerDescriptor version='1.0.0' xmlns='http://www.opengis.net/sld'><NamedLayer><Name>${layer}</Name><UserStyle><FeatureTypeStyle><Rule><LineSymbolizer><Stroke><CssParameter name='stroke'>#7A8597</CssParameter><CssParameter name='stroke-width'>0.6</CssParameter></Stroke></LineSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;

function FeaturePopup({
  position,
  feature,
}: {
  position: [number, number];
  feature: TransportFeatureProperties;
}) {
  const rows = attributeRows(feature.attributes);
  return (
    <Popup
      position={position}
      className="fire-popup transport-popup"
      maxWidth={285}
      autoPan={false}
    >
      <strong className="fire-popup-title">{feature.name ?? LAYER_LABEL[feature.layer]}</strong>
      {feature.name && <span className="fire-popup-meta">{LAYER_LABEL[feature.layer]}</span>}
      {rows.length > 0 && (
        <dl className="fire-metrics">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Popup>
  );
}

export function NetworkLayer({
  layer,
  network,
  ports,
}: {
  layer: TransportLayer;
  network?: TransportNetwork;
  ports?: TransportNetwork;
}) {
  const [location, setLocation] = useState<TransportLocation | null>(null);
  const [port, setPort] = useState<{
    position: [number, number];
    feature: TransportFeatureProperties;
  } | null>(null);
  const timer = useRef<number>();
  const identify = useTransportIdentify(layer, location);
  const map = useMapEvents({
    click(event: LeafletMouseEvent) {
      window.clearTimeout(timer.current);
      if (map.getZoom() < MIN_IDENTIFY_ZOOM) return;
      const point = event.latlng;
      const nearby = map.containerPointToLatLng(
        event.containerPoint.add([IDENTIFY_PIXELS, IDENTIFY_PIXELS]),
      );
      // Espera o duplo clique (que abre o território) antes de consultar o trecho.
      timer.current = window.setTimeout(
        () =>
          setLocation({
            latitude: point.lat,
            longitude: point.lng,
            tolerance: Math.max(Math.abs(nearby.lat - point.lat), Math.abs(nearby.lng - point.lng)),
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
  useEffect(() => setLocation(null), [layer]);

  const style = useMemo<PathOptions>(
    () => ({ ...LAYER_STYLE[layer], opacity: 0.9, fill: false, interactive: false }),
    [layer],
  );
  const feature = identify.data?.feature;
  return (
    <>
      <Pane name="transport-network" style={{ zIndex: 440, pointerEvents: 'none' }}>
        {network?.features.length ? (
          <GeoJSON key={responseId(network)} data={network} interactive={false} style={style} />
        ) : null}
      </Pane>
      {ports && (
        <Pane name="transport-ports" style={{ zIndex: 445 }}>
          {ports.features.map((item) => {
            if (item.geometry.type !== 'Point') return null;
            const [longitude = 0, latitude = 0] = item.geometry.coordinates;
            return (
              <CircleMarker
                key={item.id}
                center={[latitude, longitude]}
                radius={3.5}
                pathOptions={{
                  color: '#ffffff',
                  weight: 1,
                  fillColor: LAYER_STYLE.port.color,
                  fillOpacity: 1,
                }}
                eventHandlers={{
                  click: (event) => {
                    event.originalEvent.stopPropagation();
                    setPort({ position: [latitude, longitude], feature: item.properties });
                  },
                }}
              />
            );
          })}
        </Pane>
      )}
      {port && <FeaturePopup key={port.position.join(',')} {...port} />}
      {location && feature && (
        <FeaturePopup
          key={`${location.latitude}:${location.longitude}`}
          position={[location.latitude, location.longitude]}
          feature={feature}
        />
      )}
    </>
  );
}

export function StreetsLayer({ streets }: { streets: TransportCatalog['streets'] }) {
  const params = useMemo(
    () =>
      ({
        layers: streets.layer,
        format: 'image/png',
        transparent: true,
        version: '1.1.1',
        SLD_BODY: STREETS_SLD(streets.layer),
      }) as WMSParams & { SLD_BODY: string },
    [streets.layer],
  );
  return (
    <Pane name="transport-streets" style={{ zIndex: 415, pointerEvents: 'none' }}>
      <WMSTileLayer
        url={streets.url}
        params={params}
        minZoom={streets.minZoom}
        // O WMS do IBGE leva ~1,7 s por imagem: tiles de 512 px pedem um quarto das imagens.
        tileSize={512}
        uppercase
        updateWhenIdle
        keepBuffer={1}
        opacity={0.85}
        attribution='Ruas: <a href="https://www.ibge.gov.br/">IBGE</a>, Censo 2022'
      />
    </Pane>
  );
}
