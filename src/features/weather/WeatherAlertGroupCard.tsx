import { useMemo } from 'react';
import { Disclosure } from '@/components/Disclosure';
import { ALERT_STYLES, alertSourceLabel } from './alertStyles';
import type { GroupedStateAlert } from './alertUtils';
import { extractAlertUrls, formatAlertDate } from './alertUtils';

interface WeatherAlertGroupCardProps {
  group: GroupedStateAlert;
  defaultOpen?: boolean;
}

export function WeatherAlertGroupCard({
  group,
  defaultOpen = false,
}: WeatherAlertGroupCardProps) {
  const style = ALERT_STYLES[group.tier] ?? ALERT_STYLES.moderate;

  // Extrai riscos e instruções consolidadas da feature principal
  const { cleanedRisks, cleanedInstructions } = useMemo(() => {
    const risks: string[] = [];
    const instructions: string[] = [];

    for (const r of group.primaryFeature.properties.risks ?? []) {
      const { cleanedText } = extractAlertUrls(r);
      if (cleanedText) risks.push(cleanedText);
    }

    for (const i of group.primaryFeature.properties.instructions ?? []) {
      const { cleanedText } = extractAlertUrls(i);
      if (cleanedText) instructions.push(cleanedText);
    }

    return { cleanedRisks: risks, cleanedInstructions: instructions };
  }, [group.primaryFeature]);

  const titleText = `${group.event} · ${group.count} ${group.count === 1 ? 'município' : 'municípios'}`;

  return (
    <div className="weather-alert-group-item">
      <Disclosure
        defaultOpen={defaultOpen}
        title={
          <span className="weather-alert-title-row">
            <span
              className="weather-alert-indicator-dot"
              style={{
                backgroundColor: style.fillColor,
                borderColor: style.strokeColor,
              }}
              aria-hidden="true"
            />
            <span className="weather-alert-event-name">{titleText}</span>
            <span
              className="weather-alert-severity-badge"
              style={{
                backgroundColor: style.badgeBg,
                borderColor: style.badgeBorder,
                color: style.badgeText,
              }}
            >
              {style.label}
            </span>
            <span className="weather-alert-source-tag">
              {alertSourceLabel(group.provider)}
            </span>
          </span>
        }
      >
        <div className="weather-alert-detail-content">
          {/* Metadados compactos */}
          <div className="weather-alert-compact-meta">
            <span className="alert-meta-item">
              <span className="alert-meta-label">Classificação na fonte:</span>{' '}
              <strong className="alert-meta-value">{group.primaryFeature.properties.severity}</strong>
            </span>
            <span className="alert-meta-separator" aria-hidden="true">
              ·
            </span>
            <span className="alert-meta-item">
              <span className="alert-meta-label">Válido até:</span>{' '}
              <span className="alert-meta-value">
                {formatAlertDate(group.primaryFeature.properties.expires)}
              </span>
            </span>
          </div>

          {/* Municípios afetados em chips interativos que abrem o boletim */}
          {group.municipalities.length > 0 && (
            <div className="weather-alert-municipalities-block">
              <p className="field-label sr-only">Municípios com ocorrência:</p>
              <div className="weather-alert-municipality-chips">
                {group.municipalities.map((muni) =>
                  muni.bulletinUrl ? (
                    <a
                      key={muni.name}
                      href={muni.bulletinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="weather-alert-muni-chip is-link"
                      title={`Abrir boletim oficial de ${muni.name} em nova aba`}
                    >
                      <span className="weather-alert-muni-name">{muni.name}</span>
                      <span className="bulletin-external-icon" aria-hidden="true">
                        ↗
                      </span>
                    </a>
                  ) : (
                    <span key={muni.name} className="weather-alert-muni-chip">
                      <span className="weather-alert-muni-name">{muni.name}</span>
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Riscos consolidados */}
          {cleanedRisks.length > 0 && (
            <div className="weather-alert-risk-list">
              {cleanedRisks.map((risk, index) => (
                <p key={index} className="weather-alert-bullet-text">
                  {risk}
                </p>
              ))}
            </div>
          )}

          {/* Instruções consolidadas */}
          {cleanedInstructions.length > 0 && (
            <div className="weather-alert-instruction-list">
              {cleanedInstructions.map((instruction, index) => (
                <p key={index} className="weather-alert-bullet-text">
                  {instruction}
                </p>
              ))}
            </div>
          )}

          {/* Ações: fallback de boletim oficial apenas quando não houver municípios com link direto */}
          {group.municipalities.length === 0 && group.bulletinUrls.length > 0 && (
            <div className="weather-alert-actions">
              {group.bulletinUrls.map((url, index) => (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="weather-alert-bulletin-action"
                  title="Abrir boletim oficial em nova aba"
                >
                  <span>
                    Ver boletim oficial {group.bulletinUrls.length > 1 ? `(${index + 1})` : ''}
                  </span>
                  <span className="bulletin-external-icon" aria-hidden="true">
                    ↗
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </Disclosure>
    </div>
  );
}

