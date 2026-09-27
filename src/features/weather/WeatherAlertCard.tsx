import { useMemo } from 'react';
import type { WeatherAlertFeature } from '@/api/types';
import { Disclosure } from '@/components/Disclosure';
import { alertSourceLabel, getAlertStyle } from './alertStyles';
import { extractAlertUrls, formatAlertDate } from './alertUtils';

interface WeatherAlertCardProps {
  feature: WeatherAlertFeature;
  showLocation?: boolean;
  defaultOpen?: boolean;
}

export function WeatherAlertCard({
  feature,
  showLocation = true,
  defaultOpen = false,
}: WeatherAlertCardProps) {
  const { properties } = feature;
  const style = getAlertStyle(properties);

  const { cleanedRisks, cleanedInstructions, bulletinUrls } = useMemo(() => {
    const urls: string[] = [];
    const risks: string[] = [];
    const instructions: string[] = [];

    for (const r of properties.risks ?? []) {
      const { cleanedText, urls: rUrls } = extractAlertUrls(r);
      if (cleanedText) risks.push(cleanedText);
      urls.push(...rUrls);
    }

    for (const i of properties.instructions ?? []) {
      const { cleanedText, urls: iUrls } = extractAlertUrls(i);
      if (cleanedText) instructions.push(cleanedText);
      urls.push(...iUrls);
    }

    const uniqueUrls = Array.from(new Set(urls));
    return {
      cleanedRisks: risks,
      cleanedInstructions: instructions,
      bulletinUrls: uniqueUrls,
    };
  }, [properties.risks, properties.instructions]);

  const locationText = showLocation && properties.description ? properties.description : null;

  return (
    <div className="weather-alert-card-item">
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
            <span className="weather-alert-event-name">
              {properties.event}
              {locationText && (
                <span className="weather-alert-location-inline"> — {locationText}</span>
              )}
            </span>
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
              {alertSourceLabel(properties.provider)}
            </span>
          </span>
        }
      >
        <div className="weather-alert-detail-content">
          {}
          <div className="weather-alert-compact-meta">
            <span className="alert-meta-item">
              <span className="alert-meta-label">Classificação na fonte:</span>{' '}
              <strong className="alert-meta-value">{properties.severity}</strong>
            </span>
            <span className="alert-meta-separator" aria-hidden="true">
              ·
            </span>
            <span className="alert-meta-item">
              <span className="alert-meta-label">Válido até:</span>{' '}
              <span className="alert-meta-value">{formatAlertDate(properties.expires)}</span>
            </span>
          </div>

          {}
          {cleanedRisks.length > 0 && (
            <div className="weather-alert-risk-list">
              {cleanedRisks.map((risk, index) => (
                <p key={index} className="weather-alert-bullet-text">
                  {risk}
                </p>
              ))}
            </div>
          )}

          {}
          {cleanedInstructions.length > 0 && (
            <div className="weather-alert-instruction-list">
              {cleanedInstructions.map((instruction, index) => (
                <p key={index} className="weather-alert-bullet-text">
                  {instruction}
                </p>
              ))}
            </div>
          )}

          {}
          {bulletinUrls.length > 0 && (
            <div className="weather-alert-actions">
              {bulletinUrls.map((url, index) => (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="weather-alert-bulletin-action"
                  title="Abrir boletim oficial em nova aba"
                >
                  <span>Ver boletim oficial</span>
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
