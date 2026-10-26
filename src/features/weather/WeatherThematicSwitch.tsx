import { useMemo } from 'react';
import type { WeatherCurrentResponse } from '@/api/types';
import { LayerMetadata } from '@/components/LayerMetadata';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StatusBadge } from '@/components/StatusBadge';
import { formatHumidity, humidityLevel } from '@/features/humidity/humidityScale';

export interface WeatherThematicSwitchProps {
  showClimate?: boolean;
  onToggleClimate?: (show: boolean) => void;
  minTemperature?: number;
  maxTemperature?: number;
  showRainfall?: boolean;
  onToggleRainfall?: (show: boolean) => void;
  maxRainfall?: number;
  showHumidity?: boolean;
  onToggleHumidity?: (show: boolean) => void;
  minHumidity?: number;
  loading?: boolean;
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
  showHumidity,
  onToggleHumidity,
  minHumidity,
  loading = false,
  current,
  error,
  scopeName,
}: WeatherThematicSwitchProps) {
  const calculatedRange = useMemo(() => {
    if (
      minTemperature != null &&
      maxTemperature != null &&
      Number.isFinite(minTemperature) &&
      Number.isFinite(maxTemperature)
    ) {
      return { min: minTemperature, max: maxTemperature };
    }
    const temps = (current?.cities ?? [])
      .map((city) => city.temperatureC)
      .filter(
        (temperature): temperature is number => temperature != null && Number.isFinite(temperature),
      );
    return temps.length ? { min: Math.min(...temps), max: Math.max(...temps) } : null;
  }, [minTemperature, maxTemperature, current?.cities]);
  const layers = [
    { value: 'climate', label: 'Temperatura', toggle: onToggleClimate },
    { value: 'rainfall', label: 'Chuva', toggle: onToggleRainfall },
    { value: 'humidity', label: 'Umidade', toggle: onToggleHumidity },
  ].filter((layer) => layer.toggle);
  const active = showClimate
    ? 'climate'
    : showRainfall
      ? 'rainfall'
      : showHumidity
        ? 'humidity'
        : null;
  const sourceUnavailable = error != null || current?.status === 'unavailable';
  const missingLabel = sourceUnavailable ? 'Indisponível' : loading ? 'Carregando…' : 'Sem dados';
  const missingTone = sourceUnavailable ? 'error' : 'neutral';
  const rainAvailable = maxRainfall != null && Number.isFinite(maxRainfall);
  const humidityAvailable = minHumidity != null && Number.isFinite(minHumidity);
  const stale = current?.status === 'stale' || sourceUnavailable;

  return (
    <div className="weather-thematic-selector">
      <SegmentedControl
        label="Visualização temática do mapa"
        options={layers}
        value={active}
        allowDeselect
        onChange={(value) => {
          const layer = layers.find((item) => item.value === (value ?? active));
          layer?.toggle?.(value !== null);
        }}
      />
      {showClimate && (
        <LayerMetadata
          sources={[{ label: 'Open-Meteo', description: 'Condições meteorológicas atuais.' }]}
          unit="°C"
        >
          <StatusBadge tone={calculatedRange ? (stale ? 'warning' : 'climate') : missingTone}>
            {calculatedRange
              ? `${
                  Math.round(calculatedRange.min) === Math.round(calculatedRange.max)
                    ? Math.round(calculatedRange.min)
                    : `${Math.round(calculatedRange.min)} - ${Math.round(calculatedRange.max)}`
                }°C · ${scopeName ?? 'Brasil'}${stale ? ' · anterior' : ''}`
              : missingLabel}
          </StatusBadge>
        </LayerMetadata>
      )}
      {showRainfall && (
        <LayerMetadata
          sources={[{ label: 'Open-Meteo', description: 'Chuva acumulada nas últimas 48 horas.' }]}
          unit="mm · 48h"
        >
          <StatusBadge tone={rainAvailable ? (stale ? 'warning' : 'rain') : missingTone}>
            {rainAvailable
              ? `Máx: ${maxRainfall.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mm${stale ? ' · anterior' : ''}`
              : missingLabel}
          </StatusBadge>
        </LayerMetadata>
      )}
      {showHumidity && (
        <LayerMetadata
          sources={[{ label: 'Open-Meteo', description: 'Umidade relativa do ar agora, a 2 m.' }]}
          unit="% · agora"
        >
          <StatusBadge
            tone={
              humidityAvailable
                ? stale
                  ? 'warning'
                  : humidityLevel(minHumidity)
                    ? 'humidity'
                    : 'climate'
                : missingTone
            }
          >
            {humidityAvailable
              ? `Mín: ${formatHumidity(minHumidity)} · ${scopeName ?? 'Brasil'}${stale ? ' · anterior' : ''}`
              : missingLabel}
          </StatusBadge>
        </LayerMetadata>
      )}
    </div>
  );
}
