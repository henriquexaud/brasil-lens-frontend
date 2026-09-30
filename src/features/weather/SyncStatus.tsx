import type { WeatherCurrentResponse } from '@/api/types';
import { describeError } from '@/components/Feedback';
import { formatRelativeTime } from '@/lib/format';

export interface SyncStatusProps {
  current: WeatherCurrentResponse | undefined;
  error: unknown;
  loading: boolean;
  onRefresh: () => void;
}

// Último bloco do painel: estado da sincronização e atualização manual.
export function SyncStatus({ current, error, loading, onRefresh }: SyncStatusProps) {
  return (
    <section className="panel-section weather-sync-section" aria-label="Atualização dos dados">
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
