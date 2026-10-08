import type { FireMunicipality, WeatherCity } from '@/api/types';
import { densityColor, type FireMode } from '@/features/fire/fireDensity';
import { rainAmount, rainColor } from '@/features/rainfall/rainScale';
import { colorForTemperature } from './colors';
import { mosaicFill } from './dataFill';

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
  let measured = false;
  if (fireMode) {
    measured = fire?.density != null;
    color = measured ? densityColor(fire?.density) : 'var(--map-fire-neutral, #edf0ee)';
    opacity = measured ? (fireMode === 'points' ? 0.45 : 0.68) : 0.35;
  } else if (rainMode) {
    const amount = weather ? rainAmount(weather) : 0;
    measured = Boolean(
      weather &&
        (weather.precipitation48hMm != null ||
          weather.precipitationSumMm != null ||
          weather.precipitationMm != null),
    );
    color = measured ? rainColor(amount) : color;
    opacity = amount > 0 ? 0.72 : 0.12;
  } else if (climateMode) {
    const temperature = weather?.temperatureC;
    measured = temperature != null;
    color = temperature != null ? colorForTemperature(temperature) : color;
    opacity = measured ? 0.68 : 0.18;
  }
  return complete ? mosaicFill(color, opacity, measured) : color;
}
