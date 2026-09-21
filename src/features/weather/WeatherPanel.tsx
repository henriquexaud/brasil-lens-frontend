import type {
  FireMunicipality,
  MapFeatureProperties,
  WeatherCity,
  WeatherCurrentResponse,
} from '@/api/types';
import { useWeatherCurrent } from '@/api/queries';
import { AnimatedText } from '@/components/AnimatedText';
import { Disclosure } from '@/components/Disclosure';
import { ErrorMessage } from '@/components/Feedback';
import { formatFireDate } from '@/features/fire/fireStyles';
import { densityColor } from '@/features/fire/fireDensity';
import { rainColor, rainDescription, rainBadgeText } from '@/features/rainfall/rainScale';
import { measurement, weatherDescription, WeatherIcon } from './conditions';

function Forecast({ code }: { code: string }) {
  const query = useWeatherCurrent(code, true, true);
  const city = query.data?.cities[0];
  if (query.error && !city) return <ErrorMessage error={query.error} />;
  if (!city)
    return (
      <p className="source-note" role="status">
        Carregando previsão…
      </p>
    );
  return (
    <>
      {(query.error || query.data?.status === 'stale') && (
        <p className="source-note" role="status">
          Exibindo a última previsão disponível.
        </p>
      )}
      <div className="forecast-list">
        {city.forecast.map((day) => (
          <div className="forecast-row" key={day.date}>
            <div>
              <strong>
                {new Date(`${day.date}T12:00:00`).toLocaleDateString('pt-BR', {
                  weekday: 'short',
                  day: '2-digit',
                })}
              </strong>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <WeatherIcon code={day.weatherCode} size={13} />
                {weatherDescription(day.weatherCode)}
              </span>
            </div>
            <div className="forecast-range">
              <strong>{measurement(day.temperatureMaxC, '°')}</strong>
              <span>{measurement(day.temperatureMinC, '°')}</span>
            </div>
            <span className="forecast-rain" title="Probabilidade de chuva">
              {measurement(day.precipitationProbabilityPct, '%')} chuva
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function FireStatusSection({
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
          <span
            className="fire-layer-dot"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
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

function RainStatusSection({
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

  const rainMm = city.precipitationSumMm ?? city.precipitationMm ?? 0;
  const hasRain = rainMm > 0;
  const color = rainColor(rainMm);
  const badgeText = rainBadgeText(rainMm);
  const desc = rainDescription(rainMm);
  const prob = city.precipitationProbabilityPct;

  return (
    <div className={`rain-detail-card ${highlight ? 'is-highlight' : ''}`}>
      <div className="rain-detail-header">
        <div className="rain-detail-status">
          <span
            className="rain-layer-dot"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
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

      {city.forecast && city.forecast.length > 0 && city.forecast[0]?.precipitationSumMm != null && (
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
    </div>
  );
}

function formatWeekday(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function RainForecastSection({ city }: { city: WeatherCity }) {
  const forecastDays = city.forecast?.slice(0, 7) ?? [];
  if (forecastDays.length === 0) return null;

  return (
    <div className="rain-forecast-card">
      <h3 className="rain-forecast-title">Previsão diária de chuva</h3>
      <div className="rain-forecast-list" role="list">
        {forecastDays.map((day, idx) => {
          const rainMm = day.precipitationSumMm ?? 0;
          const prob = day.precipitationProbabilityPct;
          const color = rainColor(rainMm);
          const isToday = idx === 0;
          const dayLabel = isToday ? 'Hoje' : formatWeekday(day.date);
          const barWidth = Math.min(100, Math.max(rainMm > 0 ? 8 : 0, (rainMm / 60) * 100));

          return (
            <div key={day.date} className="rain-forecast-row" role="listitem">
              <span className="rain-forecast-day">{dayLabel}</span>
              <div className="rain-forecast-bar-track">
                {rainMm > 0 && (
                  <div
                    className="rain-forecast-bar-fill"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: color,
                    }}
                  />
                )}
              </div>
              <div className="rain-forecast-values">
                <span className="rain-forecast-prob" title="Probabilidade de chuva">
                  {prob != null ? `${prob}%` : '—'}
                </span>
                <span className="rain-forecast-mm">
                  {Number(rainMm).toLocaleString('pt-BR', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}{' '}
                  mm
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface WeatherPanelProps {
  code: string;
  territory: MapFeatureProperties | undefined;
  data: WeatherCurrentResponse | undefined;
  city: WeatherCity | undefined;
  error: unknown;
  loading: boolean;
  onClose: () => void;
  onDrillDown: (code: string, name: string) => void;
  fireMunicipality?: FireMunicipality;
  fireActive?: boolean;
  fireLoading?: boolean;
  fireHours?: number;
  rainActive?: boolean;
}

export function WeatherPanel({
  code,
  territory,
  data,
  city,
  error,
  loading,
  onClose,
  onDrillDown,
  fireMunicipality,
  fireActive = false,
  fireLoading = false,
  fireHours = 24,
  rainActive = false,
}: WeatherPanelProps) {
  const isState = territory?.level === 'state';

  const weatherDetailsContent = !fireActive && !rainActive && city && (
    <>
      <div className="weather-current">
        <WeatherIcon code={city.weatherCode} size={36} className="weather-current-icon" />
        <AnimatedText
          as="strong"
          className="weather-temperature"
          mode="number"
          text={measurement(city.temperatureC, '°')}
        />
        <div>
          <span>{weatherDescription(city.weatherCode)}</span>
          <span className="weather-note">
            Sensação de {measurement(city.apparentTemperatureC, '°')}
          </span>
        </div>
      </div>
      {(error != null || data?.status === 'stale') && (
        <p className="source-note" role="status">
          Não foi possível atualizar. Exibindo o último resultado disponível.
        </p>
      )}
      <Disclosure title="Próximos dias" className="weather-disclosure">
        <Forecast code={code} />
      </Disclosure>
      <Disclosure title="Mais detalhes" className="weather-disclosure">
        <dl className="indicator-list">
          <div className="indicator-row">
            <dt className="indicator-label">Umidade</dt>
            <dd className="indicator-value">{measurement(city.humidityPct, '%')}</dd>
          </div>
          <div className="indicator-row">
            <dt className="indicator-label">Vento</dt>
            <dd className="indicator-value">{measurement(city.windSpeedKmh, ' km/h')}</dd>
          </div>
        </dl>
        <p className="source-note">
          Condições de{' '}
          {new Date(city.observedAt).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: city.timezone,
          })}{' '}
          (horário local). Estimativa para um ponto de {city.name}.
        </p>
      </Disclosure>
    </>
  );

  return (
    <section
      className="panel-section territory-detail"
      aria-label={
        fireActive
          ? 'Focos de calor do local selecionado'
          : rainActive
            ? 'Quantidade de chuva do local selecionado'
            : 'Clima do local selecionado'
      }
    >
      <header className="detail-header">
        <div>
          {isState ? (
            <p className="detail-kicker">Estado</p>
          ) : (
            (territory?.parentName || fireMunicipality?.state) && (
              <p className="detail-kicker">{territory?.parentName ?? fireMunicipality?.state}</p>
            )
          )}
          <AnimatedText
            as="h2"
            className="detail-title"
            text={territory?.name ?? city?.name ?? fireMunicipality?.name ?? 'Carregando local…'}
          />
          {isState && city && <p className="detail-capital">{city.name} · capital</p>}
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Fechar detalhe">
          ×
        </button>
      </header>

      {/* Quando a camada de fogo está ativa, Focos de Calor é o elemento primário (Hero) */}
      {fireActive && (
        <FireStatusSection
          fire={fireMunicipality}
          loading={fireLoading}
          hours={fireHours}
          highlight
        />
      )}

      {/* Quando a camada de chuva está ativa, Chuva é o elemento primário (Hero) com previsão diária */}
      {!fireActive && rainActive && (
        <>
          <RainStatusSection
            city={city}
            loading={loading}
            highlight
          />
          {city && <RainForecastSection city={city} />}
        </>
      )}

      {!city && loading && !fireActive && !rainActive && (
        <div className="weather-skeleton" role="status" aria-label="Carregando clima">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-row" />
        </div>
      )}

      {!city && error != null && !fireActive && !rainActive && <ErrorMessage error={error} />}

      {/* Quando a camada de temperatura está ativa, o Clima geral é o elemento primário */}
      {!fireActive && !rainActive && weatherDetailsContent}

      {/* Botão de drill-down para navegar aos municípios do estado */}
      {isState && territory && (
        <button className="drill-button" onClick={() => onDrillDown(code, territory.name)}>
          Ver municípios <span aria-hidden="true">→</span>
        </button>
      )}

      {/* Focos de calor disponíveis quando não é a camada ativa */}
      {!fireActive && !rainActive && (fireMunicipality || fireLoading) && (
        <Disclosure
          title="Focos de calor"
          defaultOpen={Boolean(fireMunicipality && fireMunicipality.count > 0)}
          className="weather-disclosure"
        >
          <FireStatusSection fire={fireMunicipality} loading={fireLoading} hours={fireHours} />
        </Disclosure>
      )}
    </section>
  );
}
