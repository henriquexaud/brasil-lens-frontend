/** GeoJSON from the API; interaction changes presentation only. */
import type { Feature, Geometry } from 'geojson';
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
import { formatValue } from '@/lib/format';

import {
  BORDER_COLOR,
  HOVER_COLOR,
  SELECTED_COLOR,
  colorForClass,
  colorForTemperature,
  paletteForIndicator,
} from './colors';
import { scopeInsets } from './viewport';
import { densityColor, type FireMode } from '@/features/fire/fireDensity';
import { formatFireDate } from '@/features/fire/fireStyles';
import {
  rainAmount,
  rainColor,
  rainDescription,
  rainingNowText,
} from '@/features/rainfall/rainScale';
import { measurement, weatherDescription } from '@/features/weather/conditions';

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
  onHover?: (ibgeCode: string) => void;
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

// textContent keeps API names and units as text, including accents and symbols.
// Animações do tooltip são canceladas quando o território muda.
function fillTooltipContent(
  el: HTMLElement,
  properties: MapFeatureProperties,
  collection: MapFeatureCollection,
  weather?: WeatherCity,
  fire?: FireMunicipality,
  fireHours = 24,
  fireActive = false,
  rainActive = false,
  climateActive = true,
) {
  el.replaceChildren();
  const add = (className: string, text: string) => {
    const line = document.createElement('span');
    line.className = className;
    line.textContent = text;
    el.append(line);
  };
  add('tooltip-name', properties.name);
  if (properties.parentName) add('tooltip-meta', properties.parentName);
  // Valor interpolado de cidades próximas: marcado de leve, sem esconder o dado.
  const estimatePrefix = weather?.isInferred ? '≈ ' : '';
  const estimateSuffix = weather?.isInferred ? ' · estimado' : '';
  if (fireActive) {
    if (fire) {
      const count24h = Number(
        fire.count24h ??
          fire.count24H ??
          (fire as unknown as Record<string, unknown>).count_24h ??
          0,
      );
      const count = Number(fire.count ?? 0);
      add(
        'tooltip-value',
        fire.density == null
          ? 'Densidade indisponível'
          : `${Number(fire.density).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} focos / 1.000 km²`,
      );
      add(
        'tooltip-meta',
        fireHours === 24
          ? `${count24h.toLocaleString('pt-BR')} em 24h`
          : `${count24h.toLocaleString('pt-BR')} em 24h · ${count.toLocaleString('pt-BR')} em ${fireHours}h`,
      );
      if (fire.areaKm2 != null)
        add(
          'tooltip-meta',
          `${Number(fire.areaKm2).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km² · malha IBGE`,
        );
      if (fire.latestDetectionAt)
        add('tooltip-meta', `Última: ${formatFireDate(fire.latestDetectionAt)}`);
    } else add('tooltip-meta', 'Resumo de focos indisponível');
  } else if (rainActive) {
    if (weather) {
      const rainVal = rainAmount(weather);
      const valEl = document.createElement('span');
      valEl.className = 'tooltip-value';
      const dot = document.createElement('span');
      dot.className = 'tooltip-thermal-dot';
      dot.style.backgroundColor = rainColor(rainVal);
      valEl.append(dot);
      const textSpan = document.createElement('span');
      textSpan.textContent = `${estimatePrefix}${Number(rainVal).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mm`;
      valEl.append(textSpan);
      el.append(valEl);
      add('tooltip-meta', `${rainDescription(rainVal)} em 24 h${estimateSuffix}`);
      const live = rainingNowText(weather);
      if (live) add('tooltip-meta tooltip-live-rain', live);
      if (weather.precipitationProbabilityPct != null) {
        add('tooltip-meta', `Chance de chuva hoje: ${weather.precipitationProbabilityPct}%`);
      }
    } else {
      add('tooltip-meta', 'Dados de chuva indisponíveis');
    }
  } else if (climateActive && weather) {
    const valEl = document.createElement('span');
    valEl.className = 'tooltip-value';
    const dot = document.createElement('span');
    dot.className = 'tooltip-thermal-dot';
    dot.style.backgroundColor = colorForTemperature(weather.temperatureC);
    valEl.append(dot);
    const textSpan = document.createElement('span');
    textSpan.textContent = estimatePrefix + measurement(weather.temperatureC, ' °C');
    valEl.append(textSpan);
    el.append(valEl);
    add('tooltip-meta', weatherDescription(weather.weatherCode) + estimateSuffix);
  }
  if (collection.indicator) {
    const { unit, decimalPlaces } = collection.indicator;
    add(
      properties.value === null ? 'tooltip-value is-missing' : 'tooltip-value',
      formatValue(properties.value, unit, decimalPlaces),
    );
  }
  return () => {};
}

