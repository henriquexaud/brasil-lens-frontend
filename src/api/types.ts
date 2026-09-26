/**
 * Contratos da API, tipados à mão para espelhar os schemas Pydantic do backend.
 *
 * Nenhum `any`: se o backend mudar um contrato, o erro aparece na compilação e
 * não em runtime.
 */
import type { Geometry, MultiPolygon, Point } from 'geojson';

export type TerritoryLevel = 'country' | 'region' | 'state' | 'municipality';
export type GeometryLod = 'canonical' | 'overview' | 'detail';

/** [oeste, sul, leste, norte] — mesma ordem do GeoJSON. */
export type BoundingBox = [number, number, number, number];

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface TerritoryRef {
  ibgeCode: string;
  name: string;
  level: TerritoryLevel | null;
}

export interface TerritorySummary {
  ibgeCode: string;
  name: string;
  level: TerritoryLevel;
  abbreviation: string | null;
  parent: TerritoryRef | null;
}

export interface TerritoryDetail extends TerritorySummary {
  bbox: BoundingBox | null;
}

export interface MapScope {
  level: TerritoryLevel;
  parent: string | null;
  lod: GeometryLod;
  count: number;
}

export interface MapFeatureProperties {
  ibgeCode: string;
  name: string;
  level: TerritoryLevel;
  abbreviation: string | null;
  parentCode: string | null;
  parentName: string | null;
}

export interface MapFeature {
  type: 'Feature';
  id: string;
  properties: MapFeatureProperties;
  geometry: MultiPolygon;
}

export interface MapFeatureCollection {
  nextOffset?: number | null;
  type: 'FeatureCollection';
  scope: MapScope;
  /** Ausente quando não há extensão conhecida — a RFC 7946 não admite `null`. */
  bbox?: BoundingBox;
  features: MapFeature[];
  parentFeature?: MapFeature | null;
}

export interface MapQuery {
  level: TerritoryLevel;
  parent?: string | null;
  /** A API não serve a malha canônica em `/map` (ver `MapLod` no backend). */
  lod?: Exclude<GeometryLod, 'canonical'>;
}

/**
 * Município seguido para acompanhamento climático. O backend guarda só o código IBGE;
 * nome e UF chegam resolvidos na leitura (nulos se o município sumir do
 * catálogo depois de seguido).
 */
export interface FollowedMunicipality {
  municipalityCode: string;
  name: string | null;
  stateCode: string | null;
  stateName: string | null;
  stateAbbreviation: string | null;
  followedAt: string;
  notificationsEnabled: boolean;
}

export interface FollowedMunicipalityListResponse {
  municipalities: FollowedMunicipality[];
}

export interface TerritoryListResponse {
  territories: TerritorySummary[];
  pagination: Pagination;
}

/** Fonte oficial de um alerta. Nunca decida layout por isto — use `category`/`severityLevel`. */
export type WeatherAlertProvider = 'inmet' | 'cemaden' | (string & {});

/** Classificação comum entre fontes, calculada no backend (`services/weather.py`). */
export type WeatherAlertCategory = 'meteorological' | 'geo_hydrological';

/** Tier visual comum entre fontes — o que decide cor/proeminência no mapa e na lista. */
export type WeatherAlertSeverityLevel =
  'moderate' | 'high' | 'very_high' | 'extreme' | 'potential' | 'danger' | 'other';

export interface WeatherAlertProperties {
  provider: WeatherAlertProvider;
  category: WeatherAlertCategory;
  event: string;
  /** Texto de severidade verbatim da fonte (vocabulário varia por fonte; ver `severityLevel`). */
  severity: string;
  severityLevel: WeatherAlertSeverityLevel;
  /** Cor oficial da fonte (ex.: INMET, CEMADEN) — exibida como está, nunca trocada. */
  color: string | null;
  /** Frase livre opcional além de `event` (ex.: município do CEMADEN). Nula quando a fonte não tem. */
  description: string | null;
  onset: string;
  expires: string;
  affectedIbgeCodes: string[];
  risks: string[];
  instructions: string[];
}

export interface WeatherAlertFeature {
  type: 'Feature';
  id: string;
  properties: WeatherAlertProperties;
  geometry: MultiPolygon;
}

export interface WeatherAlertCollection {
  type: 'FeatureCollection';
  features: WeatherAlertFeature[];
}

export type WeatherSourceStatusValue = 'ok' | 'stale' | 'unavailable';

export interface WeatherForecastDay {
  date: string;
  weatherCode: number | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  precipitationProbabilityPct: number | null;
  precipitationSumMm?: number | null;
}

