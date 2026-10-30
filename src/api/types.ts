import type { FeatureCollection, Geometry, MultiPolygon, Point } from 'geojson';

export type TerritoryLevel = 'country' | 'region' | 'state' | 'municipality';

export type DataContext =
  'climate' | 'environment' | 'socioeconomic' | 'political' | 'transport' | 'education';

export type IndicatorContext = 'socioeconomic' | 'environment' | 'education';

export interface Indicator {
  key: string;
  name: string;
  description: string | null;
  unit: string;
  origin: 'sourced' | 'derived';
  decimalPlaces: number;
  availableYears: number[];
  latestYear: number | null;
  supportedLevels: TerritoryLevel[];
}

export interface IndicatorListResponse {
  indicators: Indicator[];
  version: string;
}

export interface MapIndicatorMeta {
  key: string;
  name: string;
  unit: string;
  decimalPlaces: number;
  year: number | null;
  requestedYear: string;
  availableYears: number[];
}

export interface MapStatistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  count: number;
  missing: number;
}

export interface MapClassification {
  method: 'quantile';
  scope: 'national';
  min: number;
  max: number;
  classes: number;
  breaks: number[];
}

export interface MapValue {
  ibgeCode: string;
  value: number | null;
  classIndex: number | null;
}

export interface MapValuesResponse {
  level: TerritoryLevel;
  parent: string | null;
  indicator: MapIndicatorMeta;
  statistics: MapStatistics | null;
  classification: MapClassification | null;
  values: MapValue[];
  version: string;
}

export interface IndicatorValue {
  key: string;
  name: string;
  unit: string;
  decimalPlaces: number;
  origin: 'sourced' | 'derived';
  value: number | null;
  year: number | null;
  source: string | null;
}

export interface TerritoryOverview extends TerritoryDetail {
  capital: TerritoryRef | null;
  childrenCount: number;
  childrenLevel: TerritoryLevel | null;
  indicators: IndicatorValue[];
}

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

export interface DeforestationAlertTerritory {
  ibgeCode: string;
  name: string;
  state: string;
  areaKm2: number | null;
  count: number;
  alertKm2: number;
  density: number | null;
  latestViewDate: string | null;
}

export interface DeforestationAlertPoint {
  ibgeCode: string | null;
  longitude: number;
  latitude: number;
  areaKm2: number;
  viewDate: string;
  municipality: string;
  state: string;
  biome: string;
}

