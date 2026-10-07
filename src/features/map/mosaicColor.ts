import type { FireMunicipality, WeatherCity } from '@/api/types';
import { densityColor, type FireMode } from '@/features/fire/fireDensity';
import { rainAmount, rainColor } from '@/features/rainfall/rainScale';
import { colorForTemperature } from './colors';

export function mosaicColor({
  weather,
  fire,
  fireMode,
  rainMode,
  climateMode,
  complete = true,
}: {
  weather?: WeatherCity;
  fire?: FireMunicipality;
  fireMode?: FireMode;
  rainMode?: boolean;
  climateMode?: boolean;
  complete?: boolean;
}) {
  let color = 'var(--map-neutral, #f1f5f9)';
  let opacity = 0.08;
  if (fireMode) {
    color =
      fire?.density != null && fire.density > 0
        ? densityColor(fire.density)
        : 'var(--map-fire-neutral, #edf0ee)';
    opacity = fire?.density != null ? (fireMode === 'points' ? 0.45 : 0.68) : 0.35;
  } else if (rainMode) {
    const amount = weather ? rainAmount(weather) : 0;
    const hasReading =
      weather &&
      (weather.precipitation48hMm != null ||
        weather.precipitationSumMm != null ||
        weather.precipitationMm != null);
    color = hasReading ? rainColor(amount) : color;
    opacity = amount > 0 ? 0.72 : 0.12;
  } else if (climateMode) {
    const temperature = weather?.temperatureC;
    color = temperature != null ? colorForTemperature(temperature) : color;
    opacity = temperature != null ? 0.68 : 0.18;
  }
  return complete
    ? `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, var(--map-land, #f4f5f5))`
    : color;
}