export interface WeatherCity {
  id: string;
  name: string;
  stateAbbreviation: string;
  latitude: number;
  longitude: number;
  timezone: string;
  observedAt: string;
  temperatureC: number;
  apparentTemperatureC: number | null;
  humidityPct: number | null;
  windSpeedKmh: number | null;
  precipitationMm: number | null;
  precipitationSumMm?: number | null;
  precipitationProbabilityPct?: number | null;
  precipitationIntervalMinutes: number;
  /** Acumulado das últimas 24 h — o valor que o mapa de chuva pinta. */
  precipitation24hMm?: number | null;
  /** Chovendo no intervalo mais recente (precipitação ou código de chuva). */
  rainingNow?: boolean;
  /** Mapa do Brasil: pontos medidos na média do estado e quantos têm chuva agora. */
  samplePoints?: number | null;
  rainingPoints?: number | null;
  weatherCode: number | null;
  forecast: WeatherForecastDay[];
  /** Indica se a leitura é uma estimativa por interpolação espacial ou dado real medido */
  isInferred?: boolean;
}

export interface WeatherSummary {
  minTemperature?: number | null;
  maxTemperature?: number | null;
  maxRainfall?: number | null;
  hottest: WeatherCity[];
  coldest: WeatherCity[];
  rankedRainfall: WeatherCity[];
}

export interface WeatherCurrentResponse {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  status: WeatherSourceStatusValue;
  cities: WeatherCity[];
  summary?: WeatherSummary | null;
  nextOffset: number | null;
}

export type HydroCategory = 'river' | 'water_body';

export interface HydroFeatureProperties {
  id: string;
  name: string;
  category: HydroCategory;
  drainageAreaKm2: number | null;
  areaKm2?: number | null;
  dominion: string | null;
  management: string | null;
  bodyType: string | null;
  segmentCount?: number | null;
}

export interface HydroFeature {
  type: 'Feature';
  id: string;
  properties: HydroFeatureProperties;
  geometry: Geometry;
}

export interface HydroMetadata {
  status?: 'ok' | 'partial';
  level: string;
  parentCode: string | null;
  riverCount: number;
  waterBodyCount: number;
  source: string;
}

export interface HydroFeatureCollection {
  type: 'FeatureCollection';
  metadata: HydroMetadata;
  bbox?: BoundingBox;
  features: HydroFeature[];
}

export interface HydroQuery {
  level: 'country' | 'state' | 'municipality';
  parent?: string | null;
  includeWaterBodies?: boolean;
  includeRivers?: boolean;
  zoom?: number;
  bbox?: string;
}

export interface FireHotspotProperties {
  id: string;
  detectedAt: string;
  satellite: string;
  state: string | null;
  municipality: string | null;
  municipalityCode: string | null;
  biome: string | null;
  daysWithoutRain: number | null;
  precipitationMm: number | null;
  fireRisk: number | null;
  frp: number | null;
}

export interface FireHotspotFeature {
  type: 'Feature';
  id: string;
  properties: FireHotspotProperties;
  geometry: Point;
}

export interface FireHotspotMetadata {
  level: FireHotspotQuery['level'];
  parentCode: string | null;
  hotspotCount: number;
  hours: number;
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  windowStart: string;
  windowEnd: string;
  latestDetectionAt: string | null;
  status: 'ok' | 'stale';
  wmsUrl: string;
  wmsLayer: string;
  cqlFilter: string;
}

export interface FireHotspotCollection {
  type: 'FeatureCollection';
  metadata: FireHotspotMetadata;
  features: FireHotspotFeature[];
}

export interface FireHotspotQuery {
  level: 'country' | 'state' | 'municipality';
  parent?: string | null;
  hours?: number;
}

export interface FireHotspotLocation {
  latitude: number;
  longitude: number;
  tolerance: number;
  at: string;
}

export interface FireHotspotDetails {
  type: 'FeatureCollection';
  features: FireHotspotFeature[];
  matchedCount: number;
}

export interface FireMunicipality {
  ibgeCode: string;
  name: string;
  state: string;
  areaKm2: number | null;
  count: number;
  count24h: number;
  count24H?: number;
  density: number | null;
  latestDetectionAt: string | null;
}

export interface FireSummary {
  windowStart: string;
  windowEnd: string;
  hours: number;
  total: number;
  municipalities: FireMunicipality[];
  states: FireMunicipality[];
  rankedMunicipalities?: FireMunicipality[];
  unassignedCount: number;
  areaSource: string;
}
