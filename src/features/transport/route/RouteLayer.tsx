import { useEffect, useMemo, useRef } from 'react';
import { divIcon, latLngBounds, type LatLngExpression } from 'leaflet';
import { Circle, CircleMarker, Marker, Pane, Polyline, useMap, useMapEvents } from 'react-leaflet';
import type { RouteResult } from '@/api/types';
import type { DevicePosition } from '@/features/search/LocationButton';
import { scopeInsets } from '@/features/map/viewport';
import { decodePolyline, hasPoint, type Waypoint } from './model';

// Azul de navegação: fora das cores da malha (ocre, violeta, azul-petróleo das
// hidrovias) e igual nos dois temas, como o resto do traçado.
export const ROUTE_COLOR = '#1A66E0';
const DEVICE_COLOR = '#1A66E0';

export interface MapFocus {
  latitude: number;
  longitude: number;
  zoom: number;
  at: number;
}

interface Props {
  waypoints: Waypoint[];
  route: RouteResult | undefined;
  stale: boolean;
  /** Muda quando a rota deve ser enquadrada ao chegar (não ao arrastar um ponto). */
  fitRequest: number;
  focus: MapFocus | null;
  device: DevicePosition | null;
  picking: boolean;
  onPick: (latitude: number, longitude: number) => void;
  onDrag: (index: number, latitude: number, longitude: number) => void;
}

const icons = new Map<string, ReturnType<typeof divIcon>>();
function waypointIcon(role: string) {
  let icon = icons.get(role);
  if (!icon) {
    const size = role === 'destination' ? 18 : role === 'stop' ? 12 : 14;
    icon = divIcon({
      className: `route-marker is-${role}`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
    icons.set(role, icon);
  }
  return icon;
}

function Fit({ route, fitRequest, focus }: Pick<Props, 'route' | 'fitRequest' | 'focus'>) {
  const map = useMap();
  const fitted = useRef(fitRequest);
  const focused = useRef(focus?.at);
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!focus || focused.current === focus.at) return;
    focused.current = focus.at;
    const target: LatLngExpression = [focus.latitude, focus.longitude];
    if (reduced()) map.setView(target, focus.zoom, { animate: false });
    else map.flyTo(target, focus.zoom, { duration: 1, easeLinearity: 0.25 });
  }, [map, focus]);

  useEffect(() => {
    if (!route || fitted.current === fitRequest) return;
    fitted.current = fitRequest;
    const bounds = latLngBounds(decodePolyline(route.geometry));
    if (!bounds.isValid()) return;
    const insets = scopeInsets(map);
    const box = document.querySelector('.route-slot')?.getBoundingClientRect();
    const mapLeft = map.getContainer().getBoundingClientRect().left;
    // A caixa de rota cobre o canto superior esquerdo no desktop: a linha não fica por baixo.
    const left = box && map.getSize().x > 900 ? box.right - mapLeft + 16 : insets.paddingTopLeft[0];
    const top = box && map.getSize().x <= 900 ? box.bottom + 12 : insets.paddingTopLeft[1];
    map.fitBounds(bounds, {
      paddingTopLeft: [left, top],
      paddingBottomRight: insets.paddingBottomRight,
      maxZoom: 16,
      animate: !reduced(),
    });
  }, [map, route, fitRequest]);

  return null;
}

function PickOnClick({ onPick }: { onPick: Props['onPick'] }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

export function RouteLayer({
  waypoints,
  route,
  stale,
  fitRequest,
  focus,
  device,
  picking,
  onPick,
  onDrag,
}: Props) {
  const map = useMap();
  const line = useMemo(() => (route ? decodePolyline(route.geometry) : null), [route]);

  useEffect(() => {
    const container = map.getContainer();
    container.classList.toggle('is-picking-route-point', picking);
    return () => container.classList.remove('is-picking-route-point');
  }, [map, picking]);

  return (
    <>
      <Fit route={route} fitRequest={fitRequest} focus={focus} />
      {picking && <PickOnClick onPick={onPick} />}
      <Pane name="route-line" style={{ zIndex: 455, pointerEvents: 'none' }}>
        {line && (
          <>
            <Polyline
              positions={line}
              interactive={false}
              className="route-casing"
              pathOptions={{
                color: '#ffffff',
                weight: 8,
                opacity: stale ? 0.5 : 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Polyline
              positions={line}
              interactive={false}
              pathOptions={{
                color: ROUTE_COLOR,
                weight: 4.5,
                opacity: stale ? 0.45 : 1,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </>
        )}
        {device && device.accuracy > 25 && device.accuracy < 3000 && (
          <Circle
            center={[device.latitude, device.longitude]}
            radius={device.accuracy}
            interactive={false}
            pathOptions={{ color: DEVICE_COLOR, weight: 1, opacity: 0.35, fillOpacity: 0.08 }}
          />
        )}
        {device && (
          <CircleMarker
            center={[device.latitude, device.longitude]}
            radius={6.5}
            interactive={false}
            className="route-device-dot"
            pathOptions={{ color: '#ffffff', weight: 2.5, fillColor: DEVICE_COLOR, fillOpacity: 1 }}
          />
        )}
      </Pane>
      <Pane name="route-markers" style={{ zIndex: 620 }}>
        {waypoints.map((item, index) => {
          if (!hasPoint(item)) return null;
          // O ponto do GPS já está desenhado; a partida fica sobre ele só se for movida.
          if (item.device && device) return null;
          const role =
            index === 0 ? 'origin' : index === waypoints.length - 1 ? 'destination' : 'stop';
          return (
            <Marker
              key={item.key}
              pane="route-markers"
              position={[item.latitude!, item.longitude!]}
              icon={waypointIcon(role)}
              draggable
              keyboard={false}
              title={item.label}
              eventHandlers={{
                dragend: (event) => {
                  const { lat, lng } = event.target.getLatLng();
                  onDrag(index, lat, lng);
                },
              }}
            />
          );
        })}
      </Pane>
    </>
  );
}
