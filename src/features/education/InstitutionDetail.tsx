import { useState } from 'react';
import type { EducationInstitutionDetail } from '@/api/types';
import { AnimatedText } from '@/components/AnimatedText';
import { ErrorMessage } from '@/components/Feedback';
import { CATEGORY_LABEL, ORGANIZATION_LABEL, formatCount, institutionName } from './education';

const VISIBLE = 8;

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
        { label: 'Cursos de graduação presenciais', value: formatCount(data.courses) },
        { label: 'Municípios com oferta', value: formatCount(data.campuses.length) },
        ...(data.distanceEnrollment > 0
          ? [{ label: 'Matrículas a distância', value: formatCount(data.distanceEnrollment) }]
          : []),
        ...(data.faculty !== null
          ? [{ label: 'Docentes em exercício', value: formatCount(data.faculty) }]
          : []),
        ...(data.staff !== null
          ? [{ label: 'Técnicos administrativos', value: formatCount(data.staff) }]
          : []),
        ...(data.seat
          ? [
              {
                label: 'Sede',
                value: `${data.seat.name}${data.seat.state ? ` · ${data.seat.state}` : ''}`,
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
          </dl>
          <dl className="indicator-list territory-details">
            {rows.map((row) => (
              <div key={row.label} className="indicator-row">
                <dt className="indicator-label">{row.label}</dt>
                <dd className="indicator-value">{row.value}</dd>
              </div>
            ))}
          </dl>
          {data.campuses.length > 0 && (
            <div className="education-institutions">
              <p className="education-list-title">Onde oferece cursos presenciais</p>
              <ol>
                {campuses.map((campus) => (
                  <li key={campus.code}>
                    <button
                      type="button"
                      className="education-institution"
                      onClick={() => onSelectMunicipality(campus.code)}
                    >
                      <span className="education-institution-name">
                        {campus.name}
                        {campus.state && ` · ${campus.state}`}
                      </span>
                      <strong>{formatCount(campus.enrollment)}</strong>
                      <span className="education-institution-meta">
                        {campus.courses === 1 ? '1 curso' : `${formatCount(campus.courses)} cursos`}
                      </span>
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
          <p className="source-note">
            Docentes e técnicos de toda a instituição. Matrículas a distância contam só no total: o
            INEP não as atribui a um município.
          </p>
        </>
      )}
    </section>
  );
}
