/**
 * O mapa.
 *
 * Responsabilidade estreita de propósito: renderizar a camada que veio da API e
 * ajustar o enquadramento. Nenhum cálculo geográfico acontece no browser — o
 * `bbox` usado no `fitBounds` é gravado durante a ingestão e entregue pronto na
 * resposta, justamente para não iterar coordenadas no cliente.
 */
import 'leaflet/dist/leaflet.css';

import { latLngBounds } from 'leaflet';
import { useEffect } from 'react';
import { MapContainer, Pane, TileLayer, useMap } from 'react-leaflet';

import type { BoundingBox, MapFeatureCollection } from '@/api/types';

import { ChoroplethLayer } from './ChoroplethLayer';

// Enquadramento inicial do Brasil, usado antes da primeira resposta.
const BRAZIL_CENTER: [number, number] = [-14.5, -52];
const BRAZIL_ZOOM = 4;

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

interface Props {
  collection: MapFeatureCollection | undefined;
  selectedCode: string | null;
  onSelect: (ibgeCode: string) => void;
  onHover?: (ibgeCode: string) => void;
}

/** Ajusta o enquadramento quando o escopo muda (ex.: drill-down em uma UF). */
function FitToScope({ bbox, scopeKey }: { bbox: BoundingBox | undefined; scopeKey: string }) {
  const map = useMap();

  useEffect(() => {
    if (!bbox) return;
    const fit = () => {
      const [west, south, east, north] = bbox;
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

      map.fitBounds(latLngBounds([south, west], [north, east]), {
        paddingTopLeft: [EDGE_PADDING, EDGE_PADDING],
        paddingBottomRight: [right, bottom],
        animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      });
    };
    fit();
    map.on('resize', fit);
    return () => {
      map.off('resize', fit);
    };
    // `scopeKey` (e não `bbox`) na dependência, de propósito: o bbox de um
    // mesmo escopo não muda, e reenquadrar o mapa a cada troca de indicador
    // ou de ano tiraria o usuário do lugar onde ele estava olhando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, scopeKey]);

  return null;
}

export function MapView({ collection, selectedCode, onSelect, onHover }: Props) {
  const scopeKey = collection
    ? `${collection.scope.level}:${collection.scope.parent ?? 'root'}`
    : 'initial';

  return (
    <MapContainer
      center={BRAZIL_CENTER}
      zoom={BRAZIL_ZOOM}
      className="map-container"
      minZoom={3}
      maxZoom={12}
      // Sem passo fracionário o Leaflet arredonda para o zoom inteiro inferior
      // e sobra uma faixa larga de oceano em volta do país.
      zoomSnap={0.25}
      // O controle de zoom fica, mas discreto (ver styles.css): é a única
      // alternativa ao scroll para quem usa teclado ou não descobre o gesto.
      zoomControl
      attributionControl
    >
      {/* Apenas contexto cartográfico, sem a camada de referências/labels. */}
      <Pane
        name="basemap"
        style={{
          zIndex: 200,
          pointerEvents: 'none',
          filter: 'grayscale(1) contrast(0.65) brightness(1.2)',
        }}
      >
        <TileLayer
          url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}"
          opacity={0.45}
          attribution='<a href="https://www.esri.com/">Esri</a>, USGS, NOAA'
        />
      </Pane>
      <Pane name="territory-selection" style={{ zIndex: 480, pointerEvents: 'none' }} />
      {collection && (
        <>
          <ChoroplethLayer
            collection={collection}
            onSelect={onSelect}
            onHover={onHover}
            selectedCode={selectedCode}
          />
          <FitToScope bbox={collection.bbox} scopeKey={scopeKey} />
        </>
      )}
    </MapContainer>
  );
}
