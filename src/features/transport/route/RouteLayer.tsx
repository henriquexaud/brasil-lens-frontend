import { useEffect, useMemo, useRef } from 'react';
import { divIcon, latLngBounds, type LatLngExpression } from 'leaflet';
import { Circle, CircleMarker, Marker, Pane, Polyline, useMap, useMapEvents } from 'react-leaflet';
import type { RouteResult } from '@/api/types';
import type { DevicePosition } from '@/features/search/LocationButton';
import { scopeInsets } from '@/features/map/viewport';
import { decodePolyline, hasPoint, type Waypoint } from './model';

// A cor vem de `--route-line` (route.css), da família do destaque do app: o
// atributo do SVG é só o padrão antes do CSS.
const ROUTE_COLOR = '#2d6a79';

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

function legendHeight(map: ReturnType<typeof useMap>) {
  if (map.getSize().x <= 900) return 0;
  const legend = document.querySelector('.legend-slot')?.getBoundingClientRect();
  return legend && legend.height > 0
    ? map.getContainer().getBoundingClientRect().bottom - legend.top + 12
    : 0;
}

// Área livre do mapa para a rota: fora da caixa de rota, do painel e da legenda. No
// celular, medida de verdade (base da caixa e topo da gaveta), sem o teto de
// `scopeInsets`, que deixava a rota por baixo da gaveta.
function routePadding(map: ReturnType<typeof useMap>) {
  const insets = scopeInsets(map);
  const container = map.getContainer().getBoundingClientRect();
  const box = document.querySelector('.route-slot')?.getBoundingClientRect();
  const margin = 16;
  if (map.getSize().x > 900) {
    return {
      paddingTopLeft: [box ? box.right - container.left + margin : margin, margin] as [
        number,
        number,
      ],
      paddingBottomRight: [
        insets.paddingBottomRight[0],
        Math.max(insets.paddingBottomRight[1], legendHeight(map)),
      ] as [number, number],
    };
  }
  const sheet = document.querySelector('.panel-slot')?.getBoundingClientRect();
  const top = box ? box.bottom - container.top + 12 : margin;
  let bottom = sheet && sheet.height > 0 ? container.bottom - sheet.top + 12 : margin;
  // Com a gaveta alta, sobra pouco: a rota pode passar por baixo dela, nunca da caixa.
  bottom = Math.max(margin, Math.min(bottom, map.getSize().y - top - 120));
  // Tema e Pix ficam na coluna da direita, logo abaixo da pilha da rota.
  const controls = document.querySelector('.theme-switch')?.getBoundingClientRect();
  const right = controls ? container.right - controls.left + 8 : margin;
  return {
    paddingTopLeft: [margin, top] as [number, number],
    paddingBottomRight: [right, bottom] as [number, number],
  };
}

function Fit({ route, stale, focus }: Pick<Props, 'route' | 'stale' | 'focus'>) {
  const map = useMap();
  // A rota que já estava no mapa ao montar (volta ao contexto) não reenquadra a vista guardada.
  const fitted = useRef(route?.geometry);
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
    // Toda rota nova enquadra a viagem inteira; a anterior, mostrada esmaecida enquanto a
    // nova carrega, não conta (senão o enquadramento seria o da rota velha).
    if (!route || stale || fitted.current === route.geometry) return;
    fitted.current = route.geometry;
    const bounds = latLngBounds(decodePolyline(route.geometry));
    if (!bounds.isValid()) return;
    const options = { ...routePadding(map), maxZoom: 16 };
    if (reduced()) map.fitBounds(bounds, { ...options, animate: false });
    else map.flyToBounds(bounds, { ...options, duration: 0.8, easeLinearity: 0.25 });
  }, [map, route, stale]);

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
      <Fit route={route} stale={stale} focus={focus} />
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
                weight: 7,
                opacity: stale ? 0.5 : 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Polyline
              positions={line}
              interactive={false}
              className="route-path"
              pathOptions={{
                color: ROUTE_COLOR,
                weight: 4,
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
            className="route-device-accuracy"
            pathOptions={{ color: ROUTE_COLOR, weight: 1, opacity: 0.35, fillOpacity: 0.08 }}
          />
        )}
        {device && (
          <CircleMarker
            center={[device.latitude, device.longitude]}
            radius={6.5}
            interactive={false}
            className="route-device-dot"
            pathOptions={{ color: '#ffffff', weight: 2.5, fillColor: ROUTE_COLOR, fillOpacity: 1 }}
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
