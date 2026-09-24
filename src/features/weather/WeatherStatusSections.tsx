import type { FireMunicipality, WeatherCity } from '@/api/types';
import { formatFireDate } from '@/features/fire/fireStyles';
import { densityColor } from '@/features/fire/fireDensity';
import {
  rainAmount,
  rainColor,
  rainDescription,
  rainBadgeText,
} from '@/features/rainfall/rainScale';
import { ESTIMATE_DESCRIPTION } from './EstimateMark';

export function FireStatusSection({
  fire,
  loading,
  hours = 24,
  highlight = false,
}: {
  fire: FireMunicipality | undefined;
  loading?: boolean;
  hours?: number;
  highlight?: boolean;
}) {
  if (loading && !fire) {
    return (
      <div className={`fire-detail-card ${highlight ? 'is-highlight' : ''}`} role="status">
        <p className="source-note">Consultando focos de calor no INPE…</p>
      </div>
    );
  }

  if (!fire) {
    return (
      <div className={`fire-detail-card ${highlight ? 'is-highlight' : ''}`}>
        <p className="source-note">Dados de focos não disponíveis para este local.</p>
      </div>
    );
  }

  const count24h = Number(
    fire.count24h ?? fire.count24H ?? (fire as unknown as Record<string, unknown>).count_24h ?? 0,
  );
  const count = Number(fire.count ?? 0);
  const hasFocos = count > 0 || count24h > 0;
  const color = densityColor(fire.density);

  return (
    <div className={`fire-detail-card ${highlight ? 'is-highlight' : ''}`}>
      <div className="fire-detail-header">
        <div className="fire-detail-status">
          <span className="fire-layer-dot" style={{ backgroundColor: color }} aria-hidden="true" />
          <strong>
            {hasFocos
              ? `${fire.density != null ? Number(fire.density).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'} focos / 1.000 km²`
              : 'Sem focos ativos'}
          </strong>
        </div>
        <span className={`weather-layer-badge ${hasFocos ? 'badge-fire' : 'badge-neutral'}`}>
          {hasFocos ? `${count24h.toLocaleString('pt-BR')} em 24h` : '0 em 24h'}
        </span>
      </div>

      <div className="fire-metrics-grid">
        <div className="fire-metric">
          <span className="fire-metric-val">{count24h.toLocaleString('pt-BR')}</span>
          <span className="fire-metric-lbl">
            {hours === 24
              ? 'em 24 horas'
              : `em 24h (${count.toLocaleString('pt-BR')} em ${hours}h)`}
          </span>
        </div>
        {fire.areaKm2 != null && (
          <div className="fire-metric">
            <span className="fire-metric-val">
              {Number(fire.areaKm2).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </span>
            <span className="fire-metric-lbl">km² de área</span>
          </div>
        )}
      </div>

      {fire.latestDetectionAt && (
        <p className="fire-latest-note">
          Última detecção: <strong>{formatFireDate(fire.latestDetectionAt)}</strong>
        </p>
      )}

      {!hasFocos && (
        <p className="source-note" style={{ margin: '4px 0 0' }}>
          Nenhuma detecção de calor registrada pelo satélite de referência nas últimas 24h.
        </p>
      )}
    </div>
  );
}

export function RainStatusSection({
  city,
  loading,
  highlight = false,
}: {
  city: WeatherCity | undefined;
  loading?: boolean;
  highlight?: boolean;
}) {
  if (loading && !city) {
    return (
      <div className={`rain-detail-card ${highlight ? 'is-highlight' : ''}`} role="status">
        <p className="source-note">Consultando dados de chuva…</p>
      </div>
    );
  }

  if (!city) {
    return (
      <div className={`rain-detail-card ${highlight ? 'is-highlight' : ''}`}>
        <p className="source-note">Dados de chuva não disponíveis para este local.</p>
      </div>
    );
  }

  const rainMm = rainAmount(city);
  const hasRain = rainMm > 0;
  const color = rainColor(rainMm);
  const badgeText = rainBadgeText(rainMm);
  const desc = rainDescription(rainMm);
  const prob = city.precipitationProbabilityPct;

  return (
    <div className={`rain-detail-card ${highlight ? 'is-highlight' : ''}`}>
      <div className="rain-detail-header">
        <div className="rain-detail-status">
          <span className="rain-layer-dot" style={{ backgroundColor: color }} aria-hidden="true" />
          <strong>{desc}</strong>
        </div>
        <span className={`weather-layer-badge ${hasRain ? 'badge-rain' : 'badge-neutral'}`}>
          {badgeText}
        </span>
      </div>

      <div className="rain-metrics-grid">
        <div className="rain-metric">
          <span className="rain-metric-val">
            {Number(rainMm).toLocaleString('pt-BR', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{' '}
            mm
          </span>
          <span className="rain-metric-lbl">acumulado em 24h</span>
        </div>
        {prob != null && (
          <div className="rain-metric">
            <span className="rain-metric-val">{prob}%</span>
            <span className="rain-metric-lbl">probabilidade de chuva</span>
          </div>
        )}
      </div>

      {city.forecast &&
        city.forecast.length > 0 &&
        city.forecast[0]?.precipitationSumMm != null && (
          <p className="rain-forecast-note">
            Previsão para hoje:{' '}
            <strong>
              {Number(city.forecast[0].precipitationSumMm).toLocaleString('pt-BR', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{' '}
              mm
            </strong>
            {city.forecast[0].precipitationProbabilityPct != null
              ? ` (${city.forecast[0].precipitationProbabilityPct}% de chance)`
              : ''}
          </p>
        )}

      {!hasRain && (
        <p className="source-note" style={{ margin: '4px 0 0' }}>
          Sem volume significativo de chuva acumulado nas últimas 24h.
        </p>
      )}
      {city.isInferred && (
        <p className="source-note" style={{ margin: '4px 0 0' }}>
          ≈ {ESTIMATE_DESCRIPTION}.
        </p>
      )}
    </div>
  );
}
