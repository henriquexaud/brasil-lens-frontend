import { DomEvent, TileLayer, type Coords, type DoneCallback } from 'leaflet';

// O INPE não manda Cache-Control: sem isto, cada pan ou zoom de volta baixa o tile de novo.
// Guardamos a imagem (uns 20 KB) por URL; a URL já leva filtro e janela, então é imutável.
const MAX_CACHED_TILES = 1500;
const cache = new Map<string, string>();

function remember(url: string, blob: Blob): string {
  const objectUrl = URL.createObjectURL(blob);
  cache.set(url, objectUrl);
  if (cache.size > MAX_CACHED_TILES) {
    const [oldest] = cache.keys();
    if (oldest !== undefined) {
      URL.revokeObjectURL(cache.get(oldest)!);
      cache.delete(oldest);
    }
  }
  return objectUrl;
}

export function cachedFireTiles(): number {
  return cache.size;
}

export function clearFireTileCache() {
  for (const objectUrl of cache.values()) URL.revokeObjectURL(objectUrl);
  cache.clear();
}

interface TileRegistry {
  _tiles: Record<string, { el: HTMLElement }>;
}

export class FireTileLayer extends TileLayer.WMS {
  private readonly inflight = new WeakMap<HTMLElement, AbortController>();

  createTile(coords: Coords, done: DoneCallback): HTMLElement {
    const tile = document.createElement('img');
    tile.alt = '';
    tile.setAttribute('role', 'presentation');
    DomEvent.on(tile, 'load', () => done(undefined, tile));
    DomEvent.on(tile, 'error', () => {
      const error = new Error('Tile de focos indisponível');
      this.fire('tileerror', { tile, coords, error });
      done(error, tile);
    });
    const url = this.getTileUrl(coords);
    const hit = cache.get(url);
    if (hit) {
      // Reinserir mantém os tiles em uso longe do início da fila de descarte.
      cache.delete(url);
      cache.set(url, hit);
      tile.src = hit;
      return tile;
    }
    const controller = new AbortController();
    this.inflight.set(tile, controller);
    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.blob();
      })
      .then((blob) => {
        tile.src = remember(url, blob);
      })
      .catch(() => {
        if (!controller.signal.aborted) tile.dispatchEvent(new Event('error'));
      })
      .finally(() => this.inflight.delete(tile));
    return tile;
  }

  // O Leaflet descarta o tile que saiu da vista; a requisição que ainda corre não serve mais.
  _removeTile(key: string) {
    const tile = (this as unknown as TileRegistry)._tiles[key];
    if (tile) this.inflight.get(tile.el)?.abort();
    (TileLayer.prototype as unknown as { _removeTile(key: string): void })._removeTile.call(
      this,
      key,
    );
  }
}
