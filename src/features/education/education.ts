import type {
  EducationCategory,
  EducationKind,
  EducationNetwork,
  EducationOrganization,
} from '@/api/types';

// Aba do contexto: ensino superior (ADR-19) ou educação básica pública (ADR-23).
export type EducationLevel = 'higher' | 'daycare' | 'schools';
export type DaycareMetric = 'coverage' | 'enrollment' | 'units';
export type SchoolMetric = 'schools' | 'enrollment';

export interface EducationPreferences {
  level: EducationLevel;
  network: EducationNetwork;
  kind: EducationKind;
  daycare: DaycareMetric;
  schools: SchoolMetric;
  year: string;
}

export const DEFAULT_EDUCATION: EducationPreferences = {
  level: 'higher',
  network: 'federal',
  kind: 'all',
  daycare: 'coverage',
  schools: 'schools',
  year: 'latest',
};

export const LEVEL_OPTIONS: { value: EducationLevel; label: string }[] = [
  { value: 'higher', label: 'Superior' },
  { value: 'daycare', label: 'Creches' },
  { value: 'schools', label: 'Escolas' },
];

interface MetricOption<T> {
  value: T;
  label: string;
  title: string;
  key: string;
  // Unidade ao lado da fonte, no cabeçalho do mapa.
  unit: string;
}

export const DAYCARE_OPTIONS: MetricOption<DaycareMetric>[] = [
  {
    value: 'coverage',
    label: 'Cobertura',
    title: 'Matrículas em creche pública por criança de 0 a 3 anos',
    key: 'basic_daycare_coverage',
    unit: '% de 0 a 3 anos',
  },
  {
    value: 'enrollment',
    label: 'Matrículas',
    title: 'Matrículas em creche pública',
    key: 'basic_daycare_enrollment',
    unit: 'matrículas',
  },
  {
    value: 'units',
    label: 'Unidades',
    title: 'Escolas públicas com matrícula de creche',
    key: 'basic_daycares',
    unit: 'creches',
  },
];

export const SCHOOL_OPTIONS: MetricOption<SchoolMetric>[] = [
  {
    value: 'schools',
    label: 'Escolas',
    title: 'Escolas públicas com matrícula na educação básica',
    key: 'basic_schools',
    unit: 'escolas',
  },
  {
    value: 'enrollment',
    label: 'Matrículas',
    title: 'Matrículas na educação básica pública, da creche ao ensino médio',
    key: 'basic_enrollment',
    unit: 'matrículas',
  },
];

export const COVERAGE_KEY = 'basic_daycare_coverage';

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
  // Sessões anteriores à educação básica não têm aba nem métricas: valem os padrões.
  const pick = <T>(options: { value: T }[], raw: unknown, fallback: T): T =>
    options.find((option) => option.value === raw)?.value ?? fallback;
  return {
    level: pick(LEVEL_OPTIONS, item.level, DEFAULT_EDUCATION.level),
    network,
    kind,
    daycare: pick(DAYCARE_OPTIONS, item.daycare, DEFAULT_EDUCATION.daycare),
    schools: pick(SCHOOL_OPTIONS, item.schools, DEFAULT_EDUCATION.schools),
    year: item.year,
  };
}

// Cada rede e tipo é um indicador do motor do backend (context=education).
export function indicatorKey(network: EducationNetwork, kind: EducationKind): string {
  return `higher_ed_${network}_${kind === 'all' ? '' : `${kind}_`}enrollment`;
}

/** Indicador da aba básica escolhida; `null` no ensino superior. */
export function basicIndicatorKey(preferences: EducationPreferences): string | null {
  if (preferences.level === 'daycare')
    return DAYCARE_OPTIONS.find((option) => option.value === preferences.daycare)!.key;
  if (preferences.level === 'schools')
    return SCHOOL_OPTIONS.find((option) => option.value === preferences.schools)!.key;
  return null;
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
