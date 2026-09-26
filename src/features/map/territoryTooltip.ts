import type { MapFeatureProperties, WeatherCity, FireMunicipality } from '@/api/types';
import { colorForTemperature } from './colors';
import { formatFireDate } from '@/features/fire/fireStyles';
import {
  rainAmount,
  rainColor,
  rainDescription,
  rainingNowText,
} from '@/features/rainfall/rainScale';
import { measurement, weatherDescription } from '@/features/weather/conditions';
import { isStateAverage } from '@/features/weather/EstimateMark';

// textContent keeps API names and units as text, including accents and symbols.
export function fillTooltipContent(
  el: HTMLElement,
  properties: MapFeatureProperties,
  weather?: WeatherCity,
  fire?: FireMunicipality,
  fireHours = 24,
  fireActive = false,
  rainActive = false,
  climateActive = true,
) {
  el.replaceChildren();
  const add = (className: string, text: string) => {
    const line = document.createElement('span');
    line.className = className;
    line.textContent = text;
    el.append(line);
  };
  add('tooltip-name', properties.name);
  if (properties.parentName) add('tooltip-meta', properties.parentName);
  // Valor interpolado de cidades próximas: marcado de leve, sem esconder o dado.
  // Um estado no mapa do Brasil feito de vários pontos, também.
  const estimatePrefix = weather?.isInferred ? '≈ ' : '';
  const estimateSuffix = weather?.isInferred
    ? ' · estimado'
    : weather && isStateAverage(weather)
      ? ` · média de ${weather.samplePoints} pontos`
      : '';
  if (fireActive) {
    if (fire) {
      const count24h = Number(
        fire.count24h ??
          fire.count24H ??
          (fire as unknown as Record<string, unknown>).count_24h ??
          0,
      );
      const count = Number(fire.count ?? 0);
      add(
        'tooltip-value',
        fire.density == null
          ? 'Densidade indisponível'
          : `${Number(fire.density).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} focos / 1.000 km²`,
      );
      add(
        'tooltip-meta',
        fireHours === 24
          ? `${count24h.toLocaleString('pt-BR')} em 24h`
          : `${count24h.toLocaleString('pt-BR')} em 24h · ${count.toLocaleString('pt-BR')} em ${fireHours}h`,
      );
      if (fire.areaKm2 != null)
        add(
          'tooltip-meta',
          `${Number(fire.areaKm2).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km² · malha IBGE`,
        );
      if (fire.latestDetectionAt)
        add('tooltip-meta', `Última: ${formatFireDate(fire.latestDetectionAt)}`);
    } else add('tooltip-meta', 'Resumo de focos indisponível');
  } else if (rainActive) {
    if (weather) {
      const rainVal = rainAmount(weather);
      const valEl = document.createElement('span');
      valEl.className = 'tooltip-value';
      const dot = document.createElement('span');
      dot.className = 'tooltip-thermal-dot';
      dot.style.backgroundColor = rainColor(rainVal);
      valEl.append(dot);
      const textSpan = document.createElement('span');
      textSpan.textContent = `${estimatePrefix}${Number(rainVal).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mm`;
      valEl.append(textSpan);
      el.append(valEl);
      add('tooltip-meta', `${rainDescription(rainVal)} em 24 h${estimateSuffix}`);
      const live = rainingNowText(weather);
      if (live) add('tooltip-meta tooltip-live-rain', live);
      if (weather.precipitationProbabilityPct != null) {
        add('tooltip-meta', `Chance de chuva hoje: ${weather.precipitationProbabilityPct}%`);
      }
    } else {
      add('tooltip-meta', 'Dados de chuva indisponíveis');
    }
  } else if (climateActive && weather) {
    const valEl = document.createElement('span');
    valEl.className = 'tooltip-value';
    const dot = document.createElement('span');
    dot.className = 'tooltip-thermal-dot';
    dot.style.backgroundColor = colorForTemperature(weather.temperatureC);
    valEl.append(dot);
    const textSpan = document.createElement('span');
    textSpan.textContent = estimatePrefix + measurement(weather.temperatureC, ' °C');
    valEl.append(textSpan);
    el.append(valEl);
    add('tooltip-meta', weatherDescription(weather.weatherCode) + estimateSuffix);
  }
}
