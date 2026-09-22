import { useMemo } from 'react';
import { useWeatherAlerts } from '@/api/queries';
import type {
  FireHotspotCollection,
  WeatherAlertCollection,
  WeatherCurrentResponse,
} from '@/api/types';
import { Disclosure } from '@/components/Disclosure';
import { describeError, ErrorMessage } from '@/components/Feedback';
import { formatRelativeTime } from '@/lib/format';
import { getAlertStyle } from './alertStyles';

export interface WeatherOptionsProps {
  showAlerts: boolean;
  onToggleAlerts: (show: boolean) => void;
  showClimate?: boolean;
  onToggleClimate?: (show: boolean) => void;
  minTemperature?: number;
  maxTemperature?: number;
  showHydrography?: boolean;
  onToggleHydrography?: (show: boolean) => void;
  hydrographyPartial?: boolean;
  hydrographyError?: boolean;
  showFireHotspots?: boolean;
  onToggleFireHotspots?: (show: boolean) => void;
  fireHotspotsLoading?: boolean;
  fireHotspots?: FireHotspotCollection;
  fireHotspotsError?: boolean;
  showRainfall?: boolean;
  onToggleRainfall?: (show: boolean) => void;
  maxRainfall?: number;
  code: string | null;
  current: WeatherCurrentResponse | undefined;
  /** Falha da camada temática ativa (clima, chuva ou focos), exibida no rodapé. */
  error: unknown;
  loading: boolean;
  onRefresh: () => void;
  alertsData?: WeatherAlertCollection;
  alertsPending?: boolean;
  scopeName?: string;
}

