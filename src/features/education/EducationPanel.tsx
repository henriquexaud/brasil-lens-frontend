import { useState } from 'react';
import type {
  EducationInstitutionSummary,
  EducationTerritory,
  MapFeatureProperties,
} from '@/api/types';
import { AnimatedText } from '@/components/AnimatedText';
import { DrillDownButton } from '@/components/DrillDownButton';
import { ErrorMessage } from '@/components/Feedback';
import { levelLabel } from '@/features/socioeconomic/format';
import { formatCount, institutionName, plural } from './education';
import { NO_OFFER } from './presentation';

// As maiores de uma UF cabem sem rolar; o resto fica a um clique.
const VISIBLE = 5;

function InstitutionList({
  institutions,
  onSelect,
}: {
  institutions: EducationInstitutionSummary[];
  onSelect: (code: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? institutions : institutions.slice(0, VISIBLE);
  return (
    <div className="education-institutions">
      <ol aria-label="Instituições por matrículas">
        {shown.map((item) => (
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
        ))}
      </ol>
      {institutions.length > VISIBLE && (
        <button type="button" className="text-button" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Mostrar menos' : `Mostrar todas (${formatCount(institutions.length)})`}
        </button>
      )}
    </div>
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
      {onClose && (
        <header className="detail-header">
          <div>
            {territory ? (
              <>
                <p className="detail-kicker">
                  {levelLabel(territory.level)}
                  {territory.parentName && ` · ${territory.parentName}`}
                </p>
                <AnimatedText as="h2" className="detail-title" text={territory.name} />
              </>
            ) : (
              <span role="status">{data?.name ?? 'Carregando local…'}</span>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar detalhe"
          >
            ×
          </button>
        </header>
      )}
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
