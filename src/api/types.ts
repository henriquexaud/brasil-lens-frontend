/**
 * Contratos da API, tipados à mão para espelhar os schemas Pydantic do backend.
 *
 * Nenhum `any`: se o backend mudar um contrato, o erro aparece na compilação e
 * não em runtime. A resposta do mapa é um GeoJSON FeatureCollection válido com
 * membros extras (`scope`, `indicator`, `statistics`, `classification`), o que
 * permite entregá-la ao react-leaflet sem transformação nenhuma.
 */
import type { Geometry, MultiPolygon, Point } from 'geojson';

export type TerritoryLevel = 'country' | 'region' | 'state' | 'municipality';
export type GeometryLod = 'canonical' | 'overview' | 'detail';
export type IndicatorOrigin = 'sourced' | 'derived';
/** Agrupamento temático de indicadores. Ver GET /contexts. */
export type DataContext = 'sociopolitical' | 'climate_environmental' | 'biodiversity';

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

export interface Indicator {
  key: string;
  name: string;
  description: string | null;
  unit: string;
  origin: IndicatorOrigin;
  context: DataContext;
  /** Quantas casas decimais exibir — metadado de formatação, não de cor. */
  decimalPlaces: number;
  /** Anos com dado, crescente. É o que popula o seletor de ano. */
  availableYears: number[];
  latestYear: number | null;
}

export interface IndicatorListResponse {
  indicators: Indicator[];
}

/** Um provider registrado num contexto — ver `GET /contexts`. */
export interface ContextProvider {
  key: string;
  name: string;
  homepage: string | null;
  indicatorCount: number;
}

export interface Context {
  key: DataContext;
  name: string;
  description: string;
  providers: ContextProvider[];
  indicatorCount: number;
}

export interface ContextListResponse {
  contexts: Context[];
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

/**
 * Um indicador resolvido para exibição. `value` e `year` são nulos juntos
 * quando não há dado — política única de ausência da API.
 */
export interface IndicatorValue {
  key: string;
  name: string;
  unit: string;
  decimalPlaces: number;
  origin: IndicatorOrigin;
  value: number | null;
  year: number | null;
  source: string | null;
}

export interface TerritoryDetail extends TerritorySummary {
  bbox: BoundingBox | null;
}

export interface TerritoryOverview extends TerritorySummary {
  capital: TerritoryRef | null;
  childrenCount: number;
  childrenLevel: TerritoryLevel | null;
  bbox: BoundingBox | null;
  indicators: IndicatorValue[];
}

export interface MapScope {
  level: TerritoryLevel;
  parent: string | null;
  lod: GeometryLod;
  count: number;
}

export interface MapIndicatorMeta {
  key: string;
  name: string;
  unit: string;
  decimalPlaces: number;
  /** Ano que efetivamente respondeu — pode não ser o ano corrente. */
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
  /** Limite superior de cada classe. A cor é escolhida aqui no frontend. */
  breaks: number[];
  classes: number;
}

export interface MapFeatureProperties {
  ibgeCode: string;
  name: string;
  level: TerritoryLevel;
  abbreviation: string | null;
  parentCode: string | null;
  parentName: string | null;
  value: number | null;
  normalizedValue: number | null;
  classIndex: number | null;
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
  indicator: MapIndicatorMeta | null;
  statistics: MapStatistics | null;
  classification: MapClassification | null;
  /** Ausente quando não há extensão conhecida — a RFC 7946 não admite `null`. */
  bbox?: BoundingBox;
  features: MapFeature[];
}

export interface MapQuery {
  level: TerritoryLevel;
  parent?: string | null;
  indicator?: string | null;
  /** Ano ou `'latest'`. */
  year?: string;
}

/**
 * Visualização salva: o recorte do mapa que o usuário guardou.
 *
 * É a única entidade **escrita** pelo frontend — todo o resto é projeção de
 * leitura sobre o que a ingestão trouxe do IBGE. O `id` é o UUID público
 * devolvido pela API; o id interno do banco não aparece no contrato.
 */
export interface SavedView {
  id: string;
  name: string;
  description: string | null;
  level: TerritoryLevel;
  parentCode: string | null;
  indicatorKey: string;
  /** Ano de referência ou `'latest'` — o mesmo valor usado no seletor de ano. */
  year: string;
  classes: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Corpo de POST /views e de PUT /views/{id} — PUT substitui a visualização inteira.
 *
 * `MapScopeInput` é o mesmo objeto sem o nome: é tudo o que o App sabe antes de
 * o usuário batizar a visualização, e tipá-lo assim evita passar um nome vazio
 * de mentira só para satisfazer o tipo.
 */
export type MapScopeInput = Omit<SavedViewInput, 'name'>;

export interface SavedViewInput {
  name: string;
  description?: string | null;
  level: TerritoryLevel;
  parentCode?: string | null;
  indicatorKey: string;
  year: string;
  classes?: number;
}

export interface SavedViewListResponse {
  views: SavedView[];
  pagination: Pagination;
}

export interface TerritoryListResponse {
  territories: TerritorySummary[];
  pagination: Pagination;
}

/**
 * Contexto Clima — painel meteorológico, não coropleta.
 *
 * Sem `scope`/`indicator`/`classification`: uma estação ou um alerta não tem
 * recorte territorial nem classe de quantil. Ver GET /weather/stations,
 * /weather/alerts, /weather/sources e `docs/ARCHITECTURE.md` (contexto Clima).
 */
export type WeatherStationType = 'automatic_weather' | 'rain_gauge';

export interface WeatherStationProperties {
  provider: string;
  externalCode: string;
  name: string;
  stationType: WeatherStationType;
  stateAbbreviation: string | null;
  /** ISO 8601, UTC — horário da leitura na fonte, não da ingestão. */
  observedAt: string;
  temperatureC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  precipitationMm: number | null;
}

export interface WeatherStationFeature {
  type: 'Feature';
  id: string;
  properties: WeatherStationProperties;
  geometry: Point;
}

export interface WeatherStationCollection {
  type: 'FeatureCollection';
  features: WeatherStationFeature[];
}

export interface WeatherAlertProperties {
  provider: string;
  event: string;
  severity: string;
  /** Cor oficial da fonte (ex.: INMET) — exibida como está, nunca trocada. */
  color: string | null;
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

export interface WeatherSourceStatus {
  key: string;
  name: string;
  lastUpdatedAt: string | null;
  status: WeatherSourceStatusValue;
  updateFrequencySeconds: number;
}

export interface WeatherSourcesResponse {
  sources: WeatherSourceStatus[];
}

export interface WeatherForecastDay {
  date: string;
  weatherCode: number | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  precipitationProbabilityPct: number | null;
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
  precipitationIntervalMinutes: number;
  weatherCode: number | null;
  forecast: WeatherForecastDay[];
}

export interface WeatherCurrentResponse {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  status: WeatherSourceStatusValue;
  cities: WeatherCity[];
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
  unassignedCount: number;
  areaSource: string;
}
