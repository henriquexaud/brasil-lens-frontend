import type { Feature, Geometry, MultiPolygon, Polygon as GeoJSONPolygon } from 'geojson';
import {
  GeoJSON as LeafletGeoJSON,
  type LeafletMouseEvent,
  type Layer,
  Path,
  type PathOptions,
  Polygon,
  type PolylineOptions,
} from 'leaflet';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';

import type {
  MapFeatureCollection,
  MapFeatureProperties,
  WeatherCity,
  FireMunicipality,
} from '@/api/types';

import { HOVER_COLOR, SELECTED_COLOR, colorForTemperature } from './colors';
import { scopeInsets } from './viewport';
import { rainAmount, rainColor } from '@/features/rainfall/rainScale';
import { fillTooltipContent } from './territoryTooltip';
import { densityColor, type FireMode } from '@/features/fire/fireDensity';

const SELECTION_HALO_STYLE: PolylineOptions = {
  smoothFactor: 0,
  fill: false,
  color: '#ffffff',
  weight: 4.5,
  opacity: 0.8,
  className: 'territory-selection-halo',
};

const SELECTION_OUTLINE_STYLE: PolylineOptions = {
  smoothFactor: 0,
  fill: false,
  color: SELECTED_COLOR,
  weight: 1.8,
  opacity: 0.95,
  className: 'territory-selection-outline',
};

interface Props {
  collection: MapFeatureCollection;
  onSelect: (ibgeCode: string) => void;
  /** Duplo clique em uma UF pula direto para os seus municípios. */
  onDrillDown?: (ibgeCode: string, name: string) => void;
  selectedCode: string | null;
  weatherByCode?: Map<string, WeatherCity>;
  fireByCode?: Map<string, FireMunicipality>;
  fireMode?: FireMode;
  fireHours?: number;
  rainMode?: boolean;
  climateMode?: boolean;
}

type TerritoryFeature = Feature<Geometry, MapFeatureProperties>;
type Point = { x: number; y: number };

const TOOLTIP_ID = 'map-hover-tooltip';
/** Não deixa o card colado no cursor nem sair da faixa visível do mapa. */
const TOOLTIP_EDGE = 8;

/** Só estes campos mudam entre estilos; comparar evita `setStyle` sem efeito. */
function styleKey(style: PathOptions): string {
  return [style.color, style.fillColor, style.weight, style.opacity, style.fillOpacity].join('|');
}

/** A partir daqui o hover é instantâneo: um fade por polígono vira rastro. */
const DENSE_FEATURES = 150;

function preserveBoundary(_feature: Feature, layer: Layer) {
  if (layer instanceof Polygon) layer.options.smoothFactor = 0;
}

