import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { FireHotspotCollection, WeatherCurrentResponse } from '@/api/types';

export interface WeatherThematicSwitchProps {
  showClimate?: boolean;
  onToggleClimate?: (show: boolean) => void;
  minTemperature?: number;
  maxTemperature?: number;
  showRainfall?: boolean;
  onToggleRainfall?: (show: boolean) => void;
  maxRainfall?: number;
  showFireHotspots?: boolean;
  onToggleFireHotspots?: (show: boolean) => void;
  fireHotspotsLoading?: boolean;
  fireHotspots?: FireHotspotCollection;
  fireHotspotsError?: boolean;
  current?: WeatherCurrentResponse;
  error?: unknown;
  scopeName?: string;
}

export function WeatherThematicSwitch({
  showClimate,
  onToggleClimate,
  minTemperature,
  maxTemperature,
  showRainfall,
  onToggleRainfall,
  maxRainfall,
  showFireHotspots,
  onToggleFireHotspots,
  fireHotspotsLoading,
  fireHotspots,
  fireHotspotsError,
  current,
  error,
  scopeName,
}: WeatherThematicSwitchProps) {
  const controlRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const springRef = useRef({
    x: 0,
    velocity: 0,
    target: 0,
    frame: null as number | null,
    lastTime: 0,
    ready: false,
  });
  const calculatedRange = useMemo(() => {
    if (minTemperature != null && maxTemperature != null) {
      return { min: minTemperature, max: maxTemperature };
    }
    const temps = (current?.cities ?? [])
      .map((c) => c.temperatureC)
      .filter((t): t is number => t != null && Number.isFinite(t));
    if (!temps.length) return null;
    return {
      min: Math.min(...temps),
      max: Math.max(...temps),
    };
  }, [minTemperature, maxTemperature, current?.cities]);
  const available = [
    Boolean(onToggleClimate),
    Boolean(onToggleRainfall),
    Boolean(onToggleFireHotspots),
  ];
  const active = showClimate ? 0 : showRainfall ? 1 : showFireHotspots ? 2 : -1;
  const activeIndex = active < 0 ? -1 : available.slice(0, active).filter(Boolean).length;
  const segmentCount = available.filter(Boolean).length;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const indicatorStyle: CSSProperties = {
    width: `calc((100% - ${6 + (segmentCount - 1) * 3}px) / ${segmentCount})`,
    transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 3}px))`,
  };

  useLayoutEffect(() => {
    const control = controlRef.current;
    const indicator = indicatorRef.current;
    const button =
      control?.querySelectorAll<HTMLButtonElement>('.weather-segment-btn')[activeIndex];
    if (!indicator || !button || button.offsetWidth === 0) return;

    const spring = springRef.current;
    if (spring.frame !== null) cancelAnimationFrame(spring.frame);
    spring.frame = null;
    spring.target = button.offsetLeft;
    spring.lastTime = 0;
    indicator.style.width = `${button.offsetWidth}px`;

    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!spring.ready || reducedMotion || typeof requestAnimationFrame !== 'function') {
      spring.x = spring.target;
      spring.velocity = 0;
      spring.ready = true;
      indicator.style.transform = `translate3d(${spring.x}px, 0, 0)`;
      indicator.classList.remove('is-moving');
      return;
    }

    const tick = (time: number) => {
      const dt = spring.lastTime ? Math.min((time - spring.lastTime) / 1000, 0.032) : 1 / 60;
      spring.lastTime = time;
      // Stiff, near-critically damped spring: settles in ~0.2s without wobble, and keeps
      // its velocity when another option is selected mid-flight.
      spring.velocity += (900 * (spring.target - spring.x) - 54 * spring.velocity) * dt;
      spring.x += spring.velocity * dt;
      indicator.style.transform = `translate3d(${spring.x}px, 0, 0)`;
      if (Math.abs(spring.target - spring.x) < 0.3 && Math.abs(spring.velocity) < 2) {
        spring.x = spring.target;
        spring.velocity = 0;
        spring.frame = null;
        indicator.style.transform = `translate3d(${spring.x}px, 0, 0)`;
        indicator.classList.remove('is-moving');
      } else {
        spring.frame = requestAnimationFrame(tick);
      }
    };
    indicator.classList.add('is-moving');
    spring.frame = requestAnimationFrame(tick);
    return () => {
      if (spring.frame !== null) cancelAnimationFrame(spring.frame);
      spring.frame = null;
    };
  }, [activeIndex, segmentCount]);

  useEffect(() => {
    const control = controlRef.current;
    const indicator = indicatorRef.current;
    if (!control || !indicator || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const button =
        control.querySelectorAll<HTMLButtonElement>('.weather-segment-btn')[activeIndexRef.current];
      if (!button || button.offsetWidth === 0) return;
      const spring = springRef.current;
      if (spring.frame !== null) cancelAnimationFrame(spring.frame);
      spring.frame = null;
      spring.target = button.offsetLeft;
      spring.x = spring.target;
      spring.velocity = 0;
      spring.ready = true;
      indicator.style.width = `${button.offsetWidth}px`;
      indicator.style.transform = `translate3d(${spring.x}px, 0, 0)`;
      indicator.classList.remove('is-moving');
    });
    observer.observe(control);
    return () => observer.disconnect();
  }, [segmentCount]);

  return (
    <div className="weather-thematic-selector">
      <p className="field-label sr-only">Modo de visualização do mapa</p>
      <div
        ref={controlRef}
        className="weather-segmented-control"
        role="tablist"
        aria-label="Visualização temática do mapa"
      >
        <span
          ref={indicatorRef}
          className={`weather-segment-indicator ${activeIndex < 0 ? 'is-hidden' : ''}`}
          style={indicatorStyle}
          aria-hidden="true"
        />
        {onToggleClimate && (
          <button
            type="button"
            role="tab"
            aria-selected={showClimate ?? false}
            className={`weather-segment-btn ${showClimate ? 'is-active' : ''}`}
            onClick={() => onToggleClimate(!showClimate)}
          >
            Clima
          </button>
        )}
        {onToggleRainfall && (
          <button
            type="button"
            role="tab"
            aria-selected={showRainfall ?? false}
            className={`weather-segment-btn ${showRainfall ? 'is-active' : ''}`}
            onClick={() => onToggleRainfall(!showRainfall)}
          >
            Chuva
          </button>
        )}
        {onToggleFireHotspots && (
          <button
            type="button"
            role="tab"
            aria-selected={showFireHotspots ?? false}
            className={`weather-segment-btn ${showFireHotspots ? 'is-active' : ''}`}
            onClick={() => onToggleFireHotspots(!showFireHotspots)}
          >
            Fogo
          </button>
        )}
      </div>

      {}
      {showClimate && (
        <div className="weather-segment-info">
          <span className="weather-layer-source">Open-Meteo</span>
          {error != null && !calculatedRange ? (
            <span className="weather-layer-badge badge-error">Indisponível</span>
          ) : (
            <span className="weather-layer-badge badge-climate">
              {calculatedRange
                ? (Math.round(calculatedRange.min) || 0) === (Math.round(calculatedRange.max) || 0)
                  ? `${Math.round(calculatedRange.min) || 0}°C · ${scopeName ?? 'Brasil'}`
                  : `${Math.round(calculatedRange.min) || 0} - ${Math.round(calculatedRange.max) || 0}°C · ${scopeName ?? 'Brasil'}`
                : 'Ativo'}
            </span>
          )}
        </div>
      )}

      {showRainfall && (
        <div className="weather-segment-info">
          <span className="weather-layer-source">Open-Meteo / 48h</span>
          {error != null && !current ? (
            <span className="weather-layer-badge badge-error">Indisponível</span>
          ) : (
            <span className="weather-layer-badge badge-rain">
              {maxRainfall != null && maxRainfall > 0
                ? `Máx: ${maxRainfall.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mm`
                : 'Ativo'}
            </span>
          )}
        </div>
      )}

      {showFireHotspots && (
        <div className="weather-segment-info">
          <span className="weather-layer-source">INPE / Queimadas</span>
          <span
            className={`weather-layer-badge ${fireHotspotsError ? 'badge-error' : 'badge-fire'}`}
          >
            {fireHotspotsError
              ? 'Indisponível'
              : fireHotspotsLoading && !fireHotspots
                ? 'Carregando…'
                : fireHotspots
                  ? `${fireHotspots.metadata.hotspotCount.toLocaleString('pt-BR')} focos · ${scopeName ?? 'Brasil'}`
                  : 'Ativo'}
          </span>
        </div>
      )}
    </div>
  );
}
