import { useCallback, useEffect, useState } from 'react';
import {
  loadSessionState,
  saveSessionState,
  type ClimateLayer,
  type EnvironmentLayer,
} from '@/lib/sessionStorage';

export type MapVariant = 'climate' | 'environment';

// Clima e Meio ambiente compartilham a composição do mapa; cada um guarda a
// própria aba ativa e só a sua camada de apoio (avisos ou rios).
export function useAppPreferences(variant: MapVariant = 'climate') {
  const [showWeatherAlerts, setShowWeatherAlerts] = useState<boolean>(() => {
    const saved = loadSessionState();
    return typeof saved.showWeatherAlerts === 'boolean' ? saved.showWeatherAlerts : true;
  });
  const [showHydrography, setShowHydrography] = useState<boolean>(() => {
    const saved = loadSessionState();
    return typeof saved.showHydrography === 'boolean' ? saved.showHydrography : true;
  });
  const [climateLayer, setClimateLayer] = useState<ClimateLayer>(
    () => loadSessionState().activeThematicLayer ?? 'climate',
  );
  const [environmentLayer, setEnvironmentLayer] = useState<EnvironmentLayer>(
    () => loadSessionState().environmentLayer ?? 'forest',
  );

  const climate = variant === 'climate';
  const showClimate = climate && climateLayer === 'climate';
  const showRainfall = climate && climateLayer === 'rainfall';
  const showHumidity = climate && climateLayer === 'humidity';
  const showFireHotspots = !climate && environmentLayer === 'fire';
  const indicatorLayer =
    !climate && (environmentLayer === 'deforestation' || environmentLayer === 'forest')
      ? environmentLayer
      : null;
  // Temperatura, chuva e umidade vêm da mesma leitura da Open-Meteo.
  const weatherLayerActive = showClimate || showRainfall || showHumidity;

  const handleToggleClimate = useCallback((show: boolean) => {
    setClimateLayer(show ? 'climate' : 'none');
  }, []);
  const handleToggleRainfall = useCallback((show: boolean) => {
    setClimateLayer(show ? 'rainfall' : 'none');
  }, []);
  const handleToggleHumidity = useCallback((show: boolean) => {
    setClimateLayer(show ? 'humidity' : 'none');
  }, []);
  const handleEnvironmentLayer = useCallback((layer: EnvironmentLayer) => {
    setEnvironmentLayer(layer);
  }, []);

  useEffect(() => {
    saveSessionState({
      showWeatherAlerts,
      showHydrography,
      activeThematicLayer: climateLayer,
      environmentLayer,
    });
  }, [showWeatherAlerts, showHydrography, climateLayer, environmentLayer]);

  return {
    showWeatherAlerts: climate && showWeatherAlerts,
    setShowWeatherAlerts,
    showHydrography: !climate && showHydrography,
    setShowHydrography,
    showClimate,
    showFireHotspots,
    showRainfall,
    showHumidity,
    indicatorLayer,
    environmentLayer,
    weatherLayerActive,
    handleToggleClimate,
    handleToggleRainfall,
    handleToggleHumidity,
    handleEnvironmentLayer,
  };
}
