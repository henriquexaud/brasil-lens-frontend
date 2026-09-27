import { useMemo } from 'react';
import type { WeatherAlertCollection, WeatherCurrentResponse } from '@/api/types';
import { Disclosure } from '@/components/Disclosure';
import { describeError, ErrorMessage } from '@/components/Feedback';
import { formatRelativeTime } from '@/lib/format';
import { WeatherAlertCard } from './WeatherAlertCard';
import { WeatherAlertGroupCard } from './WeatherAlertGroupCard';
import { WeatherAlertsNationalSummary } from './WeatherAlertsNationalSummary';
import { IBGE_UF_MAP, UF_NAMES, groupStateAlerts, partitionMunicipalityAlerts } from './alertUtils';

export interface WeatherOptionsProps {
  showAlerts: boolean;
  onToggleAlerts: (show: boolean) => void;
  showHydrography?: boolean;
  onToggleHydrography?: (show: boolean) => void;
  hydrographyPartial?: boolean;
  hydrographyError?: boolean;
  code: string | null;
  current: WeatherCurrentResponse | undefined;
  error: unknown;
  loading: boolean;
  onRefresh: () => void;
  alertsData: WeatherAlertCollection | undefined;
  alertsPending: boolean;
  alertsError: unknown;
  scopeName?: string;
}

export function WeatherOptions({
  showAlerts,
  onToggleAlerts,
  showHydrography,
  onToggleHydrography,
  hydrographyPartial,
  hydrographyError = false,
  code,
  current,
  error,
  loading,
  onRefresh,
  alertsData,
  alertsPending,
  alertsError,
  scopeName,
}: WeatherOptionsProps) {
  const territoryLevel = code?.length === 7 ? 'municipality' : code ? 'state' : 'national';
  const stateCode = code?.slice(0, 2) ?? null;
  const municipalityCode = territoryLevel === 'municipality' ? code : null;
  const stateUf = stateCode ? IBGE_UF_MAP[stateCode] : undefined;
  const stateName = scopeName ?? (stateUf ? UF_NAMES[stateUf] : undefined);

  const groupedStateAlerts = useMemo(() => {
    if (territoryLevel !== 'state' || !stateCode || !alertsData?.features) {
      return [];
    }
    return groupStateAlerts(alertsData.features, stateCode);
  }, [territoryLevel, stateCode, alertsData?.features]);

  const { localAlerts, otherStateAlerts } = useMemo(() => {
    if (
      territoryLevel !== 'municipality' ||
      !municipalityCode ||
      !stateCode ||
      !alertsData?.features
    ) {
      return { localAlerts: [], otherStateAlerts: [] };
    }
    return partitionMunicipalityAlerts(alertsData.features, municipalityCode, stateCode);
  }, [territoryLevel, municipalityCode, stateCode, alertsData?.features]);

  const relevantCount = useMemo(() => {
    if (!alertsData?.features) return 0;
    if (territoryLevel === 'national') {
      return alertsData.features.length;
    }
    if (territoryLevel === 'state') {
      return alertsData.features.filter((a) =>
        a.properties.affectedIbgeCodes?.some(
          (c) => stateCode && (c.startsWith(stateCode) || c === stateCode),
        ),
      ).length;
    }
    return localAlerts.length;
  }, [territoryLevel, alertsData?.features, stateCode, localAlerts.length]);

  return (
    <section
      className="panel-section weather-options-section"
      aria-label="Camadas e fontes de clima"
    >
      {}
      <div className="weather-layers-panel">
        {}
        <div className="weather-layer-card">
          <label className="weather-layer-label weather-toggle">
            <input
              type="checkbox"
              checked={showAlerts}
              onChange={(event) => onToggleAlerts(event.target.checked)}
            />
            <div className="weather-layer-title">
              <span>Alertas</span>
              <span className="weather-layer-source">INMET · CEMADEN</span>
            </div>
          </label>
          {showAlerts && (
            <span
              className={`weather-layer-badge ${
                relevantCount > 0 ? 'badge-alert' : 'badge-neutral'
              }`}
            >
              {alertsPending && !alertsData
                ? 'Consultando…'
                : relevantCount > 0
                  ? `${relevantCount} ${relevantCount === 1 ? 'alerta ativo' : 'alertas ativos'}`
                  : 'Sem alertas'}
            </span>
          )}
        </div>

        {}
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

      {}
      {showAlerts && (
        <div className="weather-alerts-container">
          {alertsError != null && <ErrorMessage error={alertsError} />}

          {}
          {territoryLevel === 'national' && (
            <WeatherAlertsNationalSummary features={alertsData?.features ?? []} />
          )}

          {}
          {territoryLevel === 'state' && (
            <div className="weather-alert-state-view">
              {groupedStateAlerts.length > 0 ? (
                <div className="weather-alert-list">
                  {groupedStateAlerts.map((group) =>
                    group.isGroup ? (
                      <WeatherAlertGroupCard key={group.id} group={group} />
                    ) : (
                      <WeatherAlertCard
                        key={group.id}
                        feature={group.primaryFeature}
                        showLocation={true}
                      />
                    ),
                  )}
                </div>
              ) : (
                <div className="weather-alerts-empty-state">
                  <p className="source-note">
                    Nenhum aviso ativo em {stateName ?? stateUf ?? 'neste estado'}.
                  </p>
                </div>
              )}
            </div>
          )}

          {}
          {territoryLevel === 'municipality' && (
            <div className="weather-alert-municipality-view">
              <div className="weather-alert-section">
                <div className="weather-alert-section-title">
                  <span>Neste município</span>
                  {localAlerts.length > 0 && (
                    <span className="weather-alert-section-pill">{localAlerts.length}</span>
                  )}
                </div>
                {localAlerts.length > 0 ? (
                  <div className="weather-alert-list">
                    {localAlerts.map((feature) => (
                      <WeatherAlertCard
                        key={feature.id}
                        feature={feature}
                        showLocation={false}
                        defaultOpen={true}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="weather-alerts-empty-state">
                    <p className="source-note">
                      Nenhum aviso ativo diretamente para este município.
                    </p>
                  </div>
                )}
              </div>

              {otherStateAlerts.length > 0 && (
                <div className="weather-alert-secondary-section">
                  <Disclosure
                    title={
                      <span className="weather-alert-secondary-trigger-title">
                        <span>Demais avisos em {stateUf ?? 'outros municípios'}</span>
                        <span className="weather-alert-section-pill">
                          {otherStateAlerts.length}
                        </span>
                      </span>
                    }
                    defaultOpen={false}
                    className="weather-alert-secondary-disclosure"
                  >
                    <div className="weather-alert-list">
                      {otherStateAlerts.map((feature) => (
                        <WeatherAlertCard key={feature.id} feature={feature} showLocation={true} />
                      ))}
                    </div>
                  </Disclosure>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {}
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
    </section>
  );
}

function LayerErrorNote({ error }: { error: unknown }) {
  const { message, hint } = describeError(error);
  return (
    <p className="weather-error-note" role="status">
      {message}
      {hint && <span className="weather-error-hint">{hint}</span>}
    </p>
  );
}
