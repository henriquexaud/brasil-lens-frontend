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