function Territories({
  collection,
  onSelect,
  onDrillDown,
  selectedCode,
  weatherByCode,
  fireByCode,
  fireMode,
  fireHours = 24,
  rainMode,
  climateMode = true,
}: Props) {
  const map = useMap();
  const layerRef = useRef<LeafletGeoJSON>(null);
  const selectionHaloRef = useRef<LeafletGeoJSON>(null);
  const selectionOutlineRef = useRef<LeafletGeoJSON>(null);
  const hoverLayerRef = useRef<LeafletGeoJSON | null>(null);
  const appliedStyleRef = useRef(new WeakMap<Path, string>());
  const hoveredCode = useRef<string | null>(null);
  const activeHoveredLayerRef = useRef<Path | null>(null);
  const isMapMovingRef = useRef(false);
  const municipal = collection.scope.level === 'municipality';
  const canDrillDown = collection.scope.level === 'state' && Boolean(onDrillDown);
  useEffect(() => {
    if (!fireMode) return;
    const attribution =
      '<a href="https://data.inpe.br/queimadas/" target="_blank" rel="noopener noreferrer">INPE — Queimadas</a>';
    map.attributionControl?.addAttribution(attribution);
    return () => {
      map.attributionControl?.removeAttribution(attribution);
    };
  }, [map, fireMode]);
  const dense = collection.features.length > DENSE_FEATURES;
  useEffect(() => {
    const container = map.getContainer();
    container.classList.toggle('map-dense', dense);
    return () => container.classList.remove('map-dense');
  }, [map, dense]);
  const featuresByCode = useMemo(
    () => new Map(collection.features.map((feature) => [feature.properties.ibgeCode, feature])),
    [collection.features],
  );
  const featuresByCodeRef = useRef(featuresByCode);
  featuresByCodeRef.current = featuresByCode;

  const updateHoverOutline = useCallback((code: string | null) => {
    const layer = hoverLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!code || code === propsRef.current.selectedCode) return;
    const feature = featuresByCodeRef.current.get(code);
    if (feature) {
      layer.addData(feature);
      if (typeof layer.bringToFront === 'function') {
        layer.bringToFront();
      }
    }
  }, []);

  useEffect(() => {
    if (!map.getPane('territory-hover')) {
      const pane = map.createPane('territory-hover');
      pane.style.zIndex = '470';
      pane.style.pointerEvents = 'none';
    }

    const hoverLayer = new LeafletGeoJSON(undefined, {
      pane: 'territory-hover',
      interactive: false,
      onEachFeature: preserveBoundary,
      style: () => ({
        smoothFactor: 0,
        fill: false,
        color: HOVER_COLOR,
        weight: municipal ? 1.5 : 1.8,
        opacity: 0.9,
        className: 'territory-hover-outline',
      }),
    });

    hoverLayer.addTo(map);
    hoverLayerRef.current = hoverLayer;

    return () => {
      hoverLayer.remove();
      hoverLayerRef.current = null;
    };
  }, [map, municipal]);

  const selectedFeature = useMemo(
    () => collection.features.find((feature) => feature.properties.ibgeCode === selectedCode),
    [collection, selectedCode],
  );

  // Acrescenta/remove apenas as features que entraram ou saíram: um lote não
  // recria os SVGs já desenhados, nem perde o foco de teclado ou o tooltip.
  // Uma malha nova do mesmo território (o LOD leve trocado pelo detalhado) é
  // aplicada no próprio path, no efeito de estilo abaixo — sem piscar.
  useEffect(() => {
    const group = layerRef.current;
    if (!group) return;
    const present = new Set<string>();
    group.eachLayer((layer) => {
      const feature = (layer as Path & { feature?: TerritoryFeature }).feature;
      const code = feature?.properties.ibgeCode;
      if (!code || !featuresByCode.has(code)) group.removeLayer(layer);
      else present.add(code);
    });
    for (const [code, feature] of featuresByCode) {
      if (!present.has(code)) group.addData(feature);
    }
  }, [featuresByCode]);

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
  const tooltipCleanupRef = useRef<(() => void) | null>(null);
  const tooltipElRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<Point | null>(null);
  const fixedAnchorRef = useRef<Point | null>(null);
  const offsetRef = useRef({ dx: 16, dy: -14 });
  const tooltipSizeRef = useRef({ width: 0, height: 0 });
  // Medir o card força layout; com centenas de polígonos, o cursor cruza vários
  // por frame. A medida fica para o frame seguinte, uma vez só.
  const needsMeasureRef = useRef(false);
  const activeTooltipCodeRef = useRef<string | null>(null);
  const activeTooltipContentRef = useRef('');
  const moveFrameRef = useRef<number | null>(null);
  const hideFrameRef = useRef<number | null>(null);
  const requestReposition = useRef<() => void>(() => {});

  const style = useCallback(
    (feature?: TerritoryFeature): PolylineOptions => {
      // React Leaflet retains the original GeoJSON data. Read the latest
      // values while keeping the same SVG paths for a continuous color change.
      const properties = feature && featuresByCode.get(feature.properties.ibgeCode)?.properties;
      const hovered =
        properties?.ibgeCode === hoveredCode.current && properties?.ibgeCode !== selectedCode;

      if (fireMode) {
        const fire = properties ? fireByCode?.get(properties.ibgeCode) : undefined;
        const showDensity = fire?.density != null;
        return {
          smoothFactor: 0,
          color: '#ffffff',
          weight: municipal ? 0.45 : 0.85,
          opacity: 0.65,
          fillColor: showDensity ? densityColor(fire?.density) : '#edf0ee',
          fillOpacity: showDensity
            ? hovered
              ? 0.82
              : fireMode === 'points'
                ? 0.45
                : 0.68
            : hovered
              ? 0.45
              : 0.35,
          className: 'territory-shape climate-territory-shape',
        };
      }
      if (rainMode) {
        const weather = properties ? weatherByCode?.get(properties.ibgeCode) : undefined;
        const rainVal = weather ? rainAmount(weather) : 0;
        const hasRain = rainVal > 0;
        const fillColor = rainColor(rainVal);
        const fillOpacity = hasRain ? (hovered ? 0.88 : 0.72) : hovered ? 0.3 : 0.12;
        return {
          smoothFactor: 0,
          color: '#ffffff',
          weight: municipal ? 0.5 : 0.85,
          opacity: municipal ? 0.7 : 0.85,
          fillOpacity,
          fillColor,
          className: 'territory-shape climate-territory-shape',
        };
      }
      if (climateMode || (!fireMode && !rainMode)) {
        const weather = properties ? weatherByCode?.get(properties.ibgeCode) : undefined;
        const hasDirectTemp = weather?.temperatureC !== null && weather?.temperatureC !== undefined;
        const hasColor = hasDirectTemp;
        const fillColor = hasDirectTemp ? colorForTemperature(weather.temperatureC) : '#f1f5f9';

        const fillOpacity = hasColor ? (hovered ? 0.85 : 0.68) : hovered ? 0.35 : 0.18;
        return {
          smoothFactor: 0,
          color: '#ffffff',
          weight: municipal ? 0.5 : 0.85,
          opacity: municipal ? 0.7 : 0.85,
          fillOpacity,
          fillColor,
          className: 'territory-shape climate-territory-shape',
        };
      }
      return {
        smoothFactor: 0,
        color: '#ffffff',
        weight: municipal ? 0.5 : 0.85,
        opacity: municipal ? 0.7 : 0.85,
        fillOpacity: hovered ? 0.25 : 0.08,
        fillColor: '#f1f5f9',
        className: 'territory-shape climate-territory-shape',
      };
    },
    [
      featuresByCode,
      municipal,
      selectedCode,
      weatherByCode,
      fireByCode,
      fireMode,
      rainMode,
      climateMode,
    ],
  );

  // Rebind interactions to current data without replacing focused paths or
  // open tooltips. Geometry/LOD changes still update the displayed boundaries.
  const propsRef = useRef({
    onSelect,
    onDrillDown,
    canDrillDown,
    selectedCode,
    municipal,
    weatherByCode,
    fireByCode,
    fireMode,
    fireHours,
    rainMode,
    climateMode,
    collection,
    style,
  });
  propsRef.current = {
    onSelect,
    onDrillDown,
    canDrillDown,
    selectedCode,
    municipal,
    weatherByCode,
    fireByCode,
    fireMode,
    fireHours,
    rainMode,
    climateMode,
    collection,
    style,
  };

  const boundLayersRef = useRef(new WeakSet<Path>());

  // Tooltip compartilhado e helpers de interação
  const cancelHide = useCallback(() => {
    if (hideFrameRef.current !== null) {
      cancelAnimationFrame(hideFrameRef.current);
      hideFrameRef.current = null;
    }
  }, []);

  const scheduleHideTooltip = useCallback(() => {
    cancelHide();
    hideFrameRef.current = requestAnimationFrame(() => {
      hideFrameRef.current = null;
      if (tooltipElRef.current) tooltipElRef.current.style.opacity = '0';
      activeTooltipCodeRef.current = null;
    });
  }, [cancelHide]);

  const clearHover = useCallback(() => {
    hoveredCode.current = null;
    if (activeHoveredLayerRef.current) {
      const prevLayer = activeHoveredLayerRef.current;
      activeHoveredLayerRef.current = null;
      const prevFeature = (prevLayer as Path & { feature?: TerritoryFeature }).feature;
      if (prevFeature) {
        const normalStyle = propsRef.current.style(prevFeature);
        prevLayer.setStyle(normalStyle);
        appliedStyleRef.current.set(prevLayer, styleKey(normalStyle));
        prevLayer.getElement()?.removeAttribute('aria-describedby');
      }
    }
    updateHoverOutline(null);
    scheduleHideTooltip();
  }, [scheduleHideTooltip, updateHoverOutline]);

  // Cria o elemento e liga o rastreio do cursor uma única vez: isso não pode
  // ser recriado quando o mapa muda.
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
      const size = map.getSize();
      if (needsMeasureRef.current) {
        needsMeasureRef.current = false;
        const { offsetWidth: width, offsetHeight: height } = tooltipElRef.current;
        tooltipSizeRef.current = { width, height };
        offsetRef.current = {
          dx: point.x + width + 16 > size.x ? -width - 16 : 16,
          dy: point.y < 90 ? 20 : -14,
        };
      }
      const { dx, dy } = offsetRef.current;
      // translate3d (não top/left) para não disparar layout a cada frame.
      const { width, height } = tooltipSizeRef.current;
      const x = Math.max(TOOLTIP_EDGE, Math.min(point.x + dx, size.x - width - TOOLTIP_EDGE));
      const y = Math.max(TOOLTIP_EDGE, Math.min(point.y + dy, size.y - height - TOOLTIP_EDGE));
      tooltipElRef.current.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
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
    const onMapMouseOut = (event: LeafletMouseEvent) => {
      const container = map.getContainer();
      const related = (event.originalEvent as MouseEvent).relatedTarget as Node | null;
      if (!related || !container.contains(related)) {
        clearHover();
      }
    };
    const onMoveStart = () => {
      isMapMovingRef.current = true;
      clearHover();
    };
    const onMoveEnd = () => {
      isMapMovingRef.current = false;
    };
    map.on('mousemove', onMouseMove);
    map.on('mouseout', onMapMouseOut);
    map.on('movestart', onMoveStart);
    map.on('zoomstart', onMoveStart);
    map.on('moveend', onMoveEnd);
    map.on('zoomend', onMoveEnd);

    return () => {
      map.off('mousemove', onMouseMove);
      map.off('mouseout', onMapMouseOut);
      map.off('movestart', onMoveStart);
      map.off('zoomstart', onMoveStart);
      map.off('moveend', onMoveEnd);
      map.off('zoomend', onMoveEnd);
      clearHover();
      if (moveFrameRef.current !== null) cancelAnimationFrame(moveFrameRef.current);
      if (hideFrameRef.current !== null) cancelAnimationFrame(hideFrameRef.current);
      tooltipCleanupRef.current?.();
      el.remove();
      tooltipElRef.current = null;
    };
  }, [clearHover, map]);

  const showTooltipFor = useCallback(
    (code: string, fixedPoint?: Point) => {
      if (isMapMovingRef.current) return;
      cancelHide();
      const el = tooltipElRef.current;
      if (!el) return;
      const {
        weatherByCode: wb,
        fireByCode: fb,
        fireMode: fm,
        fireHours: fh,
        rainMode: rm,
        climateMode: cm = true,
      } = propsRef.current;
      const currentFeature = featuresByCodeRef.current.get(code);
      const properties = currentFeature?.properties;
      if (!properties) return;

      const weather = wb?.get(code);
      const content = JSON.stringify([
        properties.name,
        properties.parentName,
        fb?.get(code),
        fm,
        rm,
        cm,
        weather?.temperatureC,
        weather?.weatherCode,
        weather?.precipitationSumMm,
        weather?.precipitationMm,
        weather?.precipitation24hMm,
        weather?.rainingNow,
        weather?.rainingPoints,
        weather?.samplePoints,
        weather?.precipitationProbabilityPct,
        weather?.isInferred,
      ]);
      if (activeTooltipCodeRef.current !== code || activeTooltipContentRef.current !== content) {
        tooltipCleanupRef.current?.();
        tooltipCleanupRef.current = fillTooltipContent(
          el,
          properties,
          weather,
          fb?.get(code),
          fh,
          Boolean(fm),
          Boolean(rm),
          Boolean(cm),
        );
        activeTooltipContentRef.current = content;
        needsMeasureRef.current = true;
        activeTooltipCodeRef.current = code;
      }
      fixedAnchorRef.current = fixedPoint ?? null;
      el.style.opacity = '1';
      requestReposition.current();
    },
    [cancelHide],
  );

  // Amarração de eventos aos nós SVG — executada UMA VEZ por layer para evitar recriação de listeners
  useEffect(() => {
    layerRef.current?.eachLayer((layer) => {
      if (!(layer instanceof Path)) return;
      if (boundLayersRef.current.has(layer)) return;
      boundLayersRef.current.add(layer);

      const territory = layer as Path & { feature: TerritoryFeature };
      const feature = territory.feature;
      if (!feature) return;
      const initialProperties = feature.properties;
      const element = layer.getElement();

      const getCode = () =>
        (layer as Path & { feature?: TerritoryFeature }).feature?.properties.ibgeCode ??
        initialProperties.ibgeCode;

      // O hover usa o mesmo `style()` do resto da camada: um estilo à parte
      // divergia dele (na chuva, um município sem chuva ficava quase branco).
      const restyle = () => {
        const currentFeature = (layer as Path & { feature?: TerritoryFeature }).feature;
        if (!currentFeature) return;
        const nextStyle = propsRef.current.style(currentFeature);
        layer.setStyle(nextStyle);
        appliedStyleRef.current.set(layer, styleKey(nextStyle));
      };

      const hoverEnter = () => {
        if (isMapMovingRef.current) return;
        const code = getCode();
        if (!code || code === propsRef.current.selectedCode) return;

        if (activeHoveredLayerRef.current && activeHoveredLayerRef.current !== layer) {
          const prevLayer = activeHoveredLayerRef.current;
          const prevFeature = (prevLayer as Path & { feature?: TerritoryFeature }).feature;
          if (prevFeature) {
            const normalStyle = propsRef.current.style(prevFeature);
            prevLayer.setStyle(normalStyle);
            appliedStyleRef.current.set(prevLayer, styleKey(normalStyle));
            prevLayer.getElement()?.removeAttribute('aria-describedby');
          }
        }
        activeHoveredLayerRef.current = layer;
        hoveredCode.current = code;

        restyle();
        updateHoverOutline(code);
        element?.setAttribute('aria-describedby', TOOLTIP_ID);
      };

      const hoverLeave = () => {
        const code = getCode();
        if (code && hoveredCode.current === code) {
          hoveredCode.current = null;
          updateHoverOutline(null);
        }
        if (activeHoveredLayerRef.current === layer) {
          activeHoveredLayerRef.current = null;
        }
        restyle();
        element?.removeAttribute('aria-describedby');
      };

      const enter = (event: LeafletMouseEvent) => {
        if (isMapMovingRef.current) return;
        pointerRef.current = { x: event.containerPoint.x, y: event.containerPoint.y };
        hoverEnter();
        const code = getCode();
        if (code) showTooltipFor(code);
      };

      const leave = () => {
        hoverLeave();
        scheduleHideTooltip();
      };

      const click = () => {
        if (activeHoveredLayerRef.current) {
          const prevLayer = activeHoveredLayerRef.current;
          activeHoveredLayerRef.current = null;
          const prevFeature = (prevLayer as Path & { feature?: TerritoryFeature }).feature;
          if (prevFeature) {
            const normalStyle = propsRef.current.style(prevFeature);
            prevLayer.setStyle(normalStyle);
            appliedStyleRef.current.set(prevLayer, styleKey(normalStyle));
            prevLayer.getElement()?.removeAttribute('aria-describedby');
          }
        }
        hoveredCode.current = null;
        updateHoverOutline(null);
        const code = getCode();
        if (code) propsRef.current.onSelect(code);
      };

      const drill = () => {
        clearHover();
        const code = getCode();
        if (!code) return;
        const currentProps = propsRef.current;
        const currentFeature = featuresByCodeRef.current.get(code);
        const name = currentFeature?.properties.name ?? initialProperties.name;
        if (currentProps.canDrillDown) {
          currentProps.onDrillDown!(code, name);
        } else if (currentProps.municipal && layer instanceof Polygon) {
          currentProps.onSelect(code);
          scheduleHideTooltip();
          map.stop();
          map.flyToBounds(layer.getBounds(), {
            ...scopeInsets(map),
            maxZoom: 12,
            duration: 0.6,
            animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          });
        }
      };

      const focus = () => {
        hoverEnter();
        const code = getCode();
        if (!code) return;
        const center = map.latLngToContainerPoint((layer as Polygon).getBounds().getCenter());
        showTooltipFor(code, { x: center.x, y: center.y });
      };

      const keydown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          if (event.shiftKey && event.key === 'Enter') drill();
          else click();
        }
      };

      element?.setAttribute('tabindex', '0');
      element?.setAttribute('role', 'button');
      element?.setAttribute('aria-label', initialProperties.name);
      element?.setAttribute(
        'aria-pressed',
        String(initialProperties.ibgeCode === propsRef.current.selectedCode),
      );
      element?.setAttribute('aria-keyshortcuts', 'Enter Space Shift+Enter');
      element?.setAttribute(
        'aria-description',
        municipal
          ? 'Enter para selecionar. Shift + Enter para centralizar e aproximar.'
          : 'Enter para selecionar. Shift + Enter para ver os municípios.',
      );

      element?.addEventListener('focus', focus);
      element?.addEventListener('blur', leave);
      element?.addEventListener('keydown', keydown as EventListener);
      layer.on({ mouseover: enter, mouseout: leave, click, dblclick: drill });
    });
  }, [
    clearHover,
    featuresByCode,
    map,
    municipal,
    scheduleHideTooltip,
    showTooltipFor,
    updateHoverOutline,
  ]);

  // Limpa o hover e esconde o tooltip ao trocar de escopo territorial
  useEffect(() => {
    clearHover();
  }, [collection.scope.level, collection.scope.parent, clearHover]);

  // Atualização cirúrgica de estilo: aplica layer.setStyle apenas quando o estilo do polígono mudou
  useEffect(() => {
    layerRef.current?.eachLayer((layer) => {
      if (!(layer instanceof Path)) return;
      const territory = layer as Path & { feature: TerritoryFeature };
      const previousFeature = territory.feature;
      const feature = featuresByCode.get(previousFeature?.properties?.ibgeCode);
      if (!feature) return;

      if (layer instanceof Polygon && previousFeature.geometry !== feature.geometry) {
        try {
          const isMulti = feature.geometry.type === 'MultiPolygon';
          const coords = (feature.geometry as MultiPolygon | GeoJSONPolygon).coordinates;
          if (coords) {
            layer.setLatLngs(LeafletGeoJSON.coordsToLatLngs(coords, isMulti ? 2 : 1));
          }
        } catch {
          // Garante que eventual erro de coordenadas em um polígono não interrompa os demais
        }
      }
      territory.feature = feature;

      const properties = feature.properties;
      const selected = properties.ibgeCode === selectedCode;
      const nextStyle = style(feature);
      const key = styleKey(nextStyle);
      if (appliedStyleRef.current.get(layer) !== key) {
        layer.setStyle(nextStyle);
        appliedStyleRef.current.set(layer, key);
      }

      const element = layer.getElement();
      if (element) {
        element.setAttribute('aria-pressed', String(selected));
      }
    });

    if (hoveredCode.current === selectedCode) {
      if (activeHoveredLayerRef.current) {
        const prevLayer = activeHoveredLayerRef.current;
        activeHoveredLayerRef.current = null;
        const prevFeature = (prevLayer as Path & { feature?: TerritoryFeature }).feature;
        if (prevFeature) {
          const normalStyle = style(prevFeature);
          prevLayer.setStyle(normalStyle);
          appliedStyleRef.current.set(prevLayer, styleKey(normalStyle));
          prevLayer.getElement()?.removeAttribute('aria-describedby');
        }
      }
      hoveredCode.current = null;
      updateHoverOutline(null);
    }

    const activeCode = activeTooltipCodeRef.current;
    if (activeCode && hideFrameRef.current === null) {
      showTooltipFor(activeCode, fixedAnchorRef.current ?? undefined);
    }
  }, [clearHover, style, selectedCode, featuresByCode, showTooltipFor, updateHoverOutline]);

  useEffect(() => {
    if (!selectedFeature) return;
    for (const ref of [selectionHaloRef, selectionOutlineRef]) {
      ref.current?.eachLayer((layer) => {
        if (!(layer instanceof Polygon)) return;
        if (layer.feature?.geometry !== selectedFeature.geometry) {
          try {
            const isMulti = selectedFeature.geometry.type === 'MultiPolygon';
            const coords = (selectedFeature.geometry as MultiPolygon | GeoJSONPolygon).coordinates;
            if (coords) {
              layer.setLatLngs(LeafletGeoJSON.coordsToLatLngs(coords, isMulti ? 2 : 1));
            }
            layer.feature = selectedFeature;
          } catch {
            // Garante que erro de coordenadas não quebre a seleção
          }
        }
      });
    }
  }, [selectedFeature]);

  return (
    <>
      <GeoJSON ref={layerRef} data={collection} style={style} onEachFeature={preserveBoundary} />
      {selectedFeature && (
        <>
          <GeoJSON
            ref={selectionHaloRef}
            key={`${selectedCode}:halo`}
            data={selectedFeature}
            onEachFeature={preserveBoundary}

            pane="territory-selection"
            interactive={false}
            style={SELECTION_HALO_STYLE as PathOptions}
          />
          <GeoJSON
            ref={selectionOutlineRef}
            key={`${selectedCode}:outline`}
            data={selectedFeature}
            onEachFeature={preserveBoundary}

            pane="territory-selection"
            interactive={false}
            style={SELECTION_OUTLINE_STYLE as PathOptions}
          />
        </>
      )}
    </>
  );
}

export function TerritoryLayer(props: Props) {
  const { collection } = props;
  const layerKey = [collection.scope.level, collection.scope.parent ?? 'root'].join(':');

  return <Territories key={layerKey} {...props} />;
}
