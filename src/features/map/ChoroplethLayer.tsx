/** GeoJSON from the API; interaction changes presentation only. */
import type { Feature, Geometry } from 'geojson';
import {
  GeoJSON as LeafletGeoJSON,
  type LeafletMouseEvent,
  Path,
  Polygon,
  type PathOptions,
} from 'leaflet';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';

import type { MapFeatureCollection, MapFeatureProperties } from '@/api/types';
import { formatValue } from '@/lib/format';

import { BORDER_COLOR, HOVER_COLOR, SELECTED_COLOR, colorForClass } from './colors';
import { scrambleReveal } from './scrambleReveal';

interface Props {
  collection: MapFeatureCollection;
  onSelect: (ibgeCode: string) => void;
  onHover?: (ibgeCode: string) => void;
  /** Duplo clique em uma UF pula direto para os seus municípios. */
  onDrillDown?: (ibgeCode: string, name: string) => void;
  selectedCode: string | null;
}

type TerritoryFeature = Feature<Geometry, MapFeatureProperties>;
type Point = { x: number; y: number };

const TOOLTIP_ID = 'map-hover-tooltip';
/** Não deixa o card colado no cursor nem sair da faixa visível do mapa. */
const TOOLTIP_MARGIN = 220;

// textContent keeps API names and units as text, including accents and symbols.
// `scramble` liga o efeito de decodificação (ver scrambleReveal); o resto do
// conteúdo troca na hora, sem chamar atenção para si.
function fillTooltipContent(
  el: HTMLElement,
  properties: MapFeatureProperties,
  collection: MapFeatureCollection,
  canDrillDown: boolean,
) {
  el.replaceChildren();
  const add = (className: string, text: string, scramble = false) => {
    const line = document.createElement('span');
    line.className = className;
    if (scramble) scrambleReveal(line, text);
    else line.textContent = text;
    el.append(line);
  };
  add('tooltip-name', properties.name, true);
  if (properties.parentName) add('tooltip-meta', properties.parentName);
  if (collection.indicator) {
    const { unit, decimalPlaces } = collection.indicator;
    add(
      properties.value === null ? 'tooltip-value is-missing' : 'tooltip-value',
      formatValue(properties.value, unit, decimalPlaces),
      true,
    );
  }
  // Único jeito de anunciar o gesto: não há espaço fixo na tela para uma dica
  // permanente, e o tooltip já é o lugar que o usuário está olhando quando
  // paira sobre a UF.
  if (canDrillDown) add('tooltip-hint', 'Duplo clique para ver os municípios');
}

