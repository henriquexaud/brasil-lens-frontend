import type {
  FireMunicipality,
  MapFeatureProperties,
  WeatherCity,
  WeatherCurrentResponse,
} from '@/api/types';
import { AnimatedText } from '@/components/AnimatedText';
import { ErrorMessage } from '@/components/Feedback';
import { Disclosure } from '@/components/Disclosure';
import { measurement, weatherDescription, WeatherIcon } from './conditions';
import { Forecast, RainForecastSection } from './WeatherForecast';
import { FireStatusSection, RainStatusSection } from './WeatherStatusSections';
import { ESTIMATE_DESCRIPTION } from './EstimateMark';

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
          {city.isInferred && <span className="weather-note">≈ {ESTIMATE_DESCRIPTION}</span>}
        </div>
      </div>
      {(city.humidityPct != null || city.windSpeedKmh != null) && (
        <div className="weather-compact-metrics">
          {city.humidityPct != null && <span>Umidade {measurement(city.humidityPct, '%')}</span>}
          {city.humidityPct != null && city.windSpeedKmh != null && (
            <span className="weather-compact-separator" aria-hidden="true">
              ·
            </span>
          )}
          {city.windSpeedKmh != null && (
            <span>Vento {measurement(city.windSpeedKmh, ' km/h')}</span>
          )}
        </div>
      )}
      {(error != null || data?.status === 'stale') && (
        <p className="source-note" role="status">
          Não foi possível atualizar. Exibindo o último resultado disponível.
        </p>
      )}
      <Disclosure title="Próximos dias" className="weather-disclosure">
        <Forecast code={code} />
      </Disclosure>
      <p className="source-note">
        Condições de{' '}
        {new Date(city.observedAt).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: city.timezone,
        })}{' '}
        (horário local). Estimativa para um ponto de {city.name}.
      </p>
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
          {isState && <p className="detail-kicker">Estado</p>}
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
          <RainStatusSection city={city} loading={loading} highlight />
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
    </section>
  );
}
