import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, Pane, Tooltip, useMap } from 'react-leaflet';
import type { WeatherCity } from '@/api/types';
import { colorForTemperature } from '@/features/map/colors';
import { rainAmount, rainColor } from '@/features/rainfall/rainScale';
import { WeatherIcon } from '@/features/weather/conditions';
import { EstimateMark } from '@/features/weather/EstimateMark';

const ATTRIBUTION =
  'Clima: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>';

/**
 * Com uma cidade aberta, o foco é ela: poucos vizinhos medidos e bem espaçados
 * (px na horizontal; metade na vertical), menos ainda quanto mais municípios
 * houver na tela. O estado inteiro, sem seleção, mostra os rótulos que couberem.
 */
export function focusLabelBudget(density: number) {
  if (density > 150) return { maxLabels: 4, spacing: 180 };
  if (density > 60) return { maxLabels: 6, spacing: 160 };
  return { maxLabels: 8, spacing: 140 };
}

/** Estado inteiro: todos os rótulos que couberem, como sempre. */
const STATE_LABELS = { maxLabels: Infinity, spacing: 96 };

/**
 * Memo: o App renderiza a cada mudança de estado das consultas; as pílulas só
 * precisam mudar com as cidades, a seleção, o modo ou o enquadramento.
 */
export const WeatherLayer = memo(function WeatherLayer({
  cities,
  selectedId,
  municipal,
  mode = 'temperature',
}: {
  cities: WeatherCity[];
  selectedId?: string;
  municipal: boolean;
  mode?: 'temperature' | 'rainfall';
}) {
  const map = useMap();
  const [viewport, setViewport] = useState(() => ({ zoom: map.getZoom(), revision: 0 }));
  const { zoom } = viewport;

  useEffect(() => {
    map.attributionControl?.addAttribution(ATTRIBUTION);
    const onMove = () =>
      setViewport((previous) => ({ zoom: map.getZoom(), revision: previous.revision + 1 }));
    map.on('moveend resize', onMove);
    return () => {
      map.attributionControl?.removeAttribution(ATTRIBUTION);
      map.off('moveend resize', onMove);
    };
  }, [map]);

  const isRain = mode === 'rainfall';

  // Pílulas já na tela têm preferência na disputa por espaço: sem isso, cada
  // lote de dados mudava os vencedores e as pílulas sumiam e reapareciam
  // (com a animação de entrada) em áreas com muitos municípios.
  const shownRef = useRef(new Set<string>());

  // Ordena para que o território selecionado fique sempre no topo da pilha visual.
  // Recalculado só quando dados, seleção, modo ou enquadramento mudam.
  const sortedCities = useMemo(() => {
    const candidates = cities.filter((city) =>
      isRain
        ? rainAmount(city) >= 0.1
        : city.temperatureC != null && Number.isFinite(city.temperatureC),
    );
    if (municipal) {
      // Estado inteiro: rótulos pela UF toda, disputando espaço. Cidade aberta:
      // ela e poucos vizinhos medidos; o resto segue pintado pela escala.
      const focused = Boolean(selectedId && selectedId.length === 7);
      const size = map.getSize();
      const onScreen = (city: WeatherCity) => {
        const point = map.latLngToContainerPoint([city.latitude, city.longitude]);
        return point.x >= 0 && point.y >= 0 && point.x <= size.x && point.y <= size.y
          ? point
          : null;
      };
      const { maxLabels, spacing } = focused
        ? focusLabelBudget(
            cities.reduce((count, city) => count + Number(Boolean(onScreen(city))), 0),
          )
        : STATE_LABELS;
      // Com a cidade aberta, só leituras medidas acompanham a dela.
      const measured = candidates.filter((city) => !city.isInferred || city.id === selectedId);
      const pool = focused && measured.length > 0 ? measured : candidates;
      const shown = shownRef.current;
      const priority = [...pool].sort((a, b) => {
        if (a.id === selectedId) return -1;
        if (b.id === selectedId) return 1;
        const kept = Number(shown.has(b.id)) - Number(shown.has(a.id));
        if (kept) return kept;
        if (isRain) return rainAmount(b) - rainAmount(a);
        return Number(Boolean(a.isInferred)) - Number(Boolean(b.isInferred));
      });
      const occupied: Array<{ x: number; y: number }> = [];
      const visible = new Set<string>();
      for (const city of priority) {
        if (visible.size >= maxLabels && city.id !== selectedId) break;
        const point = onScreen(city);
        if (!point) continue;
        const crowded = occupied.some(
          (other) =>
            Math.abs(point.x - other.x) < spacing && Math.abs(point.y - other.y) < spacing / 2,
        );
        if (crowded && city.id !== selectedId) continue;
        occupied.push(point);
        visible.add(city.id);
      }
      shownRef.current = visible;
      return candidates
        .filter((city) => visible.has(city.id))
        .sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId));
    }
    return [...candidates].sort((a, b) => {
      if (a.id === selectedId) return 1;
      if (b.id === selectedId) return -1;
      return 0;
    });
    // `viewport` muda a cada movimento do mapa: as posições em tela (via `map`)
    // precisam ser recalculadas, mesmo sem ser lido aqui dentro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, selectedId, municipal, isRain, map, viewport]);

  // No mapa do Brasil, modo compacto apenas em zoom muito afastado (< 4.8) para evitar sobreposição na costa.
  // No mapa estadual, exibe os pills a partir do zoom 6.0; abaixo disso foca na capital e selecionado.
  const isCompact = !municipal && zoom < 4.8;
  const showAllPills = municipal ? zoom >= 6.0 : true;

  return (
    <Pane name="weather-points" style={{ zIndex: 490, pointerEvents: 'none' }}>
      {sortedCities.map((city, index) => {
        const isSelected = city.id === selectedId;
        const isCapital = !municipal || index === 0;
        const shouldShowPill = isSelected || showAllPills || isCapital;

        if (!shouldShowPill) return null;

        const rainVal = rainAmount(city);
        if (isRain && rainVal < 0.1) return null;

        const color = isRain ? rainColor(rainVal) : colorForTemperature(city.temperatureC);
        const formattedRain =
          rainVal >= 10
            ? `${Math.round(rainVal)} mm`
            : `${Number(rainVal).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mm`;

        return (
          <Fragment key={city.id}>
            <CircleMarker
              center={[city.latitude, city.longitude]}
              radius={0.1}
              stroke={false}
              fill={false}
              interactive={false}
              pathOptions={{
                opacity: 0,
                fillOpacity: 0,
              }}
            >
              <Tooltip
                permanent
                direction="center"
                offset={[0, 0]}
                className="weather-marker-label"
                interactive={false}
              >
                {municipal ? (
                  <div
                    className={`weather-pill weather-pill-city ${isSelected ? 'is-selected' : ''}`}
                    style={
                      {
                        '--pill-band-color': color,
                        '--stagger': index % 16,
                      } as React.CSSProperties
                    }
                  >
                    {isRain ? (
                      <>
                        <span
                          className={`weather-pill-dot${city.rainingNow ? ' is-raining' : ''}`}
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        />
                        <span className="weather-pill-temp">
                          <EstimateMark city={city} />
                          {formattedRain}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="weather-pill-icon">
                          <WeatherIcon code={city.weatherCode} size={13} />
                        </span>
                        <span className="weather-pill-temp">
                          <EstimateMark city={city} />
                          {Math.round(city.temperatureC) || 0}°
                        </span>
                      </>
                    )}
                  </div>
                ) : (
                  <div
                    className={`weather-pill ${isSelected ? 'is-selected' : ''} ${isCompact && !isSelected ? 'is-compact' : ''}`}
                    style={{ '--pill-band-color': color } as React.CSSProperties}
                  >
                    {isRain ? (
                      <>
                        <span
                          className={`weather-pill-dot${city.rainingNow ? ' is-raining' : ''}`}
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        />
                        <span className="weather-pill-temp">
                          <EstimateMark city={city} />
                          {formattedRain}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="weather-pill-icon">
                          <WeatherIcon code={city.weatherCode} size={14} />
                        </span>
                        <span className="weather-pill-temp">
                          <EstimateMark city={city} />
                          {Math.round(city.temperatureC) || 0}°
                        </span>
                      </>
                    )}
                  </div>
                )}
              </Tooltip>
            </CircleMarker>
          </Fragment>
        );
      })}
    </Pane>
  );
});