// Alertas do DETER (INPE) dos últimos `days` dias até o último publicado.
export interface DeforestationAlerts {
  windowStart: string | null;
  windowEnd: string | null;
  days: number;
  fetchedAt: string;
  total: number;
  totalKm2: number;
  unassignedCount: number;
  biomes: string[];
  // Um dos biomas não respondeu agora: `biomes` lista só os que responderam.
  partial: boolean;
  municipalities: DeforestationAlertTerritory[];
  states: DeforestationAlertTerritory[];
  rankedMunicipalities: DeforestationAlertTerritory[];
  points: DeforestationAlertPoint[];
  source: string;
  sourceUrl: string;
  areaSource: string;
  notice: string;
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

export type PoliticalOffice =
  'president' | 'governor' | 'senator' | 'federal_deputy' | 'state_deputy' | 'mayor' | 'councillor';
export type PoliticalMetric =
  | 'leading_candidate'
  | 'leading_party'
  | 'leader_share'
  | 'margin'
  | 'turnout'
  | 'abstention'
  | 'blank_votes'
  | 'null_votes'
  | 'invalid_votes'
  | 'representation';
export interface PoliticalSelection {
  category: 'elections' | 'representation' | 'participation';
  office: PoliticalOffice;
  year: number;
  round: number;
  metric: PoliticalMetric;
}
export interface PoliticalRelease {
  year: number;
  status: 'ok' | 'partial';
  updatedAt: string | null;
  note: string;
  contests: { office: PoliticalOffice; rounds: number[] }[];
}
export interface PoliticalValue {
  ibgeCode: string;
  value: number | null;
  label: string | null;
  party: string | null;
  tie: boolean;
}
export interface PoliticalValues {
  year: number;
  office: PoliticalOffice;
  round: number;
  metric: PoliticalMetric;
  status: 'ok' | 'partial';
  updatedAt: string | null;
  note: string;
  values: PoliticalValue[];
}
export interface PoliticalCandidate {
  id: string;
  name: string;
  number: string;
  party: string;
  partyNumber: string;
  status: string;
  votes?: number | null;
}
export interface PoliticalDetail {
  ibgeCode: string;
  name: string;
  level: TerritoryLevel;
  year: number;
  office: PoliticalOffice;
  round: number;
  status: 'ok' | 'partial';
  updatedAt: string | null;
  summary: {
    eligible?: number | null;
    turnout?: number | null;
    abstention?: number | null;
    totalVotes?: number | null;
    validVotes?: number | null;
    blankVotes?: number | null;
    nullVotes?: number | null;
    representatives?: number;
    party?: string | null;
    partyVotes?: number | null;
    partySeats?: number | null;
    candidateTie?: boolean;
    partyTie?: boolean;
  } | null;
  leaders: PoliticalCandidate[];
  representatives: PoliticalCandidate[];
  representativeTotal: number;
  offset: number;
  limit: number;
  note: string;
}

export type TransportLayer =
  'road_federal' | 'road_state' | 'road_local' | 'rail' | 'waterway' | 'port';

export interface TransportFeatureProperties {
  layer: TransportLayer;
  name?: string | null;
  attributes?: Record<string, string> | null;
}

export interface TransportNetwork extends FeatureCollection<Geometry, TransportFeatureProperties> {
  metadata: {
    layer: TransportLayer;
    detail: 'overview' | 'regional' | 'local' | 'street';
    version: number;
  };
}

export interface TransportCatalog {
  version: number;
  layers: { key: TransportLayer; label: string; source: 'dnit' | 'ibge'; minZoom: number }[];
  sources: {
    key: 'dnit' | 'ibge' | 'osm';
    label: string;
    edition?: string | null;
    description: string;
    url?: string | null;
  }[];
  /** Tiles OSM de transporte; `url` é relativo à API, com {z}/{x}/{y}. */
  tiles: { url: string; minZoom: number; maxZoom: number; description: string } | null;
}

export interface TransportSummary {
  code: string;
  name: string;
  totals: { layer: TransportLayer; value: number | null }[];
}

// Educação (ADR-19 do backend): instituições públicas de ensino superior.
export type EducationNetwork = 'federal' | 'state' | 'municipal';
// Filtro por tipo: institutos juntam os CEFETs; faculdades, os centros universitários.
export type EducationKind = 'all' | 'university' | 'institute' | 'college';
export type EducationCategory = 'federal' | 'state' | 'municipal';
export type EducationOrganization =
  'university' | 'university_center' | 'college' | 'federal_institute' | 'cefet';

export interface EducationPlace {
  code: string;
  name: string;
  state: string | null;
}

export interface EducationInstitutionSummary {
  code: number;
  name: string;
  acronym: string | null;
  category: EducationCategory;
  organization: EducationOrganization;
  seat: EducationPlace | null;
  enrollment: number;
  courses: number;
  municipalities: number;
}

export interface EducationTerritory {
  code: string;
  name: string;
  year: number | null;
  availableYears: number[];
  network: EducationNetwork;
  kind: EducationKind;
  enrollment: number | null;
  courses: number | null;
  institutions: EducationInstitutionSummary[];
}

export interface EducationCampus extends EducationPlace {
  enrollment: number;
  courses: number;
  entrants: number;
  graduates: number;
}

export interface EducationInstitutionDetail {
  code: number;
  year: number;
  name: string;
  acronym: string | null;
  category: EducationCategory;
  organization: EducationOrganization;
  seat: EducationPlace | null;
  faculty: number | null;
  staff: number | null;
  enrollment: number;
  distanceEnrollment: number;
  courses: number;
  campuses: EducationCampus[];
}
