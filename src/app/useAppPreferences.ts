import { useCallback, useEffect, useState } from 'react';
import { loadSessionState, saveSessionState } from '@/lib/sessionStorage';

/** Preferências visuais das camadas climáticas. */
export function useAppPreferences() {
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
    saveSessionState({ showWeatherAlerts, showHydrography, activeThematicLayer });
  }, [showWeatherAlerts, showHydrography, activeThematicLayer]);

  return {
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
