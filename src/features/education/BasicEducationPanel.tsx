import type { MapFeatureProperties, TerritoryOverview } from '@/api/types';
import { AnimatedText } from '@/components/AnimatedText';
import { DrillDownButton } from '@/components/DrillDownButton';
import { ErrorMessage } from '@/components/Feedback';
import { COVERAGE_KEY, formatCount, plural, type EducationLevel } from './education';
import { DetailHeader } from './EducationPanel';

const percent = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const LABEL: Record<string, string> = {
  basic_daycare_coverage: 'Cobertura de creche',
  basic_daycare_enrollment: 'Matrículas em creche',
  basic_daycares: 'Creches públicas',
  basic_schools: 'Escolas públicas',
  basic_enrollment: 'Matrículas na rede pública',
};

// A linha discreta sob o número: as outras medidas da aba, na ordem das pílulas.
const SUMMARY: Record<Exclude<EducationLevel, 'higher'>, string[]> = {
  daycare: ['basic_daycare_coverage', 'basic_daycare_enrollment', 'basic_daycares'],
  schools: ['basic_schools', 'basic_enrollment'],
};

function summaryPart(key: string, value: number): string {
  switch (key) {
    case COVERAGE_KEY:
      return `cobertura de ${percent.format(value)}%`;
    case 'basic_daycares':
      return plural(value, 'creche', 'creches');
    case 'basic_schools':
      return plural(value, 'escola', 'escolas');
    default:
      return plural(value, 'matrícula', 'matrículas');
  }
}

export function BasicEducationPanel({
  level,
  indicatorKey,
  data,
  loading,
  error,
  territory,
  onClose,
  onDrillDown,
}: {
  level: Exclude<EducationLevel, 'higher'>;
  indicatorKey: string;
  data?: TerritoryOverview;
  loading: boolean;
  error: Error | null;
  territory?: MapFeatureProperties;
  onClose?: () => void;
  onDrillDown: (code: string, name: string) => void;
}) {
  const values = new Map(data?.indicators.map((item) => [item.key, item]));
  const featured = values.get(indicatorKey);
  const value = featured?.value ?? null;
  const summary = SUMMARY[level]
    .filter((key) => key !== indicatorKey)
    .flatMap((key) => {
      const item = values.get(key);
      return item?.value == null ? [] : [summaryPart(key, item.value)];
    });
  const coverage = values.get(COVERAGE_KEY)?.value ?? null;
  return (
    <section
      className="panel-section territory-detail"
      aria-label={onClose ? 'Local selecionado' : 'Educação básica no território'}
    >
      {onClose && <DetailHeader territory={territory} fallback={data?.name} onClose={onClose} />}
      {error && !data && <ErrorMessage error={error} />}
      <dl className="featured-indicator">
        <dt className="indicator-label">
          {LABEL[indicatorKey]}
          <span className="indicator-year">{featured?.year}</span>
        </dt>
        <AnimatedText
          as="dd"
          mode="number"
          className={`featured-value${value === null ? ' is-missing' : ''}`}
          text={
            loading && !data
              ? 'Carregando…'
              : value === null
                ? 'Sem dados'
                : indicatorKey === COVERAGE_KEY
                  ? `${percent.format(value)}%`
                  : formatCount(value)
          }
        />
        {summary.length > 0 && <dd className="education-summary">{summary.join(' · ')}</dd>}
        {level === 'daycare' && coverage !== null && coverage > 100 && (
          <dd className="education-summary">
            Passa de 100% porque as creches atendem crianças de outros municípios.
          </dd>
        )}
      </dl>
      {territory?.level === 'state' && onClose && (
        <DrillDownButton onClick={() => onDrillDown(territory.ibgeCode, territory.name)} />
      )}
    </section>
  );
}
