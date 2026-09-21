import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export interface MapViewport {
  zoom: number;
  bbox?: string;
  scopeKey?: string;
  moving?: boolean;
}

/** Só publica movimentos concluídos. A margem arredondada reaproveita o cache ao arrastar. */
export function ViewportObserver({
  onChange,
  scopeKey,
}: {
  onChange: (viewport: MapViewport) => void;
  scopeKey: string;
}) {
  const map = useMap();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last: MapViewport = { zoom: map.getZoom(), scopeKey };
    const update = () => {
      const b = map.getBounds();
      const step = map.getZoom() < 8 ? 0.5 : 0.1;
      const floor = (n: number) => Math.floor(n / step) * step;
      const ceil = (n: number) => Math.ceil(n / step) * step;
      const west = Math.max(-180, floor(b.getWest()));
      const east = Math.min(180, ceil(b.getEast()));
      const south = Math.max(-85, floor(b.getSouth()));
      const north = Math.min(85, ceil(b.getNorth()));
      last = {
        scopeKey,
        moving: false,
        zoom: map.getZoom(),
        bbox: [west, south, east, north].map((v) => v.toFixed(2)).join(','),
      };
      onChange(last);
    };
    update();
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(update, 120);
    };
    map.on('moveend resize', settle);
    return () => {
      clearTimeout(timer);
      map.off('moveend resize', settle);
    };
  }, [map, onChange, scopeKey]);
  return null;
}
