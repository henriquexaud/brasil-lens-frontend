import type { BasicSchools, MapFeatureProperties, TerritoryOverview } from '@/api/types';
import { AnimatedText } from '@/components/AnimatedText';
import { DrillDownButton } from '@/components/DrillDownButton';
import { ErrorMessage } from '@/components/Feedback';
import {
  METRIC_OPTIONS,
  basicKey,
  formatCount,
  hasCoverage,
  metricLabel,
  noSchoolsLabel,
  plural,
  type BasicMetric,
  type BasicStage,
} from './education';
import { DetailHeader } from './EducationPanel';
import { SchoolList } from './SchoolList';

const percent = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function summaryPart(metric: BasicMetric, value: number): string {
  if (metric === 'coverage') return `atendimento de ${percent.format(value)}%`;
  if (metric === 'schools') return plural(value, 'escola', 'escolas');
  return plural(value, 'matrícula', 'matrículas');
}

export function BasicEducationPanel({
  stage,
  metric,
  data,
  loading,
  error,
  territory,
  schools,
  onClose,
  onDrillDown,
}: {
  stage: BasicStage;
  metric: BasicMetric;
  data?: TerritoryOverview;
  loading: boolean;
  error: Error | null;
  territory?: MapFeatureProperties;
  // Lista do município; `null` fora dele (no Brasil e na UF seriam milhares).
  schools: { data?: BasicSchools; loading: boolean; error: Error | null } | null;
  onClose?: () => void;
  onDrillDown: (code: string, name: string) => void;
}) {
  const values = new Map(data?.indicators.map((item) => [item.key, item]));
  const featured = values.get(basicKey(stage, metric));
  const value = featured?.value ?? null;
  // A linha discreta sob o número: as outras medidas da mesma etapa.
  const summary = METRIC_OPTIONS.filter(
    (option) => option.value !== metric && (option.value !== 'coverage' || hasCoverage(stage)),
  ).flatMap((option) => {
    const item = values.get(basicKey(stage, option.value));
    return item?.value == null ? [] : [summaryPart(option.value, item.value)];
  });
  const coverage = hasCoverage(stage)
    ? (values.get(basicKey(stage, 'coverage'))?.value ?? null)
    : null;
  return (
    <section
      className="panel-section territory-detail"
      aria-label={onClose ? 'Local selecionado' : 'Educação básica no território'}
    >
      {onClose && <DetailHeader territory={territory} fallback={data?.name} onClose={onClose} />}
      {error && !data && <ErrorMessage error={error} />}
      <dl className="featured-indicator">
        <dt className="indicator-label">
          {metricLabel(stage, metric)}
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
                : metric === 'coverage'
                  ? `${percent.format(value)}%`
                  : formatCount(value)
          }
        />
        {summary.length > 0 && <dd className="education-summary">{summary.join(' · ')}</dd>}
        {coverage !== null && coverage > 100 && (
          <dd className="education-summary">
            Passa de 100% porque conta alunos de outros municípios e fora da idade.
          </dd>
        )}
      </dl>
      {schools ? (
        <SchoolList
          key={`${territory?.ibgeCode}:${stage}`}
          {...schools}
          year={featured?.year ?? undefined}
          emptyLabel={noSchoolsLabel(stage)}
        />
      ) : (
        <p className="education-summary education-schools-hint">
          Abra um município para ver a lista de escolas.
        </p>
      )}
      {territory?.level === 'state' && onClose && (
        <DrillDownButton onClick={() => onDrillDown(territory.ibgeCode, territory.name)} />
      )}
    </section>
  );
}
