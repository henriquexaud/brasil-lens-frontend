import type {
  EducationInstitutionSummary,
  EducationTerritory,
  MapFeatureProperties,
} from '@/api/types';
import { AnimatedText } from '@/components/AnimatedText';
import { DrillDownButton } from '@/components/DrillDownButton';
import { ScrollList } from '@/components/ScrollList';
import { ErrorMessage } from '@/components/Feedback';
import { DetailHeader as SharedDetailHeader } from '@/components/DetailHeader';
import { levelLabel } from '@/features/socioeconomic/format';
import { formatCount, institutionName, plural } from './education';
import { NO_OFFER } from './presentation';

function InstitutionList({
  institutions,
  onSelect,
}: {
  institutions: EducationInstitutionSummary[];
  onSelect: (code: number) => void;
}) {
  return (
    <div className="education-institutions">
      <ScrollList
        items={institutions}
        label="Instituições por matrículas"
        render={(item) => (
          <li key={item.code}>
            <button
              type="button"
              className="education-institution"
              onClick={() => onSelect(item.code)}
            >
              <span className="education-institution-name">
                {institutionName(item.name, item.acronym)}
                {item.acronym && <small>{item.acronym}</small>}
              </span>
              <strong>{formatCount(item.enrollment)}</strong>
            </button>
          </li>
        )}
      />
    </div>
  );
}

/** Cabeçalho de um território aberto no painel, comum às abas do contexto. */
export function DetailHeader({
  territory,
  fallback,
  onClose,
}: {
  territory?: MapFeatureProperties;
  fallback?: string;
  onClose: () => void;
}) {
  return (
    <SharedDetailHeader
      kicker={
        territory &&
        `${levelLabel(territory.level)}${territory.parentName ? ` · ${territory.parentName}` : ''}`
      }
      title={territory?.name}
      placeholder={fallback ?? 'Carregando local…'}
      onClose={onClose}
    />
  );
}

export function EducationPanel({
  data,
  loading,
  error,
  territory,
  onClose,
  onDrillDown,
  onSelectInstitution,
}: {
  data?: EducationTerritory;
  loading: boolean;
  error: Error | null;
  territory?: MapFeatureProperties;
  onClose?: () => void;
  onDrillDown: (code: string, name: string) => void;
  onSelectInstitution: (code: number) => void;
}) {
  const empty = data && data.year === null;
  const institutions = data?.institutions ?? [];
  return (
    <section
      className="panel-section territory-detail"
      aria-label={onClose ? 'Local selecionado' : 'Ensino superior no território'}
    >
      {onClose && <DetailHeader territory={territory} fallback={data?.name} onClose={onClose} />}
      {error && !data && <ErrorMessage error={error} />}
      <dl className="featured-indicator">
        <dt className="indicator-label">
          Matrículas presenciais
          <span className="indicator-year">{data?.year}</span>
        </dt>
        <AnimatedText
          as="dd"
          mode="number"
          className={`featured-value${data?.enrollment == null ? ' is-missing' : ''}`}
          text={
            loading && !data
              ? 'Carregando…'
              : empty
                ? 'Sem dados'
                : data?.enrollment == null
                  ? NO_OFFER
                  : formatCount(data.enrollment)
          }
        />
        {institutions.length > 0 && data?.courses != null && (
          <dd className="education-summary">
            {plural(institutions.length, 'instituição', 'instituições')} ·{' '}
            {plural(data.courses, 'curso', 'cursos')}
          </dd>
        )}
      </dl>
      {territory?.level === 'state' && onClose && (
        <DrillDownButton onClick={() => onDrillDown(territory.ibgeCode, territory.name)} />
      )}
      {data && institutions.length > 0 && (
        <InstitutionList
          key={`${data.code}:${data.year}:${data.network}:${data.kind}`}
          institutions={institutions}
          onSelect={onSelectInstitution}
        />
      )}
    </section>
  );
}
