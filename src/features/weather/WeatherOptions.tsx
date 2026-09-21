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
import { formatFireDate } from '@/features/fire/fireStyles';

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
}: WeatherOptionsProps) {
  const fallbackAlerts = useWeatherAlerts(showAlerts && alertsPending === undefined && !alertsData);

  const activeAlerts = alertsData ?? fallbackAlerts.data;
  const isAlertsPending = alertsPending ?? fallbackAlerts.isPending;
  const alertsError = fallbackAlerts.error;

  const relevant = activeAlerts?.features.filter(
    (alert) =>
      !code ||
      alert.properties.affectedIbgeCodes.some((affected) =>
        code.length === 2 ? affected.startsWith(code) : affected === code,
      ),
  );

  return (
    <section
      className="panel-section weather-options-section"
      aria-label="Avisos e fontes de clima"
    >
      {/* Quando houver avisos e o checkbox estiver ativo, os avisos ficam SEMPRE visíveis diretamente no painel */}
      {showAlerts && (
        <div className="weather-alerts-container">
          {alertsError && <ErrorMessage error={alertsError} />}
          {isAlertsPending && !activeAlerts && (
            <p className="source-note" role="status">
              Consultando avisos…
            </p>
          )}
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
                        até {new Date(properties.expires).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {properties.risks.map((risk) => (
                      <p className="source-note" key={risk}>
                        {risk}
                      </p>
                    ))}
                    {properties.instructions.map((instruction) => (
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

      {showFireHotspots && (
        <p className="fire-layer-status" role="status">
          <span className="fire-layer-dot" aria-hidden="true" />
          {fireHotspotsError
            ? 'Focos indisponíveis'
            : !fireHotspots
              ? 'Carregando focos…'
              : fireHotspots?.metadata.status === 'stale'
                ? 'Focos · dados anteriores'
                : `Focos de calor · ${fireHotspots?.metadata.hours ?? 24}h`}
        </p>
      )}
      {/* O checkselector de ligar/desligar avisos e camada de rios/lagos fica discretamente dentro de Camadas e fontes */}
      <Disclosure title="Camadas e fontes" className="weather-sources-disclosure">
        <div className="weather-toggles-group">
          <label className="weather-toggle">
            <input
              type="checkbox"
              checked={showAlerts}
              onChange={(event) => onToggleAlerts(event.target.checked)}
            />{' '}
            Avisos do INMET no mapa
          </label>
          {onToggleHydrography && (
            <label className="weather-toggle">
              <input
                type="checkbox"
                checked={showHydrography ?? false}
                onChange={(event) => onToggleHydrography(event.target.checked)}
              />{' '}
              Rios e lagos no mapa (ANA)
            </label>
          )}
          {onToggleFireHotspots && (
            <label className="weather-toggle">
              <input
                type="checkbox"
                checked={showFireHotspots ?? false}
                onChange={(event) => onToggleFireHotspots(event.target.checked)}
              />{' '}
              Focos de calor (INPE)
              {fireHotspotsLoading && (
                <span className="hydro-spinner-inline" aria-label="Carregando focos de incêndio" />
              )}
            </label>
          )}
        </div>
        <p className="source-note">
          Hidrografia oficial:{' '}
          <a href="https://www.snirh.gov.br/" target="_blank" rel="noreferrer">
            ANA / SNIRH
          </a>
          . Grandes rios e corpos hídricos.
          {hydrographyPartial && ' Alguns elementos estão temporariamente indisponíveis.'}
        </p>
        {showFireHotspots && (
          <div className="fire-source-details" role="status">
            {fireHotspotsError ? (
              <p className="source-note">
                Focos temporariamente indisponíveis
                {fireHotspots ? ' · última consulta preservada' : ''}.
              </p>
            ) : (
              fireHotspots && (
                <p className="source-note">
                  {fireHotspots.metadata.hotspotCount.toLocaleString('pt-BR')} detecções no Brasil
                  nas últimas {fireHotspots.metadata.hours}h
                  {fireHotspots.metadata.status === 'stale' ? ' · dados anteriores' : ''}.
                </p>
              )
            )}
            <p className="source-note">
              <a href="https://data.inpe.br/queimadas/" target="_blank" rel="noreferrer">
                INPE / Programa Queimadas
              </a>
              {fireHotspots
                ? ` · consultado ${formatRelativeTime(fireHotspots.metadata.fetchedAt)}`
                : ''}
              . Atualização automática a cada 10 min enquanto a camada estiver ativa.
            </p>
            {fireHotspots?.metadata.latestDetectionAt && (
              <p className="source-note">
                Última detecção: {formatFireDate(fireHotspots.metadata.latestDetectionAt)}.
              </p>
            )}
            <p className="source-note">
              Densidade por 1.000 km² calculada sobre a malha original do IBGE. Focos detectados por
              satélite; uma área pode ser registrada mais de uma vez. A detecção não confirma que o
              fogo continua ativo e não representa área queimada.
            </p>
          </div>
        )}
        <p className="source-note">
          Condições e previsão:{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
          . Estimativas de modelos meteorológicos
          {current ? ` · consultado ${formatRelativeTime(current.fetchedAt)}` : ''}.
        </p>
        <WeatherSources enabled={weatherReady} />
        {error != null && (
          <p className="source-note">Não foi possível atualizar todo o clima deste recorte.</p>
        )}
        <button className="text-button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Atualizando…' : 'Atualizar dados'}
        </button>
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
