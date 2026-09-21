import { useWeatherAlerts, useWeatherSources } from '@/api/queries';
import type {
  FireHotspotCollection,
  WeatherAlertCollection,
  WeatherCurrentResponse,
} from '@/api/types';
import { Disclosure } from '@/components/Disclosure';
import { ErrorMessage } from '@/components/Feedback';
import { formatRelativeTime } from '@/lib/format';
import { getAlertStyle } from './alertStyles';
import { SourceStatusPanel } from './SourceStatusPanel';

export interface WeatherOptionsProps {
  showAlerts: boolean;
  onToggleAlerts: (show: boolean) => void;
  showHydrography?: boolean;
  onToggleHydrography?: (show: boolean) => void;
  hydrographyPartial?: boolean;
  showFireHotspots?: boolean;
  onToggleFireHotspots?: (show: boolean) => void;
  fireHotspotsLoading?: boolean;
  fireHotspots?: FireHotspotCollection;
  fireHotspotsError?: boolean;
  code: string | null;
  current: WeatherCurrentResponse | undefined;
  error: unknown;
  loading: boolean;
  onRefresh: () => void;
  alertsData?: WeatherAlertCollection;
  alertsPending?: boolean;
  /** Fontes auxiliares só entram depois da primeira carga meteorológica. */
  weatherReady?: boolean;
  scopeName?: string;
}

export function WeatherOptions({
  showAlerts,
  onToggleAlerts,
  showHydrography,
  onToggleHydrography,
  hydrographyPartial,
  showFireHotspots,
  onToggleFireHotspots,
  fireHotspotsLoading,
  fireHotspots,
  fireHotspotsError,
  code,
  current,
  error,
  loading,
  onRefresh,
  alertsData,
  alertsPending,
  weatherReady = true,
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

  return (
    <section
      className="panel-section weather-options-section"
      aria-label="Camadas e fontes de clima"
    >
      {/* Grupo Unificado de Camadas Interativas */}
      <div className="weather-layers-panel">
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
                  hydrographyPartial ? 'badge-warning' : 'badge-hydro'
                }`}
              >
                {hydrographyPartial ? 'Parcial' : 'Ativo'}
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
          <span className="weather-sync-dot" aria-hidden="true" />
          <span>
            {current
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
          {loading ? 'Atualizando…' : 'Atualizar dados'}
        </button>
      </div>
      {error != null && (
        <p className="weather-error-note">Não foi possível sincronizar todos os dados deste recorte.</p>
      )}

      {/* Detalhes de Metodologia e Fontes (Apenas sob demanda) */}
      <Disclosure title="Fontes e metodologia" className="weather-sources-disclosure">
        <ul className="weather-methodology-list">
          <li className="weather-methodology-item">
            <strong>Focos de calor:</strong>{' '}
            <a href="https://data.inpe.br/queimadas/" target="_blank" rel="noreferrer">
              INPE / Queimadas
            </a>
            . Deteções por satélite nas últimas 24h normalizadas por área territorial.
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
        <WeatherSources enabled={weatherReady} />
      </Disclosure>
    </section>
  );
}

function WeatherSources({ enabled }: { enabled: boolean }) {
  const sources = useWeatherSources(enabled);
  return (
    <>
      <SourceStatusPanel sources={sources.data} />
      {sources.error && <p className="source-note">Estado da fonte de avisos indisponível.</p>}
    </>
  );
}
