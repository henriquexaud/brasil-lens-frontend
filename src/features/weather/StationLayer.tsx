/**
 * Marcadores de estação — um ponto por estação, cor por variável.
 *
 * Diferente da coroplética, não há `classification` (quantil) aqui: cada
 * estação é um valor contínuo, então a cor vem de `interpolatePalette` sobre
 * a família certa (ver `docs/COLOR_SYSTEM.md`) — estações automáticas do
 * INMET por temperatura, pluviômetros por chuva acumulada, porque é
 * exatamente a variável que cada rede mede. Sem coroplética, sem `scope`,
 * sem drill-down: uma estação não pertence a um território.
 */
import { CircleMarker, Popup } from 'react-leaflet';

import type { WeatherStationCollection, WeatherStationFeature } from '@/api/types';
import { ScrambleText } from '@/components/ScrambleText';
import { interpolatePalette, PALETTES } from '@/features/map/colors';
import { formatRelativeTime } from '@/lib/format';

/** Faixa útil para o Brasil — fora dela a cor só satura na ponta. */
const TEMPERATURE_RANGE_C: [number, number] = [10, 38];
/** Chuva na última leitura, não acumulado diário — a maioria das leituras é 0. */
const PRECIPITATION_RANGE_MM: [number, number] = [0, 25];
/** Sem nenhuma variável colorível ainda (estação nova, leitura incompleta). */
const NO_DATA_COLOR = '#9aa5a9';

function normalize(value: number, [min, max]: [number, number]): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

function colorFor(properties: WeatherStationFeature['properties']): string {
  const { stationType, temperatureC, precipitationMm } = properties;
  if (stationType === 'automatic_weather' && temperatureC !== null) {
    return interpolatePalette(PALETTES.temperature, normalize(temperatureC, TEMPERATURE_RANGE_C));
  }
  if (precipitationMm !== null) {
    return interpolatePalette(PALETTES.rain, normalize(precipitationMm, PRECIPITATION_RANGE_MM));
  }
  return NO_DATA_COLOR;
}

function formatMeasurement(value: number | null, unit: string): string {
  return value === null ? 'sem leitura' : `${value.toLocaleString('pt-BR')} ${unit}`;
}

interface Props {
  collection: WeatherStationCollection | undefined;
}

export function StationLayer({ collection }: Props) {
  if (!collection) return null;

  return (
    <>
      {collection.features.map((feature) => {
        const [longitude = 0, latitude = 0] = feature.geometry.coordinates;
        const { properties } = feature;
        return (
          <CircleMarker
            key={feature.id}
            center={[latitude, longitude]}
            radius={6}
            pathOptions={{
              color: '#ffffff',
              weight: 1.5,
              fillColor: colorFor(properties),
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <ScrambleText as="strong" text={properties.name} />
              <div>{properties.stateAbbreviation ?? ''}</div>
              <div>Temperatura: {formatMeasurement(properties.temperatureC, '°C')}</div>
              <div>Umidade: {formatMeasurement(properties.humidityPct, '%')}</div>
              <div>Pressão: {formatMeasurement(properties.pressureHpa, 'hPa')}</div>
              <div>Chuva: {formatMeasurement(properties.precipitationMm, 'mm')}</div>
              <div>Atualizado {formatRelativeTime(properties.observedAt)}</div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
