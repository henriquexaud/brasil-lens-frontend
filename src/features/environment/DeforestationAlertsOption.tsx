import type { DeforestationAlerts } from '@/api/types';
import { LayerToggle } from '@/components/LayerToggle';
import { StatusBadge } from '@/components/StatusBadge';
import { formatAlertDate } from './alerts';

// Mesmo desenho do checkbox de Alertas do Clima. Os pontos só aparecem dentro de um estado,
// como os focos; no Brasil fica o mosaico, e o checkbox diz como chegar neles.
export function DeforestationAlertsOption({
  checked,
  onChange,
  alerts,
  pending,
  error,
  inState,
  count,
  scopeName,
}: {
  checked: boolean;
  onChange: (show: boolean) => void;
  alerts: DeforestationAlerts | undefined;
  pending: boolean;
  error: boolean;
  inState: boolean;
  // Alertas do estado aberto; no Brasil, o total da janela.
  count: number;
  scopeName?: string;
}) {
  return (
    <section className="panel-section weather-options-section" aria-label="Alertas de desmatamento">
      <div className="weather-layers-panel">
        <LayerToggle
          label="Alertas"
          sources={[
            {
              label: 'INPE DETER',
              description:
                'Alertas de desmatamento do DETER, só Amazônia e Cerrado. São alertas de fiscalização, não a taxa oficial (PRODES).',
            },
          ]}
          checked={checked}
          onChange={onChange}
          status={
            <StatusBadge
              tone={error ? (alerts ? 'warning' : 'error') : count > 0 ? 'alert' : 'neutral'}
            >
              {error
                ? alerts
                  ? 'Dados anteriores'
                  : 'Indisponível'
                : !alerts
                  ? pending
                    ? 'Carregando…'
                    : 'Sem dados'
                  : count > 0
                    ? `${count.toLocaleString('pt-BR')} ${count === 1 ? 'alerta' : 'alertas'}`
                    : 'Sem alertas'}
            </StatusBadge>
          }
        />
      </div>
      {checked && alerts && (
        <div className="weather-alerts-container">
          <p className="source-note">
            {alerts.windowEnd
              ? `${alerts.days} dias até ${formatAlertDate(alerts.windowEnd)}`
              : 'Sem alertas recentes'}
            {' · '}Amazônia e Cerrado
            {inState && scopeName ? ` · ${scopeName}` : ''}
          </p>
          {!inState && <p className="source-note">Abra um estado para ver os alertas no mapa.</p>}
          <p className="source-note">
            Alertas de fiscalização, não a taxa oficial de desmatamento; o INPE publica com cerca de
            duas semanas de atraso.
          </p>
        </div>
      )}
    </section>
  );
}
