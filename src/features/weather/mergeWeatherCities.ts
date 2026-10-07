import type { WeatherCity } from '@/api/types';

export function mergeWeatherCities(target: Map<string, WeatherCity>, cities: WeatherCity[]) {
  for (const city of cities) {
    const known = target.get(city.id);
    if (known) {
      const knownAt = Date.parse(known.observedAt);
      const incomingAt = Date.parse(city.observedAt);
      if (knownAt > incomingAt || (knownAt === incomingAt && !known.isInferred && city.isInferred))
        continue;
    }
    target.set(city.id, city);
  }
}
