import { useState } from 'react';
import type { EducationInstitutionDetail } from '@/api/types';
import { AnimatedText } from '@/components/AnimatedText';
import { ErrorMessage } from '@/components/Feedback';
import {
  CATEGORY_LABEL,
  ORGANIZATION_LABEL,
  formatCount,
  institutionName,
  plural,
} from './education';

const VISIBLE = 5;

export function InstitutionDetail({
  data,
  error,
  onClose,
  onSelectMunicipality,
}: {
  data?: EducationInstitutionDetail;
  error: Error | null;
  onClose: () => void;
  onSelectMunicipality: (code: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const campuses = data ? (expanded ? data.campuses : data.campuses.slice(0, VISIBLE)) : [];
  const rows = data
    ? [
        ...(data.faculty !== null
          ? [{ label: 'Docentes', value: formatCount(data.faculty), title: undefined }]
          : []),
        ...(data.distanceEnrollment > 0
          ? [
              {
                label: 'Matrículas a distância',
                value: formatCount(data.distanceEnrollment),
                title: 'Fora do mapa: o INEP não atribui o ensino a distância a um município',
              },
            ]
          : []),
      ]
    : [];
  return (
    <section className="panel-section territory-detail" aria-label="Instituição selecionada">
      <header className="detail-header">
        <div>
          {data ? (
            <>
              <p className="detail-kicker">
                {CATEGORY_LABEL[data.category]} · {ORGANIZATION_LABEL[data.organization]}
                {data.acronym && ` · ${data.acronym}`}
              </p>
              <AnimatedText
                as="h2"
                className="detail-title"
                text={institutionName(data.name, data.acronym)}
              />
            </>
          ) : (
            <span role="status">{error ? 'Instituição' : 'Carregando instituição…'}</span>
          )}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Fechar instituição"
        >
          ×
        </button>
      </header>
      {error && <ErrorMessage error={error} />}
      {data && (
        <>
          <dl className="featured-indicator">
            <dt className="indicator-label">
              Matrículas presenciais
              <span className="indicator-year">{data.year}</span>
            </dt>
            <AnimatedText
              as="dd"
              mode="number"
              className="featured-value"
              text={formatCount(data.enrollment)}
            />
            <dd className="education-summary">
              {plural(data.courses, 'curso', 'cursos')} ·{' '}
              {plural(data.campuses.length, 'município', 'municípios')}
            </dd>
          </dl>
          {rows.length > 0 && (
            <dl className="indicator-list territory-details">
              {rows.map((row) => (
                <div key={row.label} className="indicator-row" title={row.title}>
                  <dt className="indicator-label">{row.label}</dt>
                  <dd className="indicator-value">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {data.campuses.length > 1 && (
            <div className="education-institutions">
              <ol aria-label="Municípios com cursos presenciais">
                {campuses.map((campus) => (
                  <li key={campus.code}>
                    <button
                      type="button"
                      className="education-institution"
                      onClick={() => onSelectMunicipality(campus.code)}
                    >
                      <span className="education-institution-name">
                        {campus.name}
                        {campus.state && <small>{campus.state}</small>}
                      </span>
                      <strong>{formatCount(campus.enrollment)}</strong>
                    </button>
                  </li>
                ))}
              </ol>
              {data.campuses.length > VISIBLE && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded
                    ? 'Mostrar menos'
                    : `Mostrar todos (${formatCount(data.campuses.length)})`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
