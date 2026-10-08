import { useMemo } from 'react';
import type { WeatherAlertCollection } from '@/api/types';
import { Disclosure } from '@/components/Disclosure';
import { ErrorMessage } from '@/components/Feedback';
import { LayerToggle } from '@/components/LayerToggle';
import { StatusBadge } from '@/components/StatusBadge';
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
  hydrographyPending?: boolean;
  code: string | null;
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
  hydrographyPending = false,
  code,
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
      <div className="weather-layers-panel">
        {onToggleHydrography && (
          <LayerToggle
            label="Rios e corpos d'água"
            sources={[
              {
                label: 'ANA',
                description: 'Sistema Nacional de Informações sobre Recursos Hídricos (SNIRH).',
              },
            ]}
            checked={showHydrography ?? false}
            onChange={onToggleHydrography}
            status={
              <StatusBadge
                tone={
                  hydrographyError
                    ? 'error'
                    : hydrographyPartial
                      ? 'warning'
                      : hydrographyPending
                        ? 'neutral'
                        : 'hydro'
                }
              >
                {hydrographyError
                  ? 'Indisponível'
                  : hydrographyPartial
                    ? 'Parcial'
                    : hydrographyPending
                      ? 'Carregando…'
                      : 'Ativo'}
              </StatusBadge>
            }
          />
        )}
        <LayerToggle
          label="Alertas"
          sources={[
            { label: 'INMET', description: 'Instituto Nacional de Meteorologia.' },
            {
              label: 'CEMADEN',
              description: 'Centro Nacional de Monitoramento e Alertas de Desastres Naturais.',
            },
          ]}
          checked={showAlerts}
          onChange={onToggleAlerts}
          status={
            <StatusBadge
              tone={
                alertsError != null
                  ? alertsData
                    ? 'warning'
                    : 'error'
                  : relevantCount > 0
                    ? 'alert'
                    : 'neutral'
              }
            >
              {alertsError != null
                ? alertsData
                  ? 'Dados anteriores'
                  : 'Indisponível'
                : !alertsData
                  ? alertsPending
                    ? 'Carregando…'
                    : 'Sem dados'
                  : relevantCount > 0
                    ? `${relevantCount} ${relevantCount === 1 ? 'alerta ativo' : 'alertas ativos'}`
                    : 'Sem alertas'}
            </StatusBadge>
          }
        />
      </div>

      {showAlerts && (
        <div className="weather-alerts-container">
          {alertsError != null && <ErrorMessage error={alertsError} />}

          {alertsData && territoryLevel === 'national' && (
            <WeatherAlertsNationalSummary features={alertsData.features} />
          )}

          {alertsData && territoryLevel === 'state' && (
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

          {alertsData && territoryLevel === 'municipality' && (
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
    </section>
  );
}
