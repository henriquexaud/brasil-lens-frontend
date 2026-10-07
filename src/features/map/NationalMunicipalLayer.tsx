import { latLng, svgOverlay, type Map as LeafletMap, type SVGOverlay } from 'leaflet';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pane, useMap } from 'react-leaflet';
import type { FireMunicipality, MapFeature, WeatherCity } from '@/api/types';
import type { FireMode } from '@/features/fire/fireDensity';
import { scheduleIdle } from '@/lib/idle';
import { mosaicColor } from './mosaicColor';
import type { NationalMesh } from './useNationalMunicipalData';

export interface NationalMosaic {
  mesh: NationalMesh;
  weatherByCode?: Map<string, WeatherCity>;
  fireByCode?: Map<string, FireMunicipality>;
}

interface Props {
  data?: NationalMosaic;
  visible: boolean;
  paused: boolean;
  fireMode?: FireMode;
  rainMode?: boolean;
  climateMode?: boolean;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const PANE = 'national-municipalities';

// One projected overlay lets Leaflet move the national mosaic without reprojecting
// thousands of municipal layers on every zoom; equal colors share paths per state.
function projectedPath(feature: MapFeature, map: Pick<LeafletMap, 'project'>): string {
  return feature.geometry.coordinates
    .map((polygon) =>
      polygon
        .map(
          (ring) =>
            ring
              .map(([longitude, latitude], index) => {
                const point = map.project(latLng(latitude!, longitude!), 0);
                return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(5)} ${point.y.toFixed(5)}`;
              })
              .join('') + 'Z',
        )
        .join(''),
    )
    .join('');
}

function addPath(svg: SVGElement, d: string, color: string, outline = false) {
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', outline ? 'none' : color);
  path.setAttribute('fill-rule', 'evenodd');
  path.setAttribute('stroke', color);
  path.setAttribute('stroke-width', outline ? '0.85' : '0.5');
  path.setAttribute('stroke-opacity', outline ? '0.85' : '1');
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.appendChild(path);
}

interface Build {
  svg: SVGSVGElement;
  overlay: SVGOverlay;
  state: number;
  feature: number;
  colors: Map<string, string[]>;
  complete: boolean;
}

export function NationalMunicipalLayer({
  data,
  visible,
  paused,
  fireMode,
  rainMode,
  climateMode,
}: Props) {
  const map = useMap();
  const paths = useRef(new WeakMap<MapFeature, string>());
  const displayed = useRef<{ overlay: SVGOverlay; mode: string }>();
  const prepared = useRef(new Map<string, { data: NationalMosaic; build: Build }>());
  const [build, setBuild] = useState<Build>();
  const mode = fireMode
    ? `fire:${fireMode}`
    : rainMode
      ? 'rainfall'
      : climateMode
        ? 'climate'
        : 'none';

  useLayoutEffect(() => {
    if (!visible || displayed.current?.mode !== mode) {
      displayed.current?.overlay.remove();
      displayed.current = undefined;
    }
  }, [visible, mode]);

  useLayoutEffect(() => {
    const bbox = data?.mesh.states.bbox;
    if (!visible || !data || !bbox) {
      setBuild(undefined);
      return;
    }
    const cached = prepared.current.get(mode);
    if (
      cached &&
      cached.data.mesh === data.mesh &&
      cached.data.weatherByCode === data.weatherByCode &&
      cached.data.fireByCode === data.fireByCode
    ) {
      displayed.current?.overlay.remove();
      cached.build.overlay.addTo(map);
      displayed.current = { overlay: cached.build.overlay, mode };
      setBuild(cached.build);
      return;
    }
    const [west, south, east, north] = bbox;
    const topLeft = map.project(latLng(north, west), 0);
    const bottomRight = map.project(latLng(south, east), 0);
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute(
      'viewBox',
      `${topLeft.x} ${topLeft.y} ${bottomRight.x - topLeft.x} ${bottomRight.y - topLeft.y}`,
    );
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('data-national-mosaic', mode);
    svg.style.opacity = '0';
    const overlay = svgOverlay(
      svg,
      [
        [south, west],
        [north, east],
      ],
      { pane: PANE, interactive: false },
    );
    overlay.addTo(map);
    const next: Build = { svg, overlay, state: 0, feature: 0, colors: new Map(), complete: false };
    setBuild(next);
    return () => {
      if (!next.complete) overlay.remove();
    };
  }, [map, data, visible, mode]);

  useEffect(() => {
    if (!build || build.complete || !data || !visible || paused) return;
    let stopped = false;
    let moving = false;
    let cancelIdle: (() => void) | undefined;
    const pathFor = (feature: MapFeature) => {
      let path = paths.current.get(feature);
      if (!path) {
        path = projectedPath(feature, map);
        paths.current.set(feature, path);
      }
      return path;
    };
    const schedule = () => {
      if (!stopped && !moving) cancelIdle = scheduleIdle(step, 0);
    };
    const step = () => {
      if (stopped || moving) return;
      const start = performance.now();
      let processed = 0;
      while (
        build.state < data.mesh.municipalities.length &&
        processed < 32 &&
        performance.now() - start < 4
      ) {
        const collection = data.mesh.municipalities[build.state]!;
        const feature = collection.features[build.feature]!;
        const code = feature.properties.ibgeCode;
        const color = mosaicColor({
          weather: data.weatherByCode?.get(code),
          fire: data.fireByCode?.get(code),
          fireMode,
          rainMode,
          climateMode,
        });
        const group = build.colors.get(color) ?? [];
        group.push(pathFor(feature));
        build.colors.set(color, group);
        build.feature += 1;
        processed += 1;
        if (build.feature === collection.features.length) {
          for (const [fill, parts] of build.colors) addPath(build.svg, parts.join(''), fill);
          build.colors.clear();
          build.state += 1;
          build.feature = 0;
        }
      }
      if (build.state === data.mesh.municipalities.length) {
        for (const feature of data.mesh.states.features)
          addPath(build.svg, pathFor(feature), 'var(--map-boundary, #ffffff)', true);
        // Publish only after both the data and every hidden path are ready.
        build.svg.style.opacity = '1';
        displayed.current?.overlay.remove();
        displayed.current = { overlay: build.overlay, mode };
        build.complete = true;
        prepared.current.set(mode, { data, build });
      } else schedule();
    };
    const pause = () => {
      moving = true;
      cancelIdle?.();
    };
    const resume = () => {
      moving = false;
      cancelIdle?.();
      schedule();
    };
    map.on('movestart zoomstart', pause);
    map.on('moveend zoomend', resume);
    schedule();
    return () => {
      stopped = true;
      cancelIdle?.();
      map.off('movestart zoomstart', pause);
      map.off('moveend zoomend', resume);
    };
  }, [build, data, map, visible, paused, mode, fireMode, rainMode, climateMode]);

  useEffect(
    () => () => {
      displayed.current?.overlay.remove();
      for (const cached of prepared.current.values()) cached.build.overlay.remove();
    },
    [],
  );
  return <Pane name={PANE} style={{ zIndex: 420, pointerEvents: 'none' }} />;
}
