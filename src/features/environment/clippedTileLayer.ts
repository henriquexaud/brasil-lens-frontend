import { DomEvent, type Coords, type DoneCallback } from 'leaflet';

import { FireTileLayer } from '@/features/fire/fireTileLayer';
import type { StateGeometry } from './stateClip';

// O WMS do INPE cobre a tela inteira, e os focos resolvem isso com um filtro por estado na fonte.
// As camadas do PRODES não têm um filtro comum aos seis biomas, então o recorte é do cliente: cada
// tile (já no cache de `FireTileLayer`) é redesenhado num canvas, só dentro da fronteira do estado.
export class StateClippedTileLayer extends FireTileLayer {
  private outline: StateGeometry | null = null;

  setOutline(outline: StateGeometry) {
    this.outline = outline;
  }

  createTile(coords: Coords, done: DoneCallback): HTMLElement {
    const image = super.createTile(coords, () => {}) as HTMLImageElement;
    const size = this.getTileSize();
    const canvas = document.createElement('canvas');
    canvas.width = size.x;
    canvas.height = size.y;
    canvas.setAttribute('role', 'presentation');
    DomEvent.on(image, 'load', () => {
      this.paint(canvas, image, coords);
      done(undefined, canvas);
    });
    DomEvent.on(image, 'error', () => done(new Error('Tile de desmatamento indisponível'), canvas));
    // Do cache a imagem já vem pronta, sem novo evento.
    if (image.complete && image.naturalWidth > 0) {
      this.paint(canvas, image, coords);
      queueMicrotask(() => done(undefined, canvas));
    }
    return canvas;
  }

  private paint(canvas: HTMLCanvasElement, image: HTMLImageElement, coords: Coords) {
    const context = canvas.getContext('2d');
    if (!context || !this.outline || !this._map) return;
    const origin = coords.scaleBy(this.getTileSize());
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.beginPath();
    for (const polygon of this.outline.coordinates) {
      for (const ring of polygon) {
        ring.forEach(([lng, lat], index) => {
          const point = this._map
            .project([lat as number, lng as number], coords.z)
            .subtract(origin);
          if (index === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.closePath();
      }
    }
    context.clip('evenodd');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.restore();
  }
}
