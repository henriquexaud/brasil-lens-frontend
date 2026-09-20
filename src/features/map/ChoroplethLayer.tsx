/** GeoJSON from the API; interaction changes presentation only. */
import type { Feature, Geometry } from 'geojson';
import {
  GeoJSON as LeafletGeoJSON,
  type LeafletMouseEvent,
  Path,
  Polygon,
  type PathOptions,
} from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';

import type { MapFeatureCollection, MapFeatureProperties, WeatherCity } from '@/api/types';
import { formatValue } from '@/lib/format';

import {
  BORDER_COLOR,
  HOVER_COLOR,
  SELECTED_COLOR,
  colorForClass,
  colorForTemperature,
  paletteForIndicator,
} from './colors';
import { revealText, type RevealMode } from '@/lib/revealText';
import { scopeInsets } from './viewport';
import { measurement, weatherDescription } from '@/features/weather/conditions';

interface Props {
  collection: MapFeatureCollection;
  onSelect: (ibgeCode: string) => void;
  onHover?: (ibgeCode: string) => void;
  /** Duplo clique em uma UF pula direto para os seus municípios. */
  onDrillDown?: (ibgeCode: string, name: string) => void;
  selectedCode: string | null;
  weatherByCode?: Map<string, WeatherCity>;
}

type TerritoryFeature = Feature<Geometry, MapFeatureProperties>;
type Point = { x: number; y: number };

const TOOLTIP_ID = 'map-hover-tooltip';
/** Não deixa o card colado no cursor nem sair da faixa visível do mapa. */
const TOOLTIP_EDGE = 8;

/** Estima o centróide aproximado de um polígono para cálculo de vizinhança espacial rápida. */
function computeFeatureCenter(feature: TerritoryFeature): [number, number] {
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  const geom = feature.geometry as { type: string; coordinates?: unknown };
  if (!geom || !geom.coordinates) return [0, 0];

  const coords = geom.coordinates;
  if (Array.isArray(coords)) {
    const polygons = geom.type === 'MultiPolygon' ? coords : [coords];
    for (const poly of polygons) {
      const ring = Array.isArray(poly) ? poly[0] : null;
      if (!ring || !Array.isArray(ring)) continue;
      const step = Math.max(1, Math.floor(ring.length / 8));
      for (let i = 0; i < ring.length; i += step) {
        const pt = ring[i];
        if (pt && typeof pt[0] === 'number' && typeof pt[1] === 'number') {
          sumLng += pt[0];
          sumLat += pt[1];
          count++;
        }
      }
    }
  }
  return count > 0 ? [sumLng / count, sumLat / count] : [0, 0];
}

// textContent keeps API names and units as text, including accents and symbols.
// Animações do tooltip são canceladas quando o território muda.
function fillTooltipContent(
  el: HTMLElement,
  properties: MapFeatureProperties,
  collection: MapFeatureCollection,
  weather?: WeatherCity,
  interpolated?: { color: string; temperatureC: number },
) {
  const cleanups: Array<() => void> = [];
  el.replaceChildren();
  const add = (className: string, text: string, mode?: RevealMode) => {
    const line = document.createElement('span');
    line.className = className;
    if (mode) cleanups.push(revealText(line, text, mode));
    else line.textContent = text;
    el.append(line);
  };
  add('tooltip-name', properties.name, 'text');
  if (properties.parentName) add('tooltip-meta', properties.parentName);
  if (weather) {
    const valEl = document.createElement('span');
    valEl.className = 'tooltip-value';
    const dot = document.createElement('span');
    dot.className = 'tooltip-thermal-dot';
    dot.style.backgroundColor = colorForTemperature(weather.temperatureC);
    valEl.append(dot);
    const textSpan = document.createElement('span');
    cleanups.push(revealText(textSpan, measurement(weather.temperatureC, ' °C'), 'number'));
    valEl.append(textSpan);
    el.append(valEl);
    add('tooltip-meta', weatherDescription(weather.weatherCode));
  } else if (interpolated) {
    const valEl = document.createElement('span');
    valEl.className = 'tooltip-value';
    const dot = document.createElement('span');
    dot.className = 'tooltip-thermal-dot';
    dot.style.backgroundColor = interpolated.color;
    valEl.append(dot);
    const textSpan = document.createElement('span');
    cleanups.push(revealText(textSpan, `~${Math.round(interpolated.temperatureC)} °C`, 'number'));
    valEl.append(textSpan);
    el.append(valEl);
    add('tooltip-meta', 'Cor aproximada da região');
  }
  if (collection.indicator) {
    const { unit, decimalPlaces } = collection.indicator;
    add(
      properties.value === null ? 'tooltip-value is-missing' : 'tooltip-value',
      formatValue(properties.value, unit, decimalPlaces),
      'number',
    );
  }
  return () => cleanups.forEach((cleanup) => cleanup());
}

