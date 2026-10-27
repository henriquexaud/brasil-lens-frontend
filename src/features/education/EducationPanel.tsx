import { useState } from 'react';
import type {
  EducationInstitutionSummary,
  EducationNetwork,
  EducationTerritory,
  MapFeatureProperties,
} from '@/api/types';
import { AnimatedText } from '@/components/AnimatedText';
import { DrillDownButton } from '@/components/DrillDownButton';
import { ErrorMessage } from '@/components/Feedback';
import { levelLabel } from '@/features/socioeconomic/format';
import {
  CATEGORY_LABEL,
  NETWORK_LIST_TITLE,
  ORGANIZATION_LABEL,
  formatCount,
  institutionName,
} from './education';
import { NO_OFFER } from './presentation';

// O bastante para as maiores de uma UF; o resto fica a um clique.
const VISIBLE = 6;

function InstitutionList({
  network,
  institutions,
  onSelect,
}: {
  network: EducationNetwork;
  institutions: EducationInstitutionSummary[];
  onSelect: (code: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? institutions : institutions.slice(0, VISIBLE);
  return (
    <div className="education-institutions">
      <p className="education-list-title">
        {NETWORK_LIST_TITLE[network]}
        <span>{formatCount(institutions.length)}</span>
      </p>
      <ol>
        {shown.map((item) => (
          <li key={item.code}>
            <button
              type="button"
              className="education-institution"
              onClick={() => onSelect(item.code)}
            >
              <span className="education-institution-name">
                {institutionName(item.name, item.acronym)}
              </span>
              <strong>{formatCount(item.enrollment)}</strong>
              <span className="education-institution-meta">
                {[
                  item.acronym,
                  CATEGORY_LABEL[item.category],
                  ORGANIZATION_LABEL[item.organization],
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
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
  network,
  data,
  loading,
  error,
  territory,
  onClose,
  onDrillDown,
  onSelectInstitution,
}: {
  network: EducationNetwork;
  data?: EducationTerritory;
  loading: boolean;
  error: Error | null;
  territory?: MapFeatureProperties;
  onClose?: () => void;
  onDrillDown: (code: string, name: string) => void;
  onSelectInstitution: (code: number) => void;
}) {
  const empty = data && data.year === null;
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
      </dl>
      {data?.courses != null && (
        <dl className="indicator-list territory-details">
          <div className="indicator-row">
            <dt className="indicator-label">Cursos de graduação presenciais</dt>
            <dd className="indicator-value">{formatCount(data.courses)}</dd>
          </div>
        </dl>
      )}
      {territory?.level === 'state' && onClose && (
        <DrillDownButton onClick={() => onDrillDown(territory.ibgeCode, territory.name)} />
      )}
      {data && data.institutions.length > 0 && (
        <InstitutionList
          key={`${data.code}:${data.year}:${network}`}
          network={network}
          institutions={data.institutions}
          onSelect={onSelectInstitution}
        />
      )}
      <p className="source-note">
        Graduação presencial, pelo município onde o curso é oferecido. Censo da Educação Superior
        (INEP).
      </p>
    </section>
  );
}
