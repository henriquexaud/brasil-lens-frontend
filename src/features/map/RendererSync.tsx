import type { LayerEvent } from 'leaflet';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

import { realignRenderer } from './realignRenderer';

// Todo path que entra no mapa durante um voo é realinhado; `setLatLngs` não
// dispara evento, então quem reprojeta chama `realignRenderer` direto.
export function RendererSync() {
  const map = useMap();
  useEffect(() => {
    const onAdd = (event: LayerEvent) => realignRenderer(event.layer);
    map.on('layeradd', onAdd);
    return () => {
      map.off('layeradd', onAdd);
    };
  }, [map]);
  return null;
}
