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
import { WeatherAlertCard } from './WeatherAlertCard';
import { WeatherAlertGroupCard } from './WeatherAlertGroupCard';
import { WeatherAlertsNationalSummary } from './WeatherAlertsNationalSummary';
import { WeatherThematicSwitch } from './WeatherThematicSwitch';
import {
  IBGE_UF_MAP,
  UF_NAMES,
  groupStateAlerts,
  partitionMunicipalityAlerts,
} from './alertUtils';

export interface WeatherOptionsProps {
  showAlerts: boolean;
  onToggleAlerts: (show: boolean) => void;
  showThematicSelector?: boolean;
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
  selectedCode?: string | null;
  parentCode?: string | null;
}

export function WeatherOptions({
  showAlerts,
  onToggleAlerts,
  showThematicSelector = true,
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
  selectedCode,
  parentCode,
}: WeatherOptionsProps) {
  const fallbackAlerts = useWeatherAlerts(showAlerts && alertsPending === undefined && !alertsData);

  const activeAlerts = alertsData ?? fallbackAlerts.data;
  const isAlertsPending = alertsPending ?? fallbackAlerts.isPending;
  const alertsError = fallbackAlerts.error;

  // Lógica progressiva: Brasil (nacional) → Estado → Município
  const effectiveCode = selectedCode !== undefined ? selectedCode : code;
  const effectiveParent = parentCode !== undefined ? parentCode : null;

  const territoryLevel: 'national' | 'state' | 'municipality' = useMemo(() => {
    if (effectiveCode && effectiveCode.length > 2) {
      return 'municipality';
    }
    if ((effectiveCode && effectiveCode.length === 2) || effectiveParent) {
      return 'state';
    }
    return 'national';
  }, [effectiveCode, effectiveParent]);

  const stateCode = useMemo(() => {
    if (territoryLevel === 'municipality' && effectiveCode) {
      return effectiveParent ?? effectiveCode.slice(0, 2);
    }
    if (territoryLevel === 'state') {
      return (effectiveCode && effectiveCode.length === 2 ? effectiveCode : effectiveParent) ?? null;
    }
    return null;
  }, [territoryLevel, effectiveCode, effectiveParent]);

  const municipalityCode = territoryLevel === 'municipality' ? effectiveCode : null;
  const stateUf = stateCode ? IBGE_UF_MAP[stateCode] : undefined;
  const stateName = scopeName ?? (stateUf ? UF_NAMES[stateUf] : undefined);

  // Visão de estado: ocorrências semelhantes agrupadas (ex.: Risco hidrológico · 8 municípios)
  const groupedStateAlerts = useMemo(() => {
    if (territoryLevel !== 'state' || !stateCode || !activeAlerts?.features) {
      return [];
    }
    return groupStateAlerts(activeAlerts.features, stateCode);
  }, [territoryLevel, stateCode, activeAlerts?.features]);

  // Visão de município: particiona entre avisos locais diretos e demais avisos do estado
  const { localAlerts, otherStateAlerts } = useMemo(() => {
    if (territoryLevel !== 'municipality' || !municipalityCode || !stateCode || !activeAlerts?.features) {
      return { localAlerts: [], otherStateAlerts: [] };
    }
    return partitionMunicipalityAlerts(activeAlerts.features, municipalityCode, stateCode);
  }, [territoryLevel, municipalityCode, stateCode, activeAlerts?.features]);

  // Contagem para o badge da camada de alertas no cabeçalho
  const relevantCount = useMemo(() => {
    if (!activeAlerts?.features) return 0;
    if (territoryLevel === 'national') {
      return activeAlerts.features.length;
    }
    if (territoryLevel === 'state') {
      return activeAlerts.features.filter((a) =>
        a.properties.affectedIbgeCodes?.some(
          (c) => stateCode && (c.startsWith(stateCode) || c === stateCode),
        ),
      ).length;
    }
    return localAlerts.length;
  }, [territoryLevel, activeAlerts?.features, stateCode, localAlerts.length]);

  return (
    <section
      className="panel-section weather-options-section"
      aria-label="Camadas e fontes de clima"
    >
      {/* Grupo Unificado de Camadas Interativas */}
      <div className="weather-layers-panel">
        {/* Seletor Segmentado de Camada Temática (quando habilitado no próprio painel) */}
        {showThematicSelector && (
          <WeatherThematicSwitch
            showClimate={showClimate}
            onToggleClimate={onToggleClimate}
            minTemperature={minTemperature}
            maxTemperature={maxTemperature}
            showRainfall={showRainfall}
            onToggleRainfall={onToggleRainfall}
            maxRainfall={maxRainfall}
            showFireHotspots={showFireHotspots}
            onToggleFireHotspots={onToggleFireHotspots}
            fireHotspotsLoading={fireHotspotsLoading}
            fireHotspots={fireHotspots}
            fireHotspotsError={fireHotspotsError}
            current={current}
            error={error}
            scopeName={scopeName}
          />
        )}

        {/* Camada: Alertas — uma só camada para as duas fontes; a origem
            aparece dentro de cada alerta (ver Disclosure abaixo), nunca como
            controle separado. */}
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
              {isAlertsPending && !activeAlerts
                ? 'Consultando…'
                : relevantCount > 0
                  ? `${relevantCount} ${relevantCount === 1 ? 'alerta ativo' : 'alertas ativos'}`
                  : 'Sem alertas'}
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

      {/* Alertas Ativos no Território com Divulgação Progressiva */}
      {showAlerts && (
        <div className="weather-alerts-container">
          {alertsError && <ErrorMessage error={alertsError} />}

          {/* 1. Nível Nacional: Brasil (resumo compacto agregado, sem listar municípios ou boletins individuais) */}
          {territoryLevel === 'national' && (
            <WeatherAlertsNationalSummary features={activeAlerts?.features ?? []} />
          )}

          {/* 2. Nível Estadual: UF (ocorrências semelhantes agrupadas ex.: Risco hidrológico · 8 municípios) */}
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

          {/* 3. Nível Municipal: Município ("Neste município" prioritário + "Demais avisos no estado" recolhido) */}
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
                    <p className="source-note">Nenhum aviso ativo diretamente para este município.</p>
                  </div>
                )}
              </div>

              {otherStateAlerts.length > 0 && (
                <div className="weather-alert-secondary-section">
                  <Disclosure
                    title={
                      <span className="weather-alert-secondary-trigger-title">
                        <span>Demais avisos em {stateUf ?? 'outros municípios'}</span>
                        <span className="weather-alert-section-pill">{otherStateAlerts.length}</span>
                      </span>
                    }
                    defaultOpen={false}
                    className="weather-alert-secondary-disclosure"
                  >
                    <div className="weather-alert-list">
                      {otherStateAlerts.map((feature) => (
                        <WeatherAlertCard
                          key={feature.id}
                          feature={feature}
                          showLocation={true}
                        />
                      ))}
                    </div>
                  </Disclosure>
                </div>
              )}
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
            . Chuva intensa, tempestade, vento, baixa umidade e ondas de calor — severidades e
            instruções oficiais vigentes.
          </li>
          <li className="weather-methodology-item">
            <strong>Risco geo-hidrológico:</strong>{' '}
            <a href="https://www.gov.br/cemaden/pt-br" target="_blank" rel="noreferrer">
              CEMADEN
            </a>
            . Inundação, enxurrada, alagamento e deslizamento por município, complementar aos
            avisos do INMET — os dois podem aparecer juntos na mesma área.
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
