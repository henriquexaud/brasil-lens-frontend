import type { MapFeature, WeatherCity } from '@/api/types';

/**
 * Cache de centroides por código IBGE para evitar recalcular coordenadas
 * geométricas da malha GeoJSON a cada render.
 */
const centroidCache = new Map<string, [number, number]>();

/**
 * Extrai o centroide aproximado [latitude, longitude] de um MapFeature
 * (MultiPolygon ou Polygon) a partir da média dos limites de sua geometria.
 */
export function getFeatureCentroid(feature: MapFeature): [number, number] | null {
  const code = feature.properties?.ibgeCode || feature.id;
  if (code && centroidCache.has(code)) {
    return centroidCache.get(code)!;
  }

  const geom = feature.geometry;
  if (!geom || !geom.coordinates) return null;

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  function scan(coords: unknown): void {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const [lon, lat] = coords as [number, number];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else {
      for (const item of coords) {
        scan(item);
      }
    }
  }

  scan(geom.coordinates);

  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) {
    return null;
  }

  const centroid: [number, number] = [
    Math.round(((minLat + maxLat) / 2) * 1e6) / 1e6,
    Math.round(((minLon + maxLon) / 2) * 1e6) / 1e6,
  ];
  if (code) {
    centroidCache.set(code, centroid);
  }
  return centroid;
}

/**
 * Distância equiretangular ao quadrado entre dois pontos [lat, lon].
 * Ajusta a longitude pelo cosseno da latitude média para precisão geográfica local.
 */
function geoDistanceSq(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  cosLat: number,
): number {
  const dLat = lat1 - lat2;
  const dLon = (lon1 - lon2) * cosLat;
  return dLat * dLat + dLon * dLon;
}

export interface KnownWeatherStation {
  id: string;
  name?: string;
  stateAbbreviation?: string;
  latitude: number;
  longitude: number;
  temperatureC: number;
  apparentTemperatureC?: number | null;
  humidityPct?: number | null;
  windSpeedKmh?: number | null;
  weatherCode: number | null;
  precipitationMm?: number | null;
  precipitationSumMm?: number | null;
  precipitationProbabilityPct?: number | null;
  isInferred?: boolean;
}

/**
 * Estima as condições meteorológicas de um município alvo usando
 * Inverse Distance Weighting (IDW com os k vizinhos mais próximos).
 */
export function interpolateSingleMunicipalWeather(
  target: { id: string; name: string; latitude: number; longitude: number },
  knownStations: KnownWeatherStation[],
  stateAbbreviation = '',
): WeatherCity | null {
  if (!knownStations.length) return null;

  const cosLat = Math.cos((target.latitude * Math.PI) / 180);

  // Calcula distância para todas as estações conhecidas
  const scored = knownStations
    .map((st) => ({
      station: st,
      distSq: geoDistanceSq(target.latitude, target.longitude, st.latitude, st.longitude, cosLat),
    }))
    .sort((a, b) => a.distSq - b.distSq);

  const closest = scored[0];
  if (!closest) return null;

  // Se está praticamente no mesmo ponto (< 100m)
  if (closest.distSq < 1e-6) {
    const s = closest.station;
    return {
      id: target.id,
      name: target.name,
      stateAbbreviation: stateAbbreviation || s.stateAbbreviation || '',
      latitude: target.latitude,
      longitude: target.longitude,
      timezone: 'America/Sao_Paulo',
      observedAt: new Date().toISOString(),
      temperatureC: s.temperatureC,
      apparentTemperatureC: s.apparentTemperatureC ?? s.temperatureC,
      humidityPct: s.humidityPct ?? null,
      windSpeedKmh: s.windSpeedKmh ?? null,
      precipitationMm: s.precipitationMm ?? 0,
      precipitationSumMm: s.precipitationSumMm ?? s.precipitationMm ?? 0,
      precipitationProbabilityPct: s.precipitationProbabilityPct ?? null,
      precipitationIntervalMinutes: 15,
      weatherCode: s.weatherCode ?? 0,
      forecast: [],
      isInferred: true,
    };
  }

  // Pega até 3 vizinhos mais próximos para IDW suave
  const kNearest = scored.slice(0, Math.min(3, scored.length));
  let totalWeight = 0;
  let weightedTemp = 0;
  let weightedApparent = 0;
  let weightedHumidity = 0;
  let hasHumidity = false;
  let weightedPrecipSum = 0;
  let hasPrecipSum = false;
  let weightedPrecipProb = 0;
  let hasPrecipProb = false;

  for (const item of kNearest) {
    const weight = 1 / item.distSq;
    totalWeight += weight;
    weightedTemp += item.station.temperatureC * weight;
    if (item.station.apparentTemperatureC != null) {
      weightedApparent += item.station.apparentTemperatureC * weight;
    } else {
      weightedApparent += item.station.temperatureC * weight;
    }
    if (item.station.humidityPct != null) {
      weightedHumidity += item.station.humidityPct * weight;
      hasHumidity = true;
    }
    if (item.station.precipitationSumMm != null) {
      weightedPrecipSum += item.station.precipitationSumMm * weight;
      hasPrecipSum = true;
    } else if (item.station.precipitationMm != null) {
      weightedPrecipSum += item.station.precipitationMm * weight;
      hasPrecipSum = true;
    }
    if (item.station.precipitationProbabilityPct != null) {
      weightedPrecipProb += item.station.precipitationProbabilityPct * weight;
      hasPrecipProb = true;
    }
  }

  const estimatedTemp = totalWeight > 0 ? weightedTemp / totalWeight : closest.station.temperatureC;
  const estimatedApparent =
    totalWeight > 0 ? weightedApparent / totalWeight : closest.station.apparentTemperatureC;
  const estimatedHumidity = hasHumidity && totalWeight > 0 ? weightedHumidity / totalWeight : null;
  const estimatedPrecipSum =
    hasPrecipSum && totalWeight > 0 ? Math.round((weightedPrecipSum / totalWeight) * 10) / 10 : 0;
  const estimatedPrecipProb =
    hasPrecipProb && totalWeight > 0 ? Math.round(weightedPrecipProb / totalWeight) : null;

  return {
    id: target.id,
    name: target.name,
    stateAbbreviation: stateAbbreviation || closest.station.stateAbbreviation || '',
    latitude: target.latitude,
    longitude: target.longitude,
    timezone: 'America/Sao_Paulo',
    observedAt: new Date().toISOString(),
    temperatureC: Math.round(estimatedTemp * 10) / 10,
    apparentTemperatureC: estimatedApparent != null ? Math.round(estimatedApparent * 10) / 10 : null,
    humidityPct: estimatedHumidity != null ? Math.round(estimatedHumidity) : null,
    windSpeedKmh: closest.station.windSpeedKmh ?? null,
    precipitationMm: closest.station.precipitationMm ?? 0,
    precipitationSumMm: estimatedPrecipSum,
    precipitationProbabilityPct: estimatedPrecipProb,
    precipitationIntervalMinutes: 15,
    // Código de tempo (ícone de céu) vem do vizinho mais próximo
    weatherCode: closest.station.weatherCode ?? 0,
    forecast: [],
    isInferred: true,
  };
}

