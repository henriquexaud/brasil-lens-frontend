import type { Geometry, MultiPolygon, Point } from 'geojson';

export type TerritoryLevel = 'country' | 'region' | 'state' | 'municipality';

export interface User {
  id: string;
  name: string;
  email: string;
  theme: 'light' | 'dark';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  name: string;
  theme: User['theme'];
}
export type GeometryLod = 'canonical' | 'overview' | 'detail';

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
  bbox?: BoundingBox;
  features: MapFeature[];
  parentFeature?: MapFeature | null;
}

export interface MapQuery {
  level: TerritoryLevel;
  parent?: string | null;
  lod?: Exclude<GeometryLod, 'canonical'>;
}

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

export type WeatherAlertProvider = 'inmet' | 'cemaden' | (string & {});

export type WeatherAlertCategory = 'meteorological' | 'geo_hydrological';

export type WeatherAlertSeverityLevel =
  'moderate' | 'high' | 'very_high' | 'extreme' | 'potential' | 'danger' | 'other';

export interface WeatherAlertProperties {
  provider: WeatherAlertProvider;
  category: WeatherAlertCategory;
  event: string;
  severity: string;
  severityLevel: WeatherAlertSeverityLevel;
  color: string | null;
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
  precipitation48hMm?: number | null;
  rainingNow?: boolean;
  samplePoints?: number | null;
  rainingPoints?: number | null;
  weatherCode: number | null;
  forecast: WeatherForecastDay[];
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
  count48h: number;
  count48H?: number;
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
export interface PushConfig {
  publicKey: string | null;
}
