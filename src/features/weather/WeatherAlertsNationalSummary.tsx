import { useMemo } from 'react';
import type { WeatherAlertFeature } from '@/api/types';
import { ALERT_STYLES } from './alertStyles';
import { getNationalAlertsSummary } from './alertUtils';

interface WeatherAlertsNationalSummaryProps {
  features: WeatherAlertFeature[];
}

export function WeatherAlertsNationalSummary({ features }: WeatherAlertsNationalSummaryProps) {
  const summary = useMemo(() => getNationalAlertsSummary(features), [features]);

  if (summary.totalAlerts === 0) {
    return (
      <div className="weather-alerts-empty-state">
        <p className="source-note">Nenhum aviso meteorológico ou geo-hidrológico ativo no Brasil.</p>
      </div>
    );
  }

  const { totalAlerts, affectedStatesCount, severityDistribution, sources, topStates } = summary;

  return (
    <div className="weather-alerts-national-summary" aria-label="Visão geral dos alertas no Brasil">
      {/* Linha principal com contagem de alertas e estados */}
      <div className="national-summary-header">
        <div className="national-summary-title">
          <span className="national-summary-count">{totalAlerts}</span>
          <span className="national-summary-label">
            {totalAlerts === 1 ? 'aviso ativo' : 'avisos ativos'} em{' '}
            <strong>
              {affectedStatesCount} {affectedStatesCount === 1 ? 'estado' : 'estados'}
            </strong>
          </span>
        </div>

        {/* Badges neutros de fontes presentes */}
        <div className="national-summary-sources" aria-label="Fontes oficiais">
          {sources.inmet > 0 && (
            <span className="weather-alert-source-tag">INMET ({sources.inmet})</span>
          )}
          {sources.cemaden > 0 && (
            <span className="weather-alert-source-tag">CEMADEN ({sources.cemaden})</span>
          )}
        </div>
      </div>

      {/* Distribuição por severidade com dots coloridos e texto acessível */}
      <div className="national-summary-severities" aria-label="Distribuição por severidade">
        {summary.severityDistribution.extreme > 0 && (
          <span className="weather-alert-severity-pill" style={{ borderColor: ALERT_STYLES.extreme.color }}>
            <span
              className="weather-alert-indicator-dot"
              style={{
                backgroundColor: ALERT_STYLES.extreme.fillColor,
                borderColor: ALERT_STYLES.extreme.strokeColor,
              }}
              aria-hidden="true"
            />
            <span className="severity-pill-label">Extremo</span>
            <span className="severity-pill-count">{severityDistribution.extreme}</span>
          </span>
        )}

        {summary.severityDistribution.very_high > 0 && (
          <span className="weather-alert-severity-pill" style={{ borderColor: ALERT_STYLES.very_high.color }}>
            <span
              className="weather-alert-indicator-dot"
              style={{
                backgroundColor: ALERT_STYLES.very_high.fillColor,
                borderColor: ALERT_STYLES.very_high.strokeColor,
              }}
              aria-hidden="true"
            />
            <span className="severity-pill-label">Muito alto</span>
            <span className="severity-pill-count">{severityDistribution.very_high}</span>
          </span>
        )}

        {summary.severityDistribution.high > 0 && (
          <span className="weather-alert-severity-pill" style={{ borderColor: ALERT_STYLES.high.color }}>
            <span
              className="weather-alert-indicator-dot"
              style={{
                backgroundColor: ALERT_STYLES.high.fillColor,
                borderColor: ALERT_STYLES.high.strokeColor,
              }}
              aria-hidden="true"
            />
            <span className="severity-pill-label">Alto</span>
            <span className="severity-pill-count">{severityDistribution.high}</span>
          </span>
        )}

        {summary.severityDistribution.moderate > 0 && (
          <span className="weather-alert-severity-pill" style={{ borderColor: ALERT_STYLES.moderate.color }}>
            <span
              className="weather-alert-indicator-dot"
              style={{
                backgroundColor: ALERT_STYLES.moderate.fillColor,
                borderColor: ALERT_STYLES.moderate.strokeColor,
              }}
              aria-hidden="true"
            />
            <span className="severity-pill-label">Moderado</span>
            <span className="severity-pill-count">{severityDistribution.moderate}</span>
          </span>
        )}
      </div>

      {/* Estados com maior quantidade de ocorrências */}
      {topStates.length > 0 && (
        <div className="national-summary-top-states">
          <span className="top-states-label">Mais ocorrências:</span>
          <span className="top-states-list">
            {topStates.map((s, idx) => (
              <span key={s.uf} className="top-state-item">
                <strong>{s.uf}</strong> ({s.count})
                {idx < topStates.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