export function WeatherOptions({
  showAlerts,
  onToggleAlerts,
  showClimate,
  onToggleClimate,
  minTemperature,
  maxTemperature,
  showHydrography,
  onToggleHydrography,
  hydrographyPartial,
  hydrographyError = false,
  showFireHotspots,
  onToggleFireHotspots,
  fireHotspotsLoading,
  fireHotspots,
  fireHotspotsError,
  showRainfall,
  onToggleRainfall,
  maxRainfall,
  code,
  current,
  error,
  loading,
  onRefresh,
  alertsData,
  alertsPending,
  scopeName,
}: WeatherOptionsProps) {
  const fallbackAlerts = useWeatherAlerts(showAlerts && alertsPending === undefined && !alertsData);

  const activeAlerts = alertsData ?? fallbackAlerts.data;
  const isAlertsPending = alertsPending ?? fallbackAlerts.isPending;
  const alertsError = fallbackAlerts.error;

  const relevant = activeAlerts?.features.filter(
    (alert) =>
      !code ||
      Boolean(
        alert.properties.affectedIbgeCodes?.some((affected) =>
          code.length === 2 ? affected.startsWith(code) : affected === code,
        ),
      ),
  );

  const calculatedRange = useMemo(() => {
    if (minTemperature != null && maxTemperature != null) {
      return { min: minTemperature, max: maxTemperature };
    }
    const temps = (current?.cities ?? [])
      .map((c) => c.temperatureC)
      .filter((t): t is number => t != null && Number.isFinite(t));
    if (!temps.length) return null;
    return {
      min: Math.min(...temps),
      max: Math.max(...temps),
    };
  }, [minTemperature, maxTemperature, current?.cities]);

  return (
    <section
      className="panel-section weather-options-section"
      aria-label="Camadas e fontes de clima"
    >
      {/* Grupo Unificado de Camadas Interativas */}
      <div className="weather-layers-panel">
        {/* Camada: Clima */}
        {onToggleClimate && (
          <div className="weather-layer-card">
            <label className="weather-layer-label weather-toggle">
              <input
                type="checkbox"
                checked={showClimate ?? false}
                onChange={(event) => onToggleClimate(event.target.checked)}
              />
              <div className="weather-layer-title">
                <span>Clima</span>
                <span className="weather-layer-source">Open-Meteo</span>
              </div>
            </label>
            {showClimate && error != null && !calculatedRange && (
              <span className="weather-layer-badge badge-error">Indisponível</span>
            )}
            {showClimate && (error == null || calculatedRange) && (
              <span className="weather-layer-badge badge-climate">
                {calculatedRange
                  ? (Math.round(calculatedRange.min) || 0) ===
                    (Math.round(calculatedRange.max) || 0)
                    ? `${Math.round(calculatedRange.min) || 0}°C · ${scopeName ?? 'Brasil'}`
                    : `${Math.round(calculatedRange.min) || 0} - ${Math.round(calculatedRange.max) || 0}°C · ${scopeName ?? 'Brasil'}`
                  : 'Ativo'}
              </span>
            )}
          </div>
        )}

        {/* Camada: Quantidade de Chuva */}
        {onToggleRainfall && (
          <div className="weather-layer-card">
            <label className="weather-layer-label weather-toggle">
              <input
                type="checkbox"
                checked={showRainfall ?? false}
                onChange={(event) => onToggleRainfall(event.target.checked)}
              />
              <div className="weather-layer-title">
                <span>Quantidade de chuva</span>
                <span className="weather-layer-source">Open-Meteo / 24h</span>
              </div>
            </label>
            {showRainfall && error != null && !current && (
              <span className="weather-layer-badge badge-error">Indisponível</span>
            )}
            {showRainfall && (error == null || current) && (
              <span className="weather-layer-badge badge-rain">
                {maxRainfall != null && maxRainfall > 0
                  ? `Máx: ${maxRainfall.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mm`
                  : 'Ativo'}
              </span>
            )}
          </div>
        )}

        {/* Camada: Focos de Calor */}
        {onToggleFireHotspots && (
          <div className="weather-layer-card">
            <label className="weather-layer-label weather-toggle">
              <input
                type="checkbox"
                checked={showFireHotspots ?? false}
                onChange={(event) => onToggleFireHotspots(event.target.checked)}
              />
              <div className="weather-layer-title">
                <span>Focos de calor</span>
                <span className="weather-layer-source">INPE / Queimadas</span>
              </div>
            </label>
            {showFireHotspots && (
              <span
                className={`weather-layer-badge ${
                  fireHotspotsError ? 'badge-error' : 'badge-fire'
                }`}
              >
                {fireHotspotsError
                  ? 'Indisponível'
                  : fireHotspotsLoading && !fireHotspots
                    ? 'Carregando…'
                    : fireHotspots
                      ? `${fireHotspots.metadata.hotspotCount.toLocaleString('pt-BR')} focos · ${scopeName ?? 'Brasil'}`
                      : 'Ativo'}
              </span>
            )}
          </div>
        )}

        {/* Camada: Avisos Meteorológicos */}
        <div className="weather-layer-card">
          <label className="weather-layer-label weather-toggle">
            <input
              type="checkbox"
              checked={showAlerts}
              onChange={(event) => onToggleAlerts(event.target.checked)}
            />
            <div className="weather-layer-title">
              <span>Avisos meteorológicos</span>
              <span className="weather-layer-source">INMET</span>
            </div>
          </label>
          {showAlerts && (
            <span
              className={`weather-layer-badge ${
                relevant && relevant.length > 0 ? 'badge-alert' : 'badge-neutral'
              }`}
            >
              {isAlertsPending && !activeAlerts
                ? 'Consultando…'
                : relevant && relevant.length > 0
                  ? `${relevant.length} ${relevant.length === 1 ? 'aviso ativo' : 'avisos ativos'}`
                  : 'Sem avisos'}
            </span>
          )}
        </div>

        {/* Camada: Rios e Lagos */}
        {onToggleHydrography && (
          <div className="weather-layer-card">
            <label className="weather-layer-label weather-toggle">
              <input
                type="checkbox"
                checked={showHydrography ?? false}
                onChange={(event) => onToggleHydrography(event.target.checked)}
              />
              <div className="weather-layer-title">
                <span>Rios e corpos d'água</span>
                <span className="weather-layer-source">ANA / SNIRH</span>
              </div>
            </label>
            {showHydrography && (
              <span
                className={`weather-layer-badge ${
                  hydrographyError
                    ? 'badge-error'
                    : hydrographyPartial
                      ? 'badge-warning'
                      : 'badge-hydro'
                }`}
              >
                {hydrographyError ? 'Indisponível' : hydrographyPartial ? 'Parcial' : 'Ativo'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Alertas Ativos no Território */}
      {showAlerts && (
        <div className="weather-alerts-container">
          {alertsError && <ErrorMessage error={alertsError} />}
          {relevant && relevant.length > 0 && (
            <div className="weather-alert-list">
              {relevant.map(({ id, properties }) => {
                const style = getAlertStyle(properties);
                return (
                  <Disclosure
                    key={id}
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
                        <span>{properties.event}</span>
                      </span>
                    }
                  >
                    <div className="weather-alert-meta">
                      <span
                        className="weather-alert-severity-badge"
                        style={{
                          backgroundColor: style.badgeBg,
                          borderColor: style.badgeBorder,
                          color: style.badgeText,
                        }}
                      >
                        {properties.severity}
                      </span>
                      <span className="source-note">
                        até{' '}
                        {properties.expires && !Number.isNaN(Date.parse(properties.expires))
                          ? new Date(properties.expires).toLocaleString('pt-BR')
                          : '—'}
                      </span>
                    </div>
                    {(properties.risks ?? []).map((risk) => (
                      <p className="source-note" key={risk}>
                        {risk}
                      </p>
                    ))}
                    {(properties.instructions ?? []).map((instruction) => (
                      <p className="source-note" key={instruction}>
                        {instruction}
                      </p>
                    ))}
                  </Disclosure>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Rodapé Inteligente e Compacto */}
      <div className="weather-footer-bar">
        <div className="weather-sync-status">
          <span
            className={`weather-sync-dot ${loading ? 'syncing' : error != null ? 'failed' : ''}`}
            aria-hidden="true"
          />
          <span>
            {loading
              ? 'Sincronizando dados…'
              : error != null
                ? 'Sem atualização'
                : current
                  ? `Atualizado ${formatRelativeTime(current.fetchedAt)}`
                  : 'Sincronizado'}
          </span>
        </div>
        <button
          className="weather-refresh-btn"
          onClick={onRefresh}
          disabled={loading}
          title="Recarregar dados meteorológicos e de satélite"
        >
          {loading ? 'Atualizando…' : error != null ? 'Tentar novamente' : 'Atualizar dados'}
        </button>
      </div>
      {error != null && <LayerErrorNote error={error} />}

      {/* Detalhes de Metodologia e Fontes (Apenas sob demanda) */}
      <Disclosure title="Fontes e metodologia" className="weather-sources-disclosure">
        <ul className="weather-methodology-list">
          <li className="weather-methodology-item">
            <strong>Clima e temperatura:</strong>{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>
            . Modelos numéricos de alta resolução e estações meteorológicas em tempo real.
          </li>
          <li className="weather-methodology-item">
            <strong>Focos de calor:</strong>{' '}
            <a href="https://data.inpe.br/queimadas/" target="_blank" rel="noreferrer">
              INPE / Queimadas
            </a>
            . Deteções por satélite nas últimas 24h normalizadas por área territorial.
          </li>
          <li className="weather-methodology-item">
            <strong>Quantidade de chuva:</strong>{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>
            . Precipitação acumulada em 24h e probabilidade estimada por modelo numérico e estações
            de superfície.
          </li>
          <li className="weather-methodology-item">
            <strong>Avisos meteorológicos:</strong>{' '}
            <a href="https://portal.inmet.gov.br/" target="_blank" rel="noreferrer">
              INMET
            </a>
            . Severidades e instruções oficiais vigentes.
          </li>
          <li className="weather-methodology-item">
            <strong>Hidrografia:</strong>{' '}
            <a href="https://www.snirh.gov.br/" target="_blank" rel="noreferrer">
              ANA / SNIRH
            </a>
            . Cursos e massas d'água principais.
          </li>
          <li className="weather-methodology-item">
            <strong>Clima e previsão:</strong>{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>
            . Modelos numéricos de alta resolução e estações de superfície.
          </li>
        </ul>
      </Disclosure>
    </section>
  );
}

/** A causa real da falha (a mensagem do backend) e o que acontece a seguir. */
function LayerErrorNote({ error }: { error: unknown }) {
  const { message, hint } = describeError(error);
  return (
    <p className="weather-error-note" role="status">
      {message}
      {hint && <span className="weather-error-hint">{hint}</span>}
    </p>
  );
}
