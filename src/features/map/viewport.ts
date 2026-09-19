import type { Map } from 'leaflet';

const EDGE_PADDING = 24;
/** Largura do painel flutuante (ver --panel-width em styles.css). */
const PANEL_WIDTH = 312;
/**
 * Acima desta largura o painel flutua à direita do mapa; abaixo dela ele passa
 * a ocupar a base da tela. O valor acompanha o mesmo breakpoint do CSS.
 */
const SIDE_PANEL_BREAKPOINT = 900;
/** Altura aproximada do painel quando ele está na base, em telas estreitas. */
const BOTTOM_PANEL_HEIGHT = 200;
/**
 * Nenhuma folga pode passar desta fração do mapa. Sem o teto, uma reserva fixa
 * de 336 px sobrava 15 px úteis em um viewport de 375 px e o `fitBounds`
 * levava o mapa para um ponto arbitrário do oceano.
 */
const MAX_INSET_RATIO = 0.4;

/** Insets atuais do enquadramento: a folga reservada para o painel flutuante. */
export function scopeInsets(map: Map) {
  const { x: width, y: height } = map.getSize();

  // A folga é reservada do lado onde o painel efetivamente está, e sempre
  // limitada a uma fração do mapa.
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
