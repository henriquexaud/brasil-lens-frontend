import type { Layer, Map as LeafletMap } from 'leaflet';

// O Leaflet projeta cada path no zoom do quadro atual, mas o SVG do pane só
// adota o zoom novo no `zoomend`. Path criado ou reprojetado no meio de um voo
// (flyTo, pinça) fica deslocado até lá: a malha aparece fora do lugar e salta
// no fim. Realinhar o renderer, como o Leaflet faz no `viewreset`, antes da
// próxima pintura corrige. Parado, o renderer já está no zoom do mapa e nada
// acontece.
type PaneRenderer = { _map?: LeafletMap | null; _zoom?: number; _reset(): void };

const stale = new Set<PaneRenderer>();
let scheduled = false;

function flush() {
  scheduled = false;
  for (const renderer of stale) {
    const map = renderer._map as (LeafletMap & { _animatingZoom?: boolean }) | null | undefined;
    // No zoom animado por CSS o próprio Leaflet reprojeta tudo no `zoomend`.
    if (map && !map._animatingZoom && renderer._zoom !== map.getZoom()) renderer._reset();
  }
  stale.clear();
}

export function realignRenderer(layer: Layer) {
  const renderer = (layer as Layer & { _renderer?: PaneRenderer })._renderer;
  if (!renderer) return;
  stale.add(renderer);
  // Uma vez por lote de mudanças, e antes de o navegador pintar.
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(flush);
  }
}
