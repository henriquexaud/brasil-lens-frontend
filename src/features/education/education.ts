import type {
  EducationCategory,
  EducationKind,
  EducationNetwork,
  EducationOrganization,
} from '@/api/types';

// Aba do contexto: educação básica pública (ADR-23) ou ensino superior (ADR-19).
export type EducationLevel = 'basic' | 'higher';
export type BasicStage = 'all' | 'early_childhood' | 'elementary' | 'high_school';
export type BasicMetric = 'schools' | 'enrollment' | 'coverage';

export interface EducationPreferences {
  level: EducationLevel;
  network: EducationNetwork;
  kind: EducationKind;
  stage: BasicStage;
  metric: BasicMetric;
  year: string;
}

export const DEFAULT_EDUCATION: EducationPreferences = {
  level: 'basic',
  network: 'federal',
  kind: 'all',
  stage: 'all',
  metric: 'schools',
  year: 'latest',
};

// A básica vem antes: é a trajetória (infantil → médio → superior) e o universo maior.
export const LEVEL_OPTIONS: { value: EducationLevel; label: string }[] = [
  { value: 'basic', label: 'Básica' },
  { value: 'higher', label: 'Superior' },
];

interface StageOption {
  value: BasicStage;
  label: string;
  title: string;
  // "Escolas com educação infantil", "Matrículas na educação infantil", "% de 0 a 5 anos".
  offer: string;
  place: string;
  // Faixa do atendimento. O fundamental não tem: a taxa bruta satura e não
  // diferencia municípios (ADR-23 do backend).
  ages: string | null;
}

export const STAGE_OPTIONS: StageOption[] = [
  {
    value: 'all',
    label: 'Todas',
    title: 'Toda a educação básica pública',
    offer: '',
    place: 'na rede pública',
    ages: null,
  },
  {
    value: 'early_childhood',
    label: 'Infantil',
    title: 'Educação infantil: creche e pré-escola, de 0 a 5 anos',
    offer: 'com educação infantil',
    place: 'na educação infantil',
    ages: '0 a 5 anos',
  },
  {
    value: 'elementary',
    label: 'Fundamental',
    title: 'Ensino fundamental, de 6 a 14 anos',
    offer: 'com ensino fundamental',
    place: 'no fundamental',
    ages: null,
  },
  {
    value: 'high_school',
    label: 'Médio',
    title: 'Ensino médio, de 15 a 17 anos',
    offer: 'com ensino médio',
    place: 'no ensino médio',
    ages: '15 a 17 anos',
  },
];

export const METRIC_OPTIONS: { value: BasicMetric; label: string }[] = [
  { value: 'schools', label: 'Escolas' },
  { value: 'enrollment', label: 'Matrículas' },
  { value: 'coverage', label: 'Atendimento' },
];

function stageOption(stage: BasicStage): StageOption {
  return STAGE_OPTIONS.find((option) => option.value === stage)!;
}

export function hasCoverage(stage: BasicStage): boolean {
  return stageOption(stage).ages !== null;
}

/** Atendimento só existe na infantil e no médio; nas outras etapas, vale Escolas. */
export function basicMetric(stage: BasicStage, metric: BasicMetric): BasicMetric {
  return metric === 'coverage' && !hasCoverage(stage) ? 'schools' : metric;
}

export function basicKey(stage: BasicStage, metric: BasicMetric): string {
  return stage === 'all' ? `basic_${metric}` : `basic_${stage}_${metric}`;
}

/** Indicador da etapa e medida escolhidas; `null` no ensino superior. */
export function basicIndicatorKey(preferences: EducationPreferences): string | null {
  if (preferences.level !== 'basic') return null;
  return basicKey(preferences.stage, basicMetric(preferences.stage, preferences.metric));
}

export function metricLabel(stage: BasicStage, metric: BasicMetric): string {
  const { offer, place } = stageOption(stage);
  if (metric === 'coverage') return `Atendimento ${place}`;
  if (metric === 'enrollment') return `Matrículas ${place}`;
  return stage === 'all' ? 'Escolas públicas' : `Escolas ${offer}`;
}

export function metricTitle(stage: BasicStage, metric: BasicMetric): string {
  const { offer, place, ages } = stageOption(stage);
  if (metric === 'coverage')
    return `Matrículas públicas ${place} por pessoa de ${ages} (taxa bruta, desde 2022)`;
  if (metric === 'enrollment')
    return stage === 'all'
      ? 'Matrículas na educação básica pública, da creche ao ensino médio'
      : `Matrículas públicas ${place}`;
  return stage === 'all'
    ? 'Escolas públicas com matrícula na educação básica'
    : `Escolas públicas ${offer}`;
}

// Unidade curta ao lado da fonte, no cabeçalho do mapa.
export function metricUnit(stage: BasicStage, metric: BasicMetric): string {
  if (metric === 'coverage') return `% de ${stageOption(stage).ages}`;
  return metric === 'enrollment' ? 'matrículas' : 'escolas';
}

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

// Creche e pré-escola eram etapas separadas até virarem a educação infantil.
const LEGACY_STAGE: Record<string, BasicStage> = {
  daycare: 'early_childhood',
  preschool: 'early_childhood',
};

// Abas da primeira versão da básica (Creches e Escolas), lidas como etapa e medida.
const LEGACY_DAYCARE: Record<string, BasicMetric> = {
  coverage: 'coverage',
  enrollment: 'enrollment',
  units: 'schools',
};

export function normalizeEducation(value: unknown): EducationPreferences | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const item = value as Record<string, unknown>;
  const network = NETWORK_OPTIONS.find((option) => option.value === item.network)?.value;
  const kind = KIND_OPTIONS.find((option) => option.value === item.kind)?.value;
  if (!network || !kind) return undefined;
  if (typeof item.year !== 'string' || !/^(latest|(19|20)\d{2})$/.test(item.year)) return undefined;
  const pick = <T>(options: { value: T }[], raw: unknown, fallback: T): T =>
    options.find((option) => option.value === raw)?.value ?? fallback;
  let level: EducationLevel = 'higher';
  let stage = pick(
    STAGE_OPTIONS,
    LEGACY_STAGE[String(item.stage)] ?? item.stage,
    DEFAULT_EDUCATION.stage,
  );
  let metric = pick(METRIC_OPTIONS, item.metric, DEFAULT_EDUCATION.metric);
  if (item.level === 'basic') level = 'basic';
  else if (item.level === 'daycare') {
    level = 'basic';
    stage = 'early_childhood';
    metric = LEGACY_DAYCARE[String(item.daycare)] ?? 'coverage';
  } else if (item.level === 'schools') {
    level = 'basic';
    stage = 'all';
    metric = item.schools === 'enrollment' ? 'enrollment' : 'schools';
  }
  // Sessão sem aba é de antes da educação básica: estava no ensino superior.
  return { level, network, kind, stage, metric: basicMetric(stage, metric), year: item.year };
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
