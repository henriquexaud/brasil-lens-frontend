import { LayerToggle } from '@/components/LayerToggle';
import { StatusBadge } from '@/components/StatusBadge';

export function RiversOption({
  checked,
  onChange,
  partial = false,
  error = false,
  pending = false,
}: {
  checked: boolean;
  onChange: (show: boolean) => void;
  partial?: boolean;
  error?: boolean;
  pending?: boolean;
}) {
  return (
    <section className="panel-section weather-options-section" aria-label="Camadas de apoio">
      <div className="weather-layers-panel">
        <LayerToggle
          label="Rios e corpos d'água"
          sources={[
            {
              label: 'ANA',
              description: 'Sistema Nacional de Informações sobre Recursos Hídricos (SNIRH).',
            },
          ]}
          checked={checked}
          onChange={onChange}
          status={
            <StatusBadge
              tone={error ? 'error' : partial ? 'warning' : pending ? 'neutral' : 'hydro'}
            >
              {error ? 'Indisponível' : partial ? 'Parcial' : pending ? 'Carregando…' : 'Ativo'}
            </StatusBadge>
          }
        />
      </div>
    </section>
  );
}
