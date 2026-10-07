export interface TerritoryPresentation {
  key: string;
  colors: Map<string, string>;
  values: Set<string>;
  tooltips: Map<string, { value: string; meta: string }>;
}
