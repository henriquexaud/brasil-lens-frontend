import type { Coords, GridLayer, LatLng, Map as LeafletMap } from 'leaflet';

/** Nível de tile para um zoom fracionário: sempre o de cima. O Leaflet arredonda,
 * e entre x,25 e x,5 ampliava o tile do nível de baixo, que ficava borrado. */
export function tileZoomFor(zoom: number): number {
  return Math.ceil(zoom - 1e-6);
}

// Partes internas do GridLayer do Leaflet 1.9 usadas abaixo.
interface GridInternals {
  options: { maxZoom?: number; minZoom?: number; updateWhenZooming?: boolean };
  _tileZoom?: number;
  _tiles: Record<string, { el: HTMLElement; coords: Coords }>;
  _noPrune: boolean;
  _abortLoading?: () => void;
  _clampZoom(zoom: number): number;
  _updateLevels(): void;
  _resetGrid(): void;
  _update(center: LatLng): void;
  _pruneTiles(): void;
  _setZoomTransforms(center: LatLng, zoom: number): void;
  _setView(center: LatLng, zoom: number, noPrune?: boolean, noUpdate?: boolean): void;
}

interface RenderingLayer {
  renderTile(coords: Coords, element: HTMLCanvasElement, key: string, done?: () => void): unknown;
  _tileCoordsToKey(coords: Coords): string;
  lang?: string;
  createTile(
    coords: Coords,
    done: (error: Error | undefined, tile: HTMLElement) => void,
  ): HTMLElement;
}

type KeyedCanvas = HTMLCanvasElement & { key?: string };

// Novas tentativas por tile depois de o protomaps abandoná-lo; o zoomend seguinte
// também redesenha.
const MAX_ATTEMPTS = 3;

/**
 * Deixa a camada vetorial nítida em qualquer zoom e sem resto borrado:
 * - o nível do tile é sempre o de cima (`tileZoomFor`), reduzido em vez de ampliado;
 * - o protomaps-leaflet abandona, sem avisar o Leaflet, o tile de um nível que
 *   deixou de ser o último pedido durante o zoom. Sem o aviso, o Leaflet nunca
 *   descarta os tiles ampliados do nível anterior. Ao parar o mapa, os tiles do
 *   nível atual que ficaram sem desenhar são desenhados de novo.
 *
 * Devolve a função que desfaz os ouvintes no mapa.
 */
export function sharpenGridLayer(layer: GridLayer, map: LeafletMap): () => void {
  const grid = layer as unknown as GridInternals;
  const rendering = layer as unknown as RenderingLayer;

  // Cópia do `_setView` do Leaflet 1.9, trocando só o arredondamento do nível.
  grid._setView = function (center, zoom, noPrune, noUpdate) {
    let tileZoom: number | undefined = tileZoomFor(zoom);
    if (
      (this.options.maxZoom !== undefined && tileZoom > this.options.maxZoom) ||
      (this.options.minZoom !== undefined && tileZoom < this.options.minZoom)
    ) {
      tileZoom = undefined;
    } else {
      tileZoom = this._clampZoom(tileZoom);
    }
    const tileZoomChanged = this.options.updateWhenZooming && tileZoom !== this._tileZoom;
    if (!noUpdate || tileZoomChanged) {
      this._tileZoom = tileZoom;
      this._abortLoading?.();
      this._updateLevels();
      this._resetGrid();
      if (tileZoom !== undefined) this._update(center);
      if (!noPrune) this._pruneTiles();
      this._noPrune = !!noPrune;
    }
    this._setZoomTransforms(center, zoom);
  };

  // Tiles do protomaps que voltaram sem desenhar (nível que deixou de ser o último).
  const stalled = new Map<
    KeyedCanvas,
    { coords: Coords; key: string; finish: () => void; attempts: number }
  >();
  const zooming = () => Boolean((map as unknown as { _animatingZoom?: boolean })._animatingZoom);
  const render = (
    element: KeyedCanvas,
    coords: Coords,
    key: string,
    finish: () => void,
    attempts = 0,
  ) => {
    let drawn = false;
    void Promise.resolve(
      rendering.renderTile(coords, element, key, () => {
        drawn = true;
        finish();
      }),
    ).then(() => {
      if (drawn || element.key !== key || attempts >= MAX_ATTEMPTS) return;
      stalled.set(element, { coords, key, finish, attempts: attempts + 1 });
      // Do nível atual e com o mapa parado: pode desenhar já.
      if (coords.z === grid._tileZoom && !zooming()) queueMicrotask(flush);
    });
  };
  const flush = () => {
    for (const [element, tile] of stalled) {
      // O Leaflet apaga a chave do tile que descarta.
      if (element.key !== tile.key) stalled.delete(element);
      else if (tile.coords.z === grid._tileZoom) {
        stalled.delete(element);
        render(element, tile.coords, tile.key, tile.finish, tile.attempts);
      }
    }
  };

  rendering.createTile = function (coords, done) {
    const element = document.createElement('canvas') as KeyedCanvas;
    element.className = 'leaflet-tile';
    element.lang = this.lang ?? '';
    const key = this._tileCoordsToKey(coords);
    element.key = key;
    render(element, coords, key, () => done(undefined, element));
    return element;
  };
  // Com `updateWhenZooming: false`, o zoom por roda (caminho da pinça do Leaflet,
  // em `map/WheelGestures.tsx`) não troca o nível do tile: troca aqui, no fim do gesto.
  const settle = () => {
    if (tileZoomFor(map.getZoom()) !== grid._tileZoom)
      grid._setView(map.getCenter(), map.getZoom());
    flush();
  };
  map.on('zoomend', settle);
  map.on('moveend', flush);
  return () => {
    map.off('zoomend', settle);
    map.off('moveend', flush);
    stalled.clear();
  };
}