function Territories({
  collection,
  onSelect,
  onHover,
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
  const appliedStyleRef = useRef(new WeakMap<Path, string>());
  const hoveredCode = useRef<string | null>(null);
  const municipal = collection.scope.level === 'municipality';
  const canDrillDown = collection.scope.level === 'state' && Boolean(onDrillDown);
  const isClimate = !collection.indicator?.key;
  useEffect(() => {
    if (!fireMode || !isClimate) return;
    const attribution =
      '<a href="https://data.inpe.br/queimadas/" target="_blank" rel="noopener noreferrer">INPE — Queimadas</a>';
    map.attributionControl?.addAttribution(attribution);
    return () => {
      map.attributionControl?.removeAttribution(attribution);
    };
  }, [map, fireMode, isClimate]);
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
    map.on('mousemove', onMouseMove);

    return () => {
      map.off('mousemove', onMouseMove);
      if (moveFrameRef.current !== null) cancelAnimationFrame(moveFrameRef.current);
      if (hideFrameRef.current !== null) cancelAnimationFrame(hideFrameRef.current);
      tooltipCleanupRef.current?.();
      el.remove();
      tooltipElRef.current = null;
    };
  }, [map]);

  const style = useCallback(
    (feature?: TerritoryFeature): PolylineOptions => {
      // React Leaflet retains the original GeoJSON data. Read the latest
      // values while keeping the same SVG paths for a continuous color change.
      const properties = feature && featuresByCode.get(feature.properties.ibgeCode)?.properties;
      const hovered =
        properties?.ibgeCode === hoveredCode.current && properties?.ibgeCode !== selectedCode;

      if (isClimate && fireMode) {
        const fire = properties ? fireByCode?.get(properties.ibgeCode) : undefined;
        const showDensity = fire?.density != null;
        return {
          smoothFactor: 0,
          color: hovered ? HOVER_COLOR : '#ffffff',
          weight: hovered ? 1.2 : municipal ? 0.45 : 0.85,
          opacity: hovered ? 0.9 : 0.65,
          fillColor: showDensity ? densityColor(fire?.density) : '#edf0ee',
          fillOpacity: showDensity
            ? hovered
              ? 0.82
              : fireMode === 'points'
                ? 0.45
                : 0.68
            : hovered
              ? 0.2
              : 0.07,
          className: 'territory-shape climate-territory-shape',
        };
      }
      if (isClimate && rainMode) {
        const weather = properties ? weatherByCode?.get(properties.ibgeCode) : undefined;
        const rainVal = weather ? rainAmount(weather) : 0;
        const hasRain = rainVal > 0;
        const fillColor = rainColor(rainVal);
        const fillOpacity = hasRain ? (hovered ? 0.88 : 0.72) : hovered ? 0.3 : 0.12;
        return {
          smoothFactor: 0,
          color: hovered ? HOVER_COLOR : '#ffffff',
          weight: hovered ? (municipal ? 1.4 : 1.6) : municipal ? 0.5 : 0.85,
          opacity: hovered ? 0.95 : municipal ? 0.7 : 0.85,
          fillOpacity,
          fillColor,
          className: 'territory-shape climate-territory-shape',
        };
      }
      if (isClimate && (climateMode || (!fireMode && !rainMode))) {
        const weather = properties ? weatherByCode?.get(properties.ibgeCode) : undefined;
        const hasDirectTemp = weather?.temperatureC !== null && weather?.temperatureC !== undefined;
        const hasColor = hasDirectTemp;
        const fillColor = hasDirectTemp ? colorForTemperature(weather.temperatureC) : '#f1f5f9';

        const fillOpacity = hasColor ? (hovered ? 0.85 : 0.68) : hovered ? 0.35 : 0.18;
        return {
          smoothFactor: 0,
          color: hovered ? HOVER_COLOR : '#ffffff',
          weight: hovered ? (municipal ? 1.4 : 1.6) : municipal ? 0.5 : 0.85,
          opacity: hovered ? 0.95 : municipal ? 0.7 : 0.85,
          fillOpacity,
          fillColor,
          className: 'territory-shape climate-territory-shape',
        };
      }
      if (isClimate) {
        return {
          smoothFactor: 0,
          color: hovered ? HOVER_COLOR : '#ffffff',
          weight: hovered ? (municipal ? 1.4 : 1.6) : municipal ? 0.5 : 0.85,
          opacity: hovered ? 0.95 : municipal ? 0.7 : 0.85,
          fillOpacity: hovered ? 0.25 : 0.08,
          fillColor: '#f1f5f9',
          className: 'territory-shape climate-territory-shape',
        };
      }

      return {
        color: hovered ? HOVER_COLOR : BORDER_COLOR,
        weight: hovered ? (municipal ? 1.2 : 1.5) : municipal ? 0.4 : 0.75,
        opacity: hovered ? 0.85 : municipal ? 0.55 : 0.8,
        fillOpacity: properties?.classIndex == null ? 0.35 : 0.68,
        fillColor: colorForClass(
          properties?.classIndex ?? null,
          collection.classification,
          paletteForIndicator(collection.indicator?.key),
        ),
        className: 'territory-shape',
      };
    },
    [
      collection.classification,
      collection.indicator?.key,
      featuresByCode,
      isClimate,
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
    onHover,
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
    onHover,
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

  const showTooltipFor = useCallback(
    (properties: MapFeatureProperties, fixedPoint?: Point) => {
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
        collection: col,
      } = propsRef.current;
      const weather = wb?.get(properties.ibgeCode);
      const content = JSON.stringify([
        properties.name,
        properties.parentName,
        properties.value,
        fb?.get(properties.ibgeCode),
        fm,
        rm,
        cm,
        col.indicator,
        weather?.temperatureC,
        weather?.weatherCode,
        weather?.precipitationSumMm,
        weather?.precipitationMm,
        weather?.precipitation24hMm,
        weather?.rainingNow,
        weather?.rainingPoints,
        weather?.precipitationProbabilityPct,
        weather?.isInferred,
      ]);
      if (
        activeTooltipCodeRef.current !== properties.ibgeCode ||
        activeTooltipContentRef.current !== content
      ) {
        tooltipCleanupRef.current?.();
        tooltipCleanupRef.current = fillTooltipContent(
          el,
          properties,
          col,
          weather,
          fb?.get(properties.ibgeCode),
          fh,
          Boolean(fm),
          Boolean(rm),
          Boolean(cm),
        );
        activeTooltipContentRef.current = content;
        needsMeasureRef.current = true;
        activeTooltipCodeRef.current = properties.ibgeCode;
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
      const properties = feature.properties;
      const element = layer.getElement();

      // O hover usa o mesmo `style()` do resto da camada: um estilo à parte
      // divergia dele (na chuva, um município sem chuva ficava quase branco).
      const restyle = () => {
        const nextStyle = propsRef.current.style(territory.feature);
        layer.setStyle(nextStyle);
        appliedStyleRef.current.set(layer, styleKey(nextStyle));
      };

      const hoverEnter = () => {
        hoveredCode.current = properties.ibgeCode;
        restyle();
        propsRef.current.onHover?.(properties.ibgeCode);
        element?.setAttribute('aria-describedby', TOOLTIP_ID);
      };

      const hoverLeave = () => {
        if (hoveredCode.current === properties.ibgeCode) hoveredCode.current = null;
        restyle();
        element?.removeAttribute('aria-describedby');
      };

      const enter = (event: LeafletMouseEvent) => {
        pointerRef.current = { x: event.containerPoint.x, y: event.containerPoint.y };
        hoverEnter();
        showTooltipFor(properties);
      };

      const leave = () => {
        hoverLeave();
        scheduleHideTooltip();
      };

      const click = () => propsRef.current.onSelect(properties.ibgeCode);

      const drill = () => {
        const currentProps = propsRef.current;
        if (currentProps.canDrillDown) {
          currentProps.onDrillDown!(properties.ibgeCode, properties.name);
        } else if (currentProps.municipal && layer instanceof Polygon) {
          currentProps.onSelect(properties.ibgeCode);
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
        const center = map.latLngToContainerPoint((layer as Polygon).getBounds().getCenter());
        showTooltipFor(properties, { x: center.x, y: center.y });
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
      element?.setAttribute('aria-label', properties.name);
      element?.setAttribute(
        'aria-pressed',
        String(properties.ibgeCode === propsRef.current.selectedCode),
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
  }, [featuresByCode, map, municipal, scheduleHideTooltip, showTooltipFor]);

  // Atualização cirúrgica de estilo: aplica layer.setStyle apenas quando o estilo do polígono mudou
  useEffect(() => {
    layerRef.current?.eachLayer((layer) => {
      if (!(layer instanceof Path)) return;
      const territory = layer as Path & { feature: TerritoryFeature };
      const previousFeature = territory.feature;
      const feature = featuresByCode.get(previousFeature?.properties?.ibgeCode);
      if (!feature) return;

      if (layer instanceof Polygon && previousFeature.geometry !== feature.geometry) {
        layer.setLatLngs(LeafletGeoJSON.coordsToLatLngs(feature.geometry.coordinates, 2));
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

    const activeCode = activeTooltipCodeRef.current;
    const activeProperties = activeCode ? featuresByCode.get(activeCode)?.properties : undefined;
    if (activeProperties && hideFrameRef.current === null) {
      showTooltipFor(activeProperties, fixedAnchorRef.current ?? undefined);
    }
  }, [style, selectedCode, featuresByCode, showTooltipFor]);

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

export function ChoroplethLayer(props: Props) {
  const { collection } = props;
  const layerKey = [collection.scope.level, collection.scope.parent ?? 'root'].join(':');

  return <Territories key={layerKey} {...props} />;
}
