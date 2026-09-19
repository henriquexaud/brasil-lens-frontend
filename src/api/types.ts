/**
 * Contratos da API, tipados à mão para espelhar os schemas Pydantic do backend.
 *
 * Nenhum `any`: se o backend mudar um contrato, o erro aparece na compilação e
 * não em runtime. A resposta do mapa é um GeoJSON FeatureCollection válido com
 * membros extras (`scope`, `indicator`, `statistics`, `classification`), o que
 * permite entregá-la ao react-leaflet sem transformação nenhuma.
 */
import type { MultiPolygon } from 'geojson';

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
