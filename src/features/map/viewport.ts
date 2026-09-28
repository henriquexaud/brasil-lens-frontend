import type { Map } from 'leaflet';

const EDGE_PADDING = 24;
const PANEL_WIDTH = 312;
const SIDE_PANEL_BREAKPOINT = 900;
const BOTTOM_PANEL_HEIGHT = 200;
const MAX_INSET_RATIO = 0.4;

export function scopeInsets(map: Map) {
  const { x: width, y: height } = map.getSize();

  const sideLayout = width > SIDE_PANEL_BREAKPOINT;
  const right = sideLayout
    ? Math.min(PANEL_WIDTH + EDGE_PADDING, width * MAX_INSET_RATIO)
    : EDGE_PADDING;
  const bottom = sideLayout
    ? EDGE_PADDING
    : Math.min(
        (document.querySelector('.panel-slot')?.getBoundingClientRect().height ??
          BOTTOM_PANEL_HEIGHT) + EDGE_PADDING,
        height * MAX_INSET_RATIO,
      );

  return {
    paddingTopLeft: [EDGE_PADDING, EDGE_PADDING] as [number, number],
    paddingBottomRight: [right, bottom] as [number, number],
  };
}

export function snapBbox(bbox: string, step: number): string {
  const [west = 0, south = 0, east = 0, north = 0] = bbox.split(',').map(Number);
  const floor = (value: number) => Math.floor(value / step) * step;
  const ceil = (value: number) => Math.ceil(value / step) * step;
  return [floor(west), floor(south), ceil(east), ceil(north)]
    .map((value) => value.toFixed(2))
    .join(',');
}

// The API clips rivers to the requested area and asks ANA once per area, so a
// coarse grid lets small pans reuse the same response. Below detail 6 it serves
// one national snapshot and ignores the area.
export function hydroArea(detail: number, bbox: string | undefined): string | undefined {
  if (detail < 6 || !bbox) return undefined;
  return snapBbox(bbox, detail < 8 ? 1 : detail < 10 ? 0.5 : 0.25);
}
