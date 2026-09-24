import type { WeatherCity } from '@/api/types';
import { useWeatherCurrent } from './queries';
import { ErrorMessage } from '@/components/Feedback';
import { measurement, weatherDescription, WeatherIcon } from './conditions';
import { rainColor } from '@/features/rainfall/rainScale';

export function Forecast({ code }: { code: string }) {
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

export function RainForecastSection({ city }: { city: WeatherCity }) {
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
