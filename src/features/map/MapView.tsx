/**
 * O mapa.
 *
 * Responsabilidade estreita de propósito: a base cartográfica (tiles, panes,
 * enquadramento) mais um slot para a camada de dado — `children`. A
 * coroplética (`collection`) é uma dessas camadas, não a única: o contexto
 * Clima usa o mesmo shell com `StationLayer`/`AlertsLayer` no lugar de
 * `ChoroplethLayer`, sem `collection` nenhuma (não há coroplética, nem
 * `bbox` para `fitBounds` — ver `features/weather/WeatherDashboard.tsx`).
 * Nenhum cálculo geográfico acontece no browser — o `bbox` usado no
 * `fitBounds` é gravado durante a ingestão e entregue pronto na resposta,
 * justamente para não iterar coordenadas no cliente.
 */
import 'leaflet/dist/leaflet.css';

import { latLngBounds } from 'leaflet';
import type { ReactNode } from 'react';
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
  /** Ausente para contextos sem coroplética (ex.: Clima) — ver `children`. */
  collection?: MapFeatureCollection;
  selectedCode?: string | null;
  onSelect?: (ibgeCode: string) => void;
  onHover?: (ibgeCode: string) => void;
  /** Duplo clique em uma UF pula direto para os seus municípios. */
  onDrillDown?: (ibgeCode: string, name: string) => void;
  /** Camadas de dado que não são a coroplética territorial (ex.: estações e alertas). */
  children?: ReactNode;
}

/** Insets atuais do enquadramento: a folga reservada para o painel flutuante. */
function scopeInsets(map: ReturnType<typeof useMap>) {
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

/** Ajusta o enquadramento quando o escopo muda (ex.: drill-down em uma UF). */
function FitToScope({ bbox, scopeKey }: { bbox: BoundingBox | undefined; scopeKey: string }) {
  const map = useMap();

  useEffect(() => {
    if (!bbox) return;
    const [west, south, east, north] = bbox;
    const bounds = latLngBounds([south, west], [north, east]);

    const fit = (animate: boolean) => {
      const insets = scopeInsets(map);
      if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        map.fitBounds(bounds, { ...insets, animate: false });
        return;
      }
      // `flyToBounds` faz um arco de zoom-out/zoom-in em vez do pan+zoom direto
      // do fitBounds — o movimento comunica "saindo de um recorte, entrando em
      // outro" melhor que um deslocamento em linha reta, sobretudo ao pular de
      // UF para UF sem passar pelo mapa do Brasil.
      map.flyToBounds(bounds, { ...insets, duration: 0.6, easeLinearity: 0.15 });
    };

    fit(true);
    // Redimensionar é ajuste de layout, não navegação: reenquadra na hora, sem
    // voar. Uma animação aqui competia com o próprio recálculo de posição que
    // o Leaflet já faz ao redimensionar, e chegou a colapsar alguns polígonos
    // por um instante (path zerado) até as duas transições se acertarem.
    const onResize = () => fit(false);
    map.on('resize', onResize);
    return () => {
      map.off('resize', onResize);
    };
    // `scopeKey` (e não `bbox`) na dependência, de propósito: o bbox de um
    // mesmo escopo não muda, e reenquadrar o mapa a cada troca de indicador
    // ou de ano tiraria o usuário do lugar onde ele estava olhando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, scopeKey]);

  return null;
}

export function MapView({
  collection,
  selectedCode = null,
  onSelect = () => {},
  onHover,
  onDrillDown,
  children,
}: Props) {
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
      // O canto superior esquerdo agora é da busca (ver SearchBox/App). Zoom
      // continua por scroll, pinça e +/- do teclado — o handler de teclado do
      // Leaflet independe deste botão.
      zoomControl={false}
      attributionControl
      // Duplo clique numa UF já faz drill-down (ver ChoroplethLayer); deixar o
      // zoom nativo do Leaflet também respondendo a duplo clique fazia o
      // mesmo gesto significar duas coisas diferentes dependendo de onde caía
      // — e some sem afetar o drill-down, que é um bind próprio na camada,
      // não este handler do mapa.
      doubleClickZoom={false}
    >
      {/*
       * Apenas contexto cartográfico, sem a camada de referências/labels.
       *
       * O World_Terrain_Base só tem relevo de fato fotografado para os EUA:
       * fora de lá, a partir do zoom 10 (testado no centro do país e também
       * sobre São Paulo), cada tile vira um "Map data not yet available" —
       * texto repetido cobrindo a tela. `maxNativeZoom` trava a busca de
       * tiles nesse teto: o Leaflet passa a ampliar o último tile real em vez
       * de pedir um nível que só existe como aviso. O visual nos zooms usados
       * de fato (todo o país, uma UF, a maioria dos municípios) fica idêntico
       * ao original; só o zoom bem próximo borra em vez de mostrar o aviso.
       */}
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
          maxNativeZoom={9}
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
            onDrillDown={onDrillDown}
            selectedCode={selectedCode}
          />
          <FitToScope bbox={collection.bbox} scopeKey={scopeKey} />
        </>
      )}
      {children}
    </MapContainer>
  );
}
