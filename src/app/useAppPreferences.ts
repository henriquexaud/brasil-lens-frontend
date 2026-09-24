import { useCallback, useEffect, useState } from 'react';
import type { DataContext } from '@/api/types';
import { LATEST_YEAR } from '@/features/controls/ControlPanel';
import { loadSessionState, saveSessionState } from '@/lib/sessionStorage';

/** Preferências da interface e seleção exclusiva da camada temática. */
export function useAppPreferences() {
  const [indicatorKey, setIndicatorKey] = useState<string>(() => {
    const saved = loadSessionState();
    return typeof saved.indicatorKey === 'string' ? saved.indicatorKey : 'population';
  });
  const [year, setYear] = useState<string>(() => {
    const saved = loadSessionState();
    return typeof saved.year === 'string' ? saved.year : LATEST_YEAR;
  });
  const [context, setContext] = useState<DataContext>(() => {
    const saved = loadSessionState();
    if (saved.context === 'climate_environmental' || saved.context === 'sociopolitical') {
      return saved.context;
    }
    return 'sociopolitical';
  });
  const [showWeatherAlerts, setShowWeatherAlerts] = useState<boolean>(() => {
    const saved = loadSessionState();
    return typeof saved.showWeatherAlerts === 'boolean' ? saved.showWeatherAlerts : true;
  });
  const [showHydrography, setShowHydrography] = useState<boolean>(() => {
    const saved = loadSessionState();
    return typeof saved.showHydrography === 'boolean' ? saved.showHydrography : true;
  });
  const [activeThematicLayer, setActiveThematicLayer] = useState<
    'climate' | 'fire' | 'rainfall' | 'none'
  >(() => {
    const saved = loadSessionState();
    if (saved.activeThematicLayer === 'fire') return 'fire';
    if (saved.activeThematicLayer === 'rainfall') return 'rainfall';
    if (saved.activeThematicLayer === 'none') return 'none';
    return 'climate';
  });

  const showClimate = activeThematicLayer === 'climate';
  const showFireHotspots = activeThematicLayer === 'fire';
  const showRainfall = activeThematicLayer === 'rainfall';
  // Clima e chuva vêm da mesma resposta da Open-Meteo: ligar um ou outro é a
  // mesma consulta, nunca duas.
  const weatherLayerActive = showClimate || showRainfall;

  const handleToggleClimate = useCallback((show: boolean) => {
    setActiveThematicLayer(show ? 'climate' : 'none');
  }, []);

  const handleToggleFireHotspots = useCallback((show: boolean) => {
    setActiveThematicLayer(show ? 'fire' : 'none');
  }, []);

  const handleToggleRainfall = useCallback((show: boolean) => {
    setActiveThematicLayer(show ? 'rainfall' : 'none');
  }, []);

  useEffect(() => {
    saveSessionState({
      context,
      indicatorKey,
      year,
      showWeatherAlerts,
      showHydrography,
      showClimate,
      showFireHotspots,
      showRainfall,
      activeThematicLayer,
    });
  }, [
    context,
    indicatorKey,
    year,
    showWeatherAlerts,
    showHydrography,
    showClimate,
    showFireHotspots,
    showRainfall,
    activeThematicLayer,
  ]);

  return {
    indicatorKey,
    setIndicatorKey,
    year,
    setYear,
    context,
    setContext,
    showWeatherAlerts,
    setShowWeatherAlerts,
    showHydrography,
    setShowHydrography,
    showClimate,
    showFireHotspots,
    showRainfall,
    weatherLayerActive,
    handleToggleClimate,
    handleToggleFireHotspots,
    handleToggleRainfall,
  };
}