/**
 * Gera um mapa de estimativas para todos os municípios não medidos de um estado,
 * a partir de uma lista de cidades conhecidas (com dados reais).
 */
export function interpolateStateWeather(
  stateFeatures: MapFeature[],
  realCities: WeatherCity[],
  stateAbbreviation = '',
): Map<string, WeatherCity> {
  const result = new Map<string, WeatherCity>();
  if (!realCities.length || !stateFeatures.length) return result;

  const realCityIds = new Set(realCities.map((c) => c.id));
  const knownStations: KnownWeatherStation[] = realCities.map((c) => ({
    id: c.id,
    name: c.name,
    stateAbbreviation: c.stateAbbreviation,
    latitude: c.latitude,
    longitude: c.longitude,
    temperatureC: c.temperatureC,
    apparentTemperatureC: c.apparentTemperatureC,
    humidityPct: c.humidityPct,
    windSpeedKmh: c.windSpeedKmh,
    precipitationMm: c.precipitationMm,
    precipitationSumMm: c.precipitationSumMm,
    precipitationProbabilityPct: c.precipitationProbabilityPct,
    weatherCode: c.weatherCode,
    isInferred: false,
  }));

  for (const feature of stateFeatures) {
    const code = feature.properties?.ibgeCode || feature.id;
    if (!code || realCityIds.has(code)) continue;

    const centroid = getFeatureCentroid(feature);
    if (!centroid) continue;

    const estimated = interpolateSingleMunicipalWeather(
      {
        id: code,
        name: feature.properties?.name || `Município ${code}`,
        latitude: centroid[0],
        longitude: centroid[1],
      },
      knownStations,
      stateAbbreviation || feature.properties?.abbreviation || '',
    );

    if (estimated) {
      result.set(code, estimated);
    }
  }

  return result;
}

/**
 * Mescla dados meteorológicos com precedência estrita:
 * 1. Dado real NUNCA é sobrescrito por estimativa.
 * 2. Dado real novo sempre substitui estimativa existente.
 * 3. Se ambos forem reais, o mais recente tem preferência.
 */
export function mergeWeatherWithPrecedence(
  base: Map<string, WeatherCity>,
  incoming: Iterable<WeatherCity> | Map<string, WeatherCity>,
): Map<string, WeatherCity> {
  const merged = new Map<string, WeatherCity>(base);
  const entries = incoming instanceof Map ? incoming.values() : incoming;

  for (const item of entries) {
    const existing = merged.get(item.id);
    if (!existing) {
      merged.set(item.id, item);
      continue;
    }

    const existingIsReal = !existing.isInferred;
    const incomingIsReal = !item.isInferred;

    if (existingIsReal && !incomingIsReal) {
      // Dado real prevalece absolutamente contra estimativa
      continue;
    }

    if (!existingIsReal && incomingIsReal) {
      // Dado real substitui a estimativa
      merged.set(item.id, item);
      continue;
    }

    // Ambos reais ou ambos estimados: atualiza
    merged.set(item.id, item);
  }

  return merged;
}
