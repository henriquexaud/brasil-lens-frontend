import { type LatLng, type Map as LeafletMap, type Point, point } from 'leaflet';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

// O mesmo caminho interno que o TouchZoom do Leaflet usa na pinça: durante o gesto
// só transforma panes e SVG; reprojeta tudo uma vez, no fim.
type GestureMap = LeafletMap & {
  _move(center: LatLng, zoom?: number, data?: { pinch?: boolean; round?: boolean }): void;
  _moveStart(zoomChanged: boolean, noMoveStart: boolean): void;
  _moveEnd(zoomChanged: boolean): void;
  _rawPanBy(offset: Point): void;
  _stop(): void;
  _animatingZoom?: boolean;
};

// Nível de zoom por pixel de deltaY: pinça do trackpad (ctrlKey) e roda do mouse.
const PINCH_ZOOM_PER_PX = 0.012;
const WHEEL_ZOOM_PER_PX = 0.005;
const LINE_PX = 40;
// Sem eventos por este tempo, o gesto (e a inércia do trackpad) acabou.
const GESTURE_IDLE_MS = 140;

type Mode = 'zoom' | 'pan';

interface SafariGestureEvent extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}

// Mouse: degraus em linhas, de 4,000244 px (Chrome no Mac) ou de 100/120 px.
// Trackpad: componente horizontal, ou wheelDeltaY === -3 × deltaY (Chrome e Safari
// no Mac), ou deltas pequenos e contínuos.
function isTrackpad(event: WheelEvent): boolean {
  if (event.deltaMode !== 0) return false;
  if (event.deltaX !== 0) return true;
  const legacy = (event as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY;
  if (legacy && legacy === -3 * event.deltaY) return true;
  if (event.deltaY % 4.000244140625 === 0) return false;
  return Math.abs(event.deltaY) < 50;
}

// Pinça dá zoom em volta do cursor; dois dedos arrastam o mapa; roda do mouse dá zoom.
export function WheelGestures() {
  const map = useMap() as GestureMap;

  useEffect(() => {
    const container = map.getContainer();
    let mode: Mode | null = null;
    let zoomChanged = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let frame: number | null = null;
    let pendingZoom = 0;
    let pendingPan = point(0, 0);
    let anchor = point(0, 0);
    let gestureStartZoom = 0;

    const end = () => {
      clearTimeout(idleTimer);
      if (frame !== null) {
        cancelAnimationFrame(frame);
        flush();
      }
      if (!mode) return;
      mode = null;
      map._moveEnd(zoomChanged);
      zoomChanged = false;
    };

    const begin = (next: Mode) => {
      if (mode === next) return;
      end();
      map._stop();
      mode = next;
      map._moveStart(next === 'zoom', false);
    };

    const zoomTo = (target: number, around: Point) => {
      const zoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), target));
      if (zoom === map.getZoom()) return;
      const viewHalf = map.getSize().divideBy(2);
      const offset = around.subtract(viewHalf).multiplyBy(1 - 1 / map.getZoomScale(zoom));
      map._move(map.containerPointToLatLng(viewHalf.add(offset)), zoom, {
        pinch: true,
        round: false,
      });
      zoomChanged = true;
    };

    function flush() {
      frame = null;
      if (pendingZoom) zoomTo(map.getZoom() + pendingZoom, anchor);
      if (pendingPan.x || pendingPan.y) {
        map._rawPanBy(pendingPan);
        map.fire('move');
      }
      pendingZoom = 0;
      pendingPan = point(0, 0);
    }

    const schedule = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(end, GESTURE_IDLE_MS);
      if (frame === null) frame = requestAnimationFrame(flush);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (map._animatingZoom) return;
      const unit = event.deltaMode === 1 ? LINE_PX : event.deltaMode === 2 ? map.getSize().y : 1;
      const dx = event.deltaX * unit;
      const dy = event.deltaY * unit;
      // A inércia de um gesto de arrasto não vira zoom no meio do caminho.
      const panning = !event.ctrlKey && (mode === 'pan' || (mode === null && isTrackpad(event)));
      if (panning) {
        begin('pan');
        pendingPan = pendingPan.add(point(dx, dy));
      } else {
        begin('zoom');
        anchor = map.mouseEventToContainerPoint(event);
        pendingZoom -= dy * (event.ctrlKey ? PINCH_ZOOM_PER_PX : WHEEL_ZOOM_PER_PX);
      }
      schedule();
    };

    // O Safari não manda a pinça como wheel + ctrlKey, e sim como GestureEvent.
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      begin('zoom');
      gestureStartZoom = map.getZoom();
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const gesture = event as SafariGestureEvent;
      if (mode !== 'zoom') return;
      clearTimeout(idleTimer);
      zoomTo(
        gestureStartZoom + Math.log2(gesture.scale),
        map.mouseEventToContainerPoint(gesture as unknown as MouseEvent),
      );
    };
    const onGestureEnd = (event: Event) => {
      event.preventDefault();
      end();
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('gesturestart', onGestureStart);
    container.addEventListener('gesturechange', onGestureChange);
    container.addEventListener('gestureend', onGestureEnd);
    return () => {
      end();
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('gesturestart', onGestureStart);
      container.removeEventListener('gesturechange', onGestureChange);
      container.removeEventListener('gestureend', onGestureEnd);
    };
  }, [map]);

  return null;
}