function Territories({ collection, onSelect, onHover, onDrillDown, selectedCode }: Props) {
  const map = useMap();
  const layerRef = useRef<LeafletGeoJSON>(null);
  const selectionHaloRef = useRef<LeafletGeoJSON>(null);
  const selectionOutlineRef = useRef<LeafletGeoJSON>(null);
  const hoveredCode = useRef<string | null>(null);
  const municipal = collection.scope.level === 'municipality';
  // Município é o nível mais fino que a API oferece — duplo clique só tem
  // para onde ir quando o recorte atual é de UFs.
  const canDrillDown = collection.scope.level === 'state' && Boolean(onDrillDown);
  const featuresByCode = useMemo(
    () => new Map(collection.features.map((feature) => [feature.properties.ibgeCode, feature])),
    [collection.features],
  );
  const selectedFeature = useMemo(
    () => collection.features.find((feature) => feature.properties.ibgeCode === selectedCode),
    [collection, selectedCode],
  );

  // --- tooltip único e compartilhado -------------------------------------
  //
  // Antes cada polígono tinha o seu próprio tooltip do Leaflet (bindTooltip
  // por layer). Numa varredura rápida do cursor sobre um mapa de município —
  // que chega a ter centenas de polígonos vizinhos —, o tooltip que estava
  // saindo (fade-out) e o que estava entrando (fade-in) ficavam visíveis ao
  // mesmo tempo por uma fração de segundo: um rastro de cópias sobrepostas
  // em posições diferentes, em vez de um único card seguindo o mouse.
  //
  // A correção é ter só um elemento, sempre vivo, que muda de conteúdo e de
  // posição — nunca um novo elemento por território. A posição é escrita em
  // `transform: translate3d`, no máximo uma vez por frame (rAF), nunca em
  // `top`/`left` (que force layout a cada pixel). O conteúdo só é reescrito
  // quando o território sob o cursor muda de fato, nunca a cada `mousemove`.
  const tooltipElRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<Point | null>(null);
  const fixedAnchorRef = useRef<Point | null>(null);
  const offsetRef = useRef({ dx: 16, dy: -14 });
  const activeTooltipCodeRef = useRef<string | null>(null);
  const moveFrameRef = useRef<number | null>(null);
  const hideFrameRef = useRef<number | null>(null);
  const requestReposition = useRef<() => void>(() => {});

  // Cria o elemento e liga o rastreio do cursor uma única vez: isso não pode
  // ser recriado a cada troca de indicador/ano, só quando o mapa muda.
  useEffect(() => {
    const el = document.createElement('div');
    el.id = TOOLTIP_ID;
    el.className = 'map-tooltip';
    Object.assign(el.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      opacity: '0',
      pointerEvents: 'none',
      willChange: 'transform',
      zIndex: '650',
    });
    map.getContainer().appendChild(el);
    tooltipElRef.current = el;

    const applyPosition = () => {
      moveFrameRef.current = null;
      const point = fixedAnchorRef.current ?? pointerRef.current;
      if (!point || !tooltipElRef.current) return;
      const { dx, dy } = offsetRef.current;
      // translate3d (não top/left) para não disparar layout a cada frame.
      tooltipElRef.current.style.transform = `translate3d(${Math.round(point.x + dx)}px, ${Math.round(point.y + dy)}px, 0)`;
    };
    const scheduleMove = () => {
      if (moveFrameRef.current !== null) return;
      moveFrameRef.current = requestAnimationFrame(applyPosition);
    };
    requestReposition.current = scheduleMove;

    const onMouseMove = (event: LeafletMouseEvent) => {
      pointerRef.current = { x: event.containerPoint.x, y: event.containerPoint.y };
      // Em modo teclado o tooltip fica ancorado no território focado — o
      // cursor pode estar em qualquer lugar, inclusive fora do mapa.
      if (!fixedAnchorRef.current) scheduleMove();
    };
    map.on('mousemove', onMouseMove);

    return () => {
      map.off('mousemove', onMouseMove);
      if (moveFrameRef.current !== null) cancelAnimationFrame(moveFrameRef.current);
      if (hideFrameRef.current !== null) cancelAnimationFrame(hideFrameRef.current);
      el.remove();
      tooltipElRef.current = null;
    };
  }, [map]);

  const style = useCallback(
    (feature?: TerritoryFeature): PathOptions => {
      // React Leaflet retains the original GeoJSON data. Read the latest
      // values while keeping the same SVG paths for a continuous color change.
      const properties = feature && featuresByCode.get(feature.properties.ibgeCode)?.properties;
      const hovered =
        properties?.ibgeCode === hoveredCode.current && properties?.ibgeCode !== selectedCode;
      return {
        color: hovered ? HOVER_COLOR : BORDER_COLOR,
        weight: hovered ? (municipal ? 1.2 : 1.5) : municipal ? 0.4 : 0.75,
        opacity: hovered ? 0.9 : municipal ? 0.55 : 0.8,
        fillOpacity: properties?.classIndex == null ? 0.35 : 0.68,
        fillColor: colorForClass(properties?.classIndex ?? null, collection.classification),
        className: 'territory-shape',
      };
    },
    [collection.classification, featuresByCode, municipal, selectedCode],
  );

  // Rebind interactions to current data without replacing focused paths or
  // open tooltips. Geometry/LOD changes still update the displayed boundaries.
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    // Definidas uma vez por execução do efeito (não por território): operam
    // sobre o tooltip compartilhado, não sobre um layer específico.
    function cancelHide() {
      if (hideFrameRef.current !== null) {
        cancelAnimationFrame(hideFrameRef.current);
        hideFrameRef.current = null;
      }
    }
    // O "leave" agenda o fechamento em vez de fechar na hora: ao cruzar para
    // um território vizinho, o mouseout de um chega no mesmo instante que o
    // mouseover do outro, e adiar um frame dá tempo do "enter" seguinte
    // cancelar o fechamento — sem isso, cada fronteira cruzada piscava o
    // tooltip fechando e abrindo de novo.
    function scheduleHideTooltip() {
      cancelHide();
      hideFrameRef.current = requestAnimationFrame(() => {
        hideFrameRef.current = null;
        if (tooltipElRef.current) tooltipElRef.current.style.opacity = '0';
        activeTooltipCodeRef.current = null;
      });
    }
    function showTooltipFor(properties: MapFeatureProperties, fixedPoint?: Point) {
      cancelHide();
      const el = tooltipElRef.current;
      if (!el) return;
      if (activeTooltipCodeRef.current !== properties.ibgeCode) {
        fillTooltipContent(el, properties, collection, canDrillDown);
        // Decide o lado uma vez por território, não a cada frame: não vale o
        // custo de medir o layout do card a cada pixel que o mouse anda.
        const size = map.getSize();
        const anchor = fixedPoint ?? pointerRef.current;
        offsetRef.current = {
          dx: anchor && anchor.x > size.x - TOOLTIP_MARGIN ? -16 : 16,
          dy: anchor && anchor.y < 90 ? 20 : -14,
        };
        activeTooltipCodeRef.current = properties.ibgeCode;
      }
      fixedAnchorRef.current = fixedPoint ?? null;
      el.style.opacity = '1';
      requestReposition.current();
    }

    layerRef.current?.eachLayer((layer) => {
      if (!(layer instanceof Path)) return;
      const territory = layer as Path & { feature: TerritoryFeature };
      const previousFeature = territory.feature;
      const feature = featuresByCode.get(previousFeature.properties.ibgeCode);
      if (!feature) return;
      if (layer instanceof Polygon && previousFeature.geometry !== feature.geometry) {
        layer.setLatLngs(LeafletGeoJSON.coordsToLatLngs(feature.geometry.coordinates, 2));
      }
      territory.feature = feature;
      const properties = feature.properties;
      const selected = properties.ibgeCode === selectedCode;
      const hoverStyle = { color: HOVER_COLOR, weight: municipal ? 1.2 : 1.5, opacity: 0.9 };
      layer.setStyle(style(feature));
      const element = layer.getElement();
      const hoverEnter = () => {
        hoveredCode.current = properties.ibgeCode;
        if (!selected) layer.setStyle(hoverStyle);
        onHover?.(properties.ibgeCode);
        element?.setAttribute('aria-describedby', TOOLTIP_ID);
      };
      const hoverLeave = () => {
        hoveredCode.current = null;
        layer.setStyle(style(feature));
        element?.removeAttribute('aria-describedby');
      };
      const enter = () => {
        hoverEnter();
        showTooltipFor(properties);
      };
      const leave = () => {
        hoverLeave();
        scheduleHideTooltip();
      };
      const click = () => onSelect(properties.ibgeCode);
      const drill = () => {
        if (canDrillDown) onDrillDown!(properties.ibgeCode, properties.name);
      };
      const focus = () => {
        hoverEnter();
        // Territórios são sempre Polygon/MultiPolygon (nunca Marker/linha) —
        // é o mesmo pressuposto já usado acima para reprojetar a geometria.
        const center = map.latLngToContainerPoint((layer as Polygon).getBounds().getCenter());
        showTooltipFor(properties, { x: center.x, y: center.y });
      };
      const keydown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          click();
        }
      };
      element?.setAttribute('tabindex', '0');
      element?.setAttribute('role', 'button');
      element?.setAttribute('aria-label', properties.name);
      element?.setAttribute('aria-pressed', String(selected));
      element?.addEventListener('focus', focus);
      element?.addEventListener('blur', leave);
      element?.addEventListener('keydown', keydown as EventListener);
      // Do not reorder the interactive SVG on hover: it can cancel the click.
      layer.on({ mouseover: enter, mouseout: leave, click, dblclick: drill });
      cleanups.push(() => {
        layer.off({ mouseover: enter, mouseout: leave, click, dblclick: drill });
        element?.removeEventListener('focus', focus);
        element?.removeEventListener('blur', leave);
        element?.removeEventListener('keydown', keydown as EventListener);
      });
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [
    collection,
    featuresByCode,
    onHover,
    onSelect,
    onDrillDown,
    canDrillDown,
    selectedCode,
    style,
    municipal,
    map,
  ]);

  useEffect(() => {
    if (!selectedFeature) return;
    for (const ref of [selectionHaloRef, selectionOutlineRef]) {
      ref.current?.eachLayer((layer) => {
        if (!(layer instanceof Polygon)) return;
        if (layer.feature?.geometry !== selectedFeature.geometry) {
          layer.setLatLngs(LeafletGeoJSON.coordsToLatLngs(selectedFeature.geometry.coordinates, 2));
          layer.feature = selectedFeature;
        }
      });
    }
  }, [selectedFeature]);

  return (
    <>
      <GeoJSON ref={layerRef} data={collection} style={style} />
      {selectedFeature && (
        <>
          <GeoJSON
            ref={selectionHaloRef}
            key={`${selectedCode}:halo`}
            data={selectedFeature}
            pane="territory-selection"
            interactive={false}
            style={{
              fill: false,
              color: '#ffffff',
              weight: 4.5,
              opacity: 0.8,
              className: 'territory-selection-halo',
            }}
          />
          <GeoJSON
            ref={selectionOutlineRef}
            key={`${selectedCode}:outline`}
            data={selectedFeature}
            pane="territory-selection"
            interactive={false}
            style={{
              fill: false,
              color: SELECTED_COLOR,
              weight: 1.8,
              opacity: 0.95,
              className: 'territory-selection-outline',
            }}
          />
        </>
      )}
    </>
  );
}

export function ChoroplethLayer(props: Props) {
  const { collection } = props;
  const layerKey = [
    collection.scope.level,
    collection.scope.parent ?? 'root',
    collection.scope.lod,
    collection.features.map((feature) => feature.properties.ibgeCode).join(','),
  ].join(':');

  return <Territories key={layerKey} {...props} />;
}
