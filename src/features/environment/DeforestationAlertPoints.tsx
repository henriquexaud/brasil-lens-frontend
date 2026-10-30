import { useMemo, useRef, useState } from 'react';
import { canvas, type LeafletMouseEvent } from 'leaflet';
import { CircleMarker, Pane, Popup, useMap, useMapEvents } from 'react-leaflet';

import type { DeforestationAlertPoint } from '@/api/types';
import { formatAlertDate } from './alerts';

const PANE = 'deforestation-alerts';
const CLICK_PIXELS = 10;
const FILL = '#5F2E1B';

// Um alerta pequeno ainda precisa de um ponto legível; os maiores crescem pouco.
function radius(areaKm2: number): number {
  return 2.5 + Math.min(3.5, Math.sqrt(areaKm2) * 4);
}

// Pontos dos alertas do DETER (centro de cada polígono) em canvas: centenas de círculos em SVG
// pesariam no DOM. O clique é do mapa, como nos focos, porque o pane não captura eventos. Quem
// monta passa só os pontos do estado aberto.
export function DeforestationAlertPoints({
  points,
  sourceUrl,
}: {
  points: DeforestationAlertPoint[];
  sourceUrl: string;
}) {
  const map = useMap();
  const renderer = useMemo(() => canvas({ pane: PANE, padding: 0.5 }), []);
  const [selected, setSelected] = useState<DeforestationAlertPoint | null>(null);
  const timer = useRef<number>();
  useMapEvents({
    click(event: LeafletMouseEvent) {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        let nearest: DeforestationAlertPoint | null = null;
        let best = CLICK_PIXELS;
        for (const point of points) {
          const distance = map
            .latLngToContainerPoint({ lat: point.latitude, lng: point.longitude })
            .distanceTo(event.containerPoint);
          if (distance <= best) {
            best = distance;
            nearest = point;
          }
        }
        setSelected(nearest);
      }, 240);
    },
    dblclick() {
      window.clearTimeout(timer.current);
    },
    movestart() {
      window.clearTimeout(timer.current);
      setSelected(null);
    },
  });
  return (
    <Pane name={PANE} style={{ zIndex: 436, pointerEvents: 'none' }}>
      {points.map((point, index) => (
        <CircleMarker
          key={index}
          center={[point.latitude, point.longitude]}
          radius={radius(point.areaKm2)}
          renderer={renderer}
          interactive={false}
          pathOptions={{
            stroke: true,
            color: '#fff',
            weight: 0.6,
            fillColor: FILL,
            fillOpacity: 0.85,
          }}
        />
      ))}
      {selected && (
        <Popup
          key={`${selected.longitude}:${selected.latitude}:${selected.viewDate}`}
          position={[selected.latitude, selected.longitude]}
          className="fire-popup"
          maxWidth={285}
          autoPan={false}
        >
          <strong className="fire-popup-title">
            {selected.municipality || 'Alerta de desmatamento'}
          </strong>
          <span className="fire-popup-meta">{selected.state}</span>
          <p className="fire-popup-meta">
            Alerta de {formatAlertDate(selected.viewDate)} · {selected.biome}
          </p>
          <p className="fire-popup-meta">
            {selected.areaKm2.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} km² em alerta
          </p>
          <p className="source-note">
            Alerta de fiscalização, não a taxa oficial ·{' '}
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              INPE DETER
            </a>
          </p>
        </Popup>
      )}
    </Pane>
  );
}
