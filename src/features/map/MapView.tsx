/** Base cartográfica para clima, meio ambiente e navegação territorial.
 * A coleção traz as divisas e os recortes; children acrescenta clima e avisos.
 */
import 'leaflet/dist/leaflet.css';

import { latLngBounds, geoJSON, type PathOptions, type PolylineOptions } from 'leaflet';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { GeoJSON, MapContainer, Pane, TileLayer, useMap } from 'react-leaflet';

import type {
  BoundingBox,
  MapFeature,
  MapFeatureCollection,
  WeatherCity,
  FireMunicipality,
} from '@/api/types';

import { TerritoryLayer } from './TerritoryLayer';
import { ViewportObserver, type MapViewport } from './ViewportObserver';
import type { FireMode } from '@/features/fire/fireDensity';
import { scopeInsets } from './viewport';

// Enquadramento inicial do Brasil, usado antes da primeira resposta.
const BRAZIL_CENTER: [number, number] = [-14.5, -52];
const BRAZIL_ZOOM = 4;

const STATE_HALO_STYLE: PolylineOptions = {
  smoothFactor: 0,
  fill: false,
  color: '#ffffff',
  weight: 4.2,
  opacity: 0.75,
  className: 'state-selected-halo',
};

const STATE_OUTLINE_STYLE: PolylineOptions = {
  smoothFactor: 0,
  fill: false,
  color: 'rgba(71, 85, 105, 0.85)',
  weight: 1.8,
  opacity: 0.95,
  className: 'state-selected-outline',
};

interface Props {
  /** Camadas ambientais entram como children do mapa. */
  collection?: MapFeatureCollection;
  selectedCode?: string | null;
  onSelect?: (ibgeCode: string) => void;
  /** Duplo clique em uma UF pula direto para os seus municípios. */
  onDrillDown?: (ibgeCode: string, name: string) => void;
  /** Camadas de dado que não são a coroplética territorial (ex.: estações e alertas). */
  children?: ReactNode;
  weatherByCode?: Map<string, WeatherCity>;
  fireByCode?: Map<string, FireMunicipality>;
  fireMode?: FireMode;
  fireHours?: number;
  rainMode?: boolean;
  climateMode?: boolean;
  onViewportChange?: (viewport: MapViewport) => void;
  /** Contorno da fronteira do estado quando o usuário está dentro de um estado exibindo cidades. */
  stateOutline?: MapFeature | null;
  locationTarget?: {
    code: string;
    latitude: number;
    longitude: number;
    requestedAt: number;
  } | null;
}

/** Ajusta o enquadramento quando o escopo muda (ex.: drill-down em uma UF). */
function FitToScope({
  bbox,
  scopeKey,
  selectedFeature,
  locationTarget,
}: {
  bbox: BoundingBox | undefined;
  scopeKey: string;
  selectedFeature?: MapFeature;
  locationTarget?: Props['locationTarget'];
}) {
  const map = useMap();

  useEffect(() => {
    if (!bbox) return;
    const [west, south, east, north] = bbox;
    const bounds = selectedFeature
      ? geoJSON(selectedFeature).getBounds()
      : latLngBounds([south, west], [north, east]);

    const fit = (animate: boolean) => {
      // Contêiner ainda sem área (ex.: aba oculta ao montar): enquadrar agora
      // produz coordenadas NaN e derruba o app. O `resize` abaixo enquadra
      // assim que o mapa ganhar tamanho.
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) return;
      const insets = scopeInsets(map);
      if (locationTarget) {
        if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          map.setView([locationTarget.latitude, locationTarget.longitude], 10, { animate: false });
        } else {
          map.flyTo([locationTarget.latitude, locationTarget.longitude], 10, {
            duration: 1.2,
            easeLinearity: 0.25,
          });
        }
        return;
      }
      if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        map.fitBounds(bounds, { ...insets, maxZoom: 10, animate: false });
        return;
      }
      // `flyToBounds` faz um arco de zoom-out/zoom-in em vez do pan+zoom direto
      // do fitBounds — o movimento comunica "saindo de um recorte, entrando em
      // outro" melhor que um deslocamento em linha reta, sobretudo ao pular de
      // UF para UF sem passar pelo mapa do Brasil.
      map.flyToBounds(bounds, { ...insets, maxZoom: 10, duration: 0.6, easeLinearity: 0.15 });
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
    // mesmo escopo não muda, e reenquadrar a cada atualização da camada
    // tiraria o usuário do lugar onde ele estava olhando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, scopeKey, selectedFeature?.id, locationTarget?.requestedAt]);

  return null;
}

export function MapView({
  collection,
  selectedCode = null,
  onSelect = () => {},
  onDrillDown,
  children,
  weatherByCode,
  fireByCode,
  fireMode,
  fireHours,
  rainMode,
  climateMode,
  onViewportChange,
  stateOutline,
  locationTarget,
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
      zoomDelta={0.25}
      // Configurações calibradas para touchpad (ex.: Mac/gestos contínuos):
      // evita saltos bruscos no zoom e preserva inércia natural no pan.
      wheelPxPerZoomLevel={120}
      wheelDebounceTime={60}
      inertia={true}
      inertiaDeceleration={3000}
      inertiaMaxSpeed={2000}
      // O canto superior esquerdo agora é da busca (ver SearchBox/App). Zoom
      // continua por scroll, pinça e +/- do teclado — o handler de teclado do
      // Leaflet independe deste botão.
      zoomControl={false}
      attributionControl
      // Duplo clique numa UF já faz drill-down (ver TerritoryLayer); deixar o
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
        }}
      >
        <TileLayer
          url="https://services.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={9}
          opacity={0.32}
          attribution='<a href="https://www.esri.com/">Esri</a>, USGS, NOAA'
        />
      </Pane>
      {onViewportChange && <ViewportObserver onChange={onViewportChange} scopeKey={scopeKey} />}
      <Pane name="territory-hover" style={{ zIndex: 470, pointerEvents: 'none' }} />
      <Pane name="territory-selection" style={{ zIndex: 480, pointerEvents: 'none' }} />
      {collection && (
        <>
          <TerritoryLayer
            collection={collection}
            onSelect={onSelect}
            onDrillDown={onDrillDown}
            selectedCode={selectedCode}
            weatherByCode={weatherByCode}
            fireByCode={fireByCode}
            fireMode={fireMode}
            fireHours={fireHours}
            rainMode={rainMode}
            climateMode={climateMode}
          />
          <FitToScope
            bbox={collection.bbox}
            scopeKey={scopeKey}
            selectedFeature={
              collection.scope.level === 'municipality'
                ? collection.features.find((f) => f.id === selectedCode)
                : undefined
            }
            locationTarget={locationTarget}
          />
        </>
      )}
      {stateOutline && (
        <Pane name="state-outline" style={{ zIndex: 430, pointerEvents: 'none' }}>
          <GeoJSON
            key={`state-outline-${stateOutline.id ?? stateOutline.properties.ibgeCode}:halo`}
            data={stateOutline}
            interactive={false}
            style={STATE_HALO_STYLE as PathOptions}
          />
          <GeoJSON
            key={`state-outline-${stateOutline.id ?? stateOutline.properties.ibgeCode}:stroke`}
            data={stateOutline}
            interactive={false}
            style={STATE_OUTLINE_STYLE as PathOptions}
          />
        </Pane>
      )}
      {children}
    </MapContainer>
  );
}
