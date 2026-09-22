import { useMemo } from 'react';
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

  return (
    <div className="weather-thematic-selector">
      <p className="field-label sr-only">Modo de visualização do mapa</p>
      <div
        className="weather-segmented-control"
        role="tablist"
        aria-label="Visualização temática do mapa"
      >
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
            Focos
          </button>
        )}
      </div>

      {/* Informações contextuais do modo ativo */}
      {showClimate && (
        <div className="weather-segment-info">
          <span className="weather-layer-source">Open-Meteo</span>
          {error != null && !calculatedRange ? (
            <span className="weather-layer-badge badge-error">Indisponível</span>
          ) : (
            <span className="weather-layer-badge badge-climate">
              {calculatedRange
                ? (Math.round(calculatedRange.min) || 0) ===
                  (Math.round(calculatedRange.max) || 0)
                  ? `${Math.round(calculatedRange.min) || 0}°C · ${scopeName ?? 'Brasil'}`
                  : `${Math.round(calculatedRange.min) || 0} - ${Math.round(calculatedRange.max) || 0}°C · ${scopeName ?? 'Brasil'}`
                : 'Ativo'}
            </span>
          )}
        </div>
      )}

      {showRainfall && (
        <div className="weather-segment-info">
          <span className="weather-layer-source">Open-Meteo / 24h</span>
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
            className={`weather-layer-badge ${
              fireHotspotsError ? 'badge-error' : 'badge-fire'
            }`}
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