function Territories({
  collection,
  onSelect,
  onHover,
  onDrillDown,
  selectedCode,
  weatherByCode,
}: Props) {
  const map = useMap();
  const layerRef = useRef<LeafletGeoJSON>(null);
  const selectionHaloRef = useRef<LeafletGeoJSON>(null);
  const selectionOutlineRef = useRef<LeafletGeoJSON>(null);
  const hoveredCode = useRef<string | null>(null);
  const municipal = collection.scope.level === 'municipality';
  const canDrillDown = collection.scope.level === 'state' && Boolean(onDrillDown);
  const isClimate = !collection.indicator?.key;
  const featuresByCode = useMemo(
    () => new Map(collection.features.map((feature) => [feature.properties.ibgeCode, feature])),
    [collection.features],
  );
  const selectedFeature = useMemo(
    () => collection.features.find((feature) => feature.properties.ibgeCode === selectedCode),
    [collection, selectedCode],
  );

  // Centróides aproximados de cada polígono municipal para cálculo de vizinhança espacial rápida
  const featureCenters = useMemo(() => {
    const centers = new Map<string, [number, number]>();
    if (municipal && isClimate) {
      for (const feature of collection.features) {
        centers.set(feature.properties.ibgeCode, computeFeatureCenter(feature));
      }
    }
    return centers;
  }, [collection.features, municipal, isClimate]);

  // Cidades com medição meteorológica real na visão atual
  const measuredCities = useMemo(() => {
    if (!municipal || !isClimate || !weatherByCode || weatherByCode.size === 0) {
      return [];
    }
    const list: Array<{ id: string; lat: number; lng: number; temp: number; color: string }> = [];
    for (const city of weatherByCode.values()) {
      if (
        city.temperatureC !== null &&
        city.temperatureC !== undefined &&
        typeof city.latitude === 'number' &&
        typeof city.longitude === 'number'
      ) {
        list.push({
          id: city.id,
          lat: city.latitude,
          lng: city.longitude,
          temp: city.temperatureC,
          color: colorForTemperature(city.temperatureC),
        });
      }
    }
    return list;
  }, [municipal, isClimate, weatherByCode]);

  // Interpolação espacial (Nearest-Neighbor) para municípios sem dados diretos
  // Agrupa em 4 etapas (ondas) progressivas a partir da distância até o ponto medido mais próximo
  const interpolatedWeather = useMemo(() => {
    const first = measuredCities[0];
    if (!first) {
      return new Map<string, { color: string; temperatureC: number; stage: number }>();
    }

    const unmeasured: Array<{ code: string; color: string; temperatureC: number; distSq: number }> = [];

    for (const feature of collection.features) {
      const code = feature.properties.ibgeCode;
      if (weatherByCode?.has(code)) continue;

      const center = featureCenters.get(code);
      if (!center) continue;
      const [fLng, fLat] = center;

      let nearest = first;
      let minDistSq = Infinity;

      for (const m of measuredCities) {
        const dLat = fLat - m.lat;
        const dLng = fLng - m.lng;
        const distSq = dLat * dLat + dLng * dLng;
        if (distSq < minDistSq) {
          minDistSq = distSq;
          nearest = m;
        }
      }

      unmeasured.push({
        code,
        color: nearest.color,
        temperatureC: nearest.temp,
        distSq: minDistSq,
      });
    }

    unmeasured.sort((a, b) => a.distSq - b.distSq);
    const total = unmeasured.length;
    const result = new Map<string, { color: string; temperatureC: number; stage: number }>();

    unmeasured.forEach((item, index) => {
      const ratio = total > 0 ? index / total : 0;
      const stage = ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4;
      result.set(item.code, {
        color: item.color,
        temperatureC: item.temperatureC,
        stage,
      });
    });

    return result;
  }, [measuredCities, collection.features, featureCenters, weatherByCode]);

  // Preenchimento gradual das cidades: após os pontos com informação carregarem,
  // expande a cor em ondas até colorir 100% do estado
  const [gradualStage, setGradualStage] = useState(0);
  const hasMeasuredCities = measuredCities.length > 0;

  useEffect(() => {
    if (!municipal || !isClimate || !hasMeasuredCities) {
      setGradualStage(0);
      return;
    }

    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setGradualStage(4);
      return;
    }

    const timers: Array<ReturnType<typeof setTimeout>> = [];
    timers.push(setTimeout(() => setGradualStage(1), 220));
    timers.push(setTimeout(() => setGradualStage(2), 440));
    timers.push(setTimeout(() => setGradualStage(3), 660));
    timers.push(setTimeout(() => setGradualStage(4), 880));

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [municipal, isClimate, collection.scope.parent, hasMeasuredCities]);

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
      const { dx, dy } = offsetRef.current;
      // translate3d (não top/left) para não disparar layout a cada frame.
      const size = map.getSize();
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
    (feature?: TerritoryFeature): PathOptions => {
      // React Leaflet retains the original GeoJSON data. Read the latest
      // values while keeping the same SVG paths for a continuous color change.
      const properties = feature && featuresByCode.get(feature.properties.ibgeCode)?.properties;
      const hovered =
        properties?.ibgeCode === hoveredCode.current && properties?.ibgeCode !== selectedCode;

      if (isClimate) {
        const weather = properties ? weatherByCode?.get(properties.ibgeCode) : undefined;
        const hasDirectTemp = weather?.temperatureC !== null && weather?.temperatureC !== undefined;
        const interp = properties ? interpolatedWeather.get(properties.ibgeCode) : undefined;
        const isInterpFilled = Boolean(interp && interp.stage <= gradualStage);

        const hasColor = hasDirectTemp || isInterpFilled;
        const fillColor = hasDirectTemp
          ? colorForTemperature(weather.temperatureC)
          : isInterpFilled && interp
            ? interp.color
            : '#f1f5f9';

        const fillOpacity = hasColor ? (hovered ? 0.85 : 0.68) : hovered ? 0.35 : 0.18;
        return {
          color: hovered ? HOVER_COLOR : '#ffffff',
          weight: hovered ? (municipal ? 1.4 : 1.6) : municipal ? 0.5 : 0.85,
          opacity: hovered ? 0.95 : municipal ? 0.7 : 0.85,
          fillOpacity,
          fillColor,
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
      gradualStage,
      interpolatedWeather,
      isClimate,
      municipal,
      selectedCode,
      weatherByCode,
    ],
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
      const weather = weatherByCode?.get(properties.ibgeCode);
      const interp = interpolatedWeather.get(properties.ibgeCode);
      const isInterpFilled = Boolean(interp && interp.stage <= gradualStage);
      const content = JSON.stringify([
        properties.name,
        properties.parentName,
        properties.value,
        collection.indicator,
        weather?.temperatureC,
        weather?.weatherCode,
        isInterpFilled ? interp?.temperatureC : null,
      ]);
      if (
        activeTooltipCodeRef.current !== properties.ibgeCode ||
        activeTooltipContentRef.current !== content
      ) {
        tooltipCleanupRef.current?.();
        tooltipCleanupRef.current = fillTooltipContent(
          el,
          properties,
          collection,
          weather,
          isInterpFilled ? interp : undefined,
        );
        activeTooltipContentRef.current = content;
        // Decide o lado uma vez por território, não a cada frame: não vale o
        // custo de medir o layout do card a cada pixel que o mouse anda.
        const size = map.getSize();
        const anchor = fixedPoint ?? pointerRef.current;
        tooltipSizeRef.current = { width: el.offsetWidth, height: el.offsetHeight };
        offsetRef.current = {
          dx: anchor && anchor.x + el.offsetWidth + 16 > size.x ? -el.offsetWidth - 16 : 16,
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
      const isClimate = !collection.indicator?.key;
      const weather = weatherByCode?.get(properties.ibgeCode);
      const hasDirectTemp = weather?.temperatureC !== null && weather?.temperatureC !== undefined;
      const interp = interpolatedWeather.get(properties.ibgeCode);
      const isInterpFilled = Boolean(interp && interp.stage <= gradualStage);
      const hasColor = hasDirectTemp || isInterpFilled;
      const hoverStyle = isClimate
        ? {
            color: HOVER_COLOR,
            weight: municipal ? 1.4 : 1.6,
            opacity: 0.95,
            fillOpacity: hasColor ? 0.85 : 0.35,
          }
        : { color: HOVER_COLOR, weight: municipal ? 1.2 : 1.5, opacity: 0.9 };
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
      const enter = (event: LeafletMouseEvent) => {
        pointerRef.current = { x: event.containerPoint.x, y: event.containerPoint.y };
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
        else if (municipal && layer instanceof Polygon) {
          onSelect(properties.ibgeCode);
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
        // Territórios são sempre Polygon/MultiPolygon (nunca Marker/linha) —
        // é o mesmo pressuposto já usado acima para reprojetar a geometria.
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
      element?.setAttribute('aria-pressed', String(selected));
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
      // Do not reorder the interactive SVG on hover: it can cancel the click.
      layer.on({ mouseover: enter, mouseout: leave, click, dblclick: drill });
      cleanups.push(() => {
        layer.off({ mouseover: enter, mouseout: leave, click, dblclick: drill });
        element?.removeEventListener('focus', focus);
        element?.removeEventListener('blur', leave);
        element?.removeEventListener('keydown', keydown as EventListener);
      });
    });
    // Atualiza também o local já sob o cursor quando seu lote chega ou o contexto muda.
    const activeCode = activeTooltipCodeRef.current;
    const activeProperties = activeCode ? featuresByCode.get(activeCode)?.properties : undefined;
    if (activeProperties && hideFrameRef.current === null) {
      showTooltipFor(activeProperties, fixedAnchorRef.current ?? undefined);
    }
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [
    collection,
    weatherByCode,
    featuresByCode,
    onHover,
    onSelect,
    onDrillDown,
    canDrillDown,
    selectedCode,
    style,
    municipal,
    map,
    gradualStage,
    interpolatedWeather,
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
