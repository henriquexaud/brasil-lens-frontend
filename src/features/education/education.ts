import type {
  EducationCategory,
  EducationKind,
  EducationNetwork,
  EducationOrganization,
} from '@/api/types';

export interface EducationPreferences {
  network: EducationNetwork;
  kind: EducationKind;
  year: string;
}

export const DEFAULT_EDUCATION: EducationPreferences = {
  network: 'federal',
  kind: 'all',
  year: 'latest',
};

export const NETWORK_OPTIONS: { value: EducationNetwork; label: string }[] = [
  { value: 'federal', label: 'Federais' },
  { value: 'state', label: 'Estaduais' },
  { value: 'municipal', label: 'Municipais' },
];

export const KIND_OPTIONS: { value: EducationKind; label: string; title: string }[] = [
  { value: 'all', label: 'Todas', title: 'Todas as instituições da rede' },
  { value: 'university', label: 'Universidades', title: 'Universidades' },
  { value: 'institute', label: 'Institutos', title: 'Institutos federais e CEFETs' },
  { value: 'college', label: 'Faculdades', title: 'Faculdades e centros universitários' },
];

export function normalizeEducation(value: unknown): EducationPreferences | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const item = value as Record<string, unknown>;
  const network = NETWORK_OPTIONS.find((option) => option.value === item.network)?.value;
  const kind = KIND_OPTIONS.find((option) => option.value === item.kind)?.value;
  if (!network || !kind) return undefined;
  if (typeof item.year !== 'string' || !/^(latest|(19|20)\d{2})$/.test(item.year)) return undefined;
  return { network, kind, year: item.year };
}

// Cada rede e tipo é um indicador do motor do backend (context=education).
export function indicatorKey(network: EducationNetwork, kind: EducationKind): string {
  return `higher_ed_${network}_${kind === 'all' ? '' : `${kind}_`}enrollment`;
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
  const readable =
    clean !== clean.toLocaleUpperCase('pt-BR')
      ? clean
      : clean
          .toLocaleLowerCase('pt-BR')
          .split(' ')
          .map((word, index) => (index > 0 && CONNECTORS.has(word) ? word : capitalize(word)))
          .join(' ');
  // Como os próprios institutos se apresentam: "Instituto Federal do Ceará".
  return readable.replace(
    /^Instituto Federal de Educação, Ciência e Tecnologia\b/i,
    'Instituto Federal',
  );
}

const countFormat = new Intl.NumberFormat('pt-BR');

export function formatCount(value: number): string {
  return countFormat.format(value);
}

export function plural(value: number, one: string, many: string): string {
  return `${formatCount(value)} ${value === 1 ? one : many}`;
}
