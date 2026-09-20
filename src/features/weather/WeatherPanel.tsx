import type { MapFeatureProperties, WeatherCity, WeatherCurrentResponse } from '@/api/types';
import { useWeatherCurrent } from '@/api/queries';
import { AnimatedText } from '@/components/AnimatedText';
import { Disclosure } from '@/components/Disclosure';
import { ErrorMessage } from '@/components/Feedback';
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

export function WeatherPanel({
  code,
  territory,
  data,
  city,
  error,
  loading,
  onClose,
  onDrillDown,
}: {
  code: string;
  territory: MapFeatureProperties | undefined;
  data: WeatherCurrentResponse | undefined;
  city: WeatherCity | undefined;
  error: unknown;
  loading: boolean;
  onClose: () => void;
  onDrillDown: (code: string, name: string) => void;
}) {
  const isState = territory?.level === 'state';
  return (
    <section className="panel-section territory-detail" aria-label="Clima do local selecionado">
      <header className="detail-header">
        <div>
          {isState ? (
            <p className="detail-kicker">Estado</p>
          ) : (
            territory?.parentName && <p className="detail-kicker">{territory.parentName}</p>
          )}
          <AnimatedText
            as="h2"
            className="detail-title"
            text={territory?.name ?? city?.name ?? 'Carregando local…'}
          />
          {isState && city && <p className="detail-capital">{city.name} · capital</p>}
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Fechar detalhe">
          ×
        </button>
      </header>
      {!city && loading && (
        <div className="weather-skeleton" role="status" aria-label="Carregando clima">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-row" />
        </div>
      )}
      {!city && error != null && <ErrorMessage error={error} />}
      {city && (
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
        </>
      )}
      {isState && territory && (
        <button className="drill-button" onClick={() => onDrillDown(code, territory.name)}>
          Ver municípios <span aria-hidden="true">→</span>
        </button>
      )}
      <Disclosure title="Próximos dias" className="weather-disclosure">
        <Forecast code={code} />
      </Disclosure>
      {city && (
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
            <div className="indicator-row">
              <dt className="indicator-label">Chuva em {city.precipitationIntervalMinutes} min</dt>
              <dd className="indicator-value">{measurement(city.precipitationMm, ' mm')}</dd>
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
      )}
    </section>
  );
}
