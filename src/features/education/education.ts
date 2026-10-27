import type { EducationCategory, EducationNetwork, EducationOrganization } from '@/api/types';

export interface EducationPreferences {
  network: EducationNetwork;
  year: string;
}

export const DEFAULT_EDUCATION: EducationPreferences = { network: 'public', year: 'latest' };

const NETWORKS: EducationNetwork[] = ['public', 'federal', 'state', 'municipal'];

export function normalizeEducation(value: unknown): EducationPreferences | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const item = value as Record<string, unknown>;
  if (!NETWORKS.includes(item.network as EducationNetwork)) return undefined;
  if (typeof item.year !== 'string' || !/^(latest|(19|20)\d{2})$/.test(item.year)) return undefined;
  return { network: item.network as EducationNetwork, year: item.year };
}

export const NETWORK_OPTIONS: { value: EducationNetwork; label: string }[] = [
  { value: 'public', label: 'Públicas' },
  { value: 'federal', label: 'Federais' },
  { value: 'state', label: 'Estaduais' },
  { value: 'municipal', label: 'Municipais' },
];

// Cada rede é um indicador do motor do backend (context=education).
export function indicatorKey(network: EducationNetwork): string {
  return `higher_ed_${network}_enrollment`;
}

export const CATEGORY_LABEL: Record<EducationCategory, string> = {
  federal: 'Federal',
  state: 'Estadual',
  municipal: 'Municipal',
};

export const ORGANIZATION_LABEL: Record<EducationOrganization, string> = {
  university: 'Universidade',
  university_center: 'Centro universitário',
  college: 'Faculdade',
  federal_institute: 'Instituto federal',
  cefet: 'CEFET',
};

export const NETWORK_LIST_TITLE: Record<EducationNetwork, string> = {
  public: 'Instituições públicas',
  federal: 'Instituições federais',
  state: 'Instituições estaduais',
  municipal: 'Instituições municipais',
};

const CONNECTORS = new Set([
  'a',
  'as',
  'o',
  'os',
  'de',
  'da',
  'das',
  'do',
  'dos',
  'e',
  'em',
  'na',
  'nas',
  'no',
  'nos',
  'para',
]);

function capitalize(word: string): string {
  return word
    .split('-')
    .map((part) => part.charAt(0).toLocaleUpperCase('pt-BR') + part.slice(1))
    .join('-');
}

/**
 * O INEP publica a maioria dos nomes em maiúsculas e às vezes repete a sigla no
 * fim ("... - UNEAL"). Nomes que já vêm com minúsculas ficam como estão.
 */
export function institutionName(name: string, acronym: string | null): string {
  let clean = name.replace(/\s+/g, ' ').trim();
  const suffix = / - ([^ ]+)$/.exec(clean);
  if (suffix && acronym && acronym.toUpperCase().startsWith(suffix[1]!.toUpperCase())) {
    clean = clean.slice(0, suffix.index);
  }
  if (clean !== clean.toLocaleUpperCase('pt-BR')) return clean;
  return clean
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((word, index) => (index > 0 && CONNECTORS.has(word) ? word : capitalize(word)))
    .join(' ');
}

const countFormat = new Intl.NumberFormat('pt-BR');

export function formatCount(value: number): string {
  return countFormat.format(value);
}
