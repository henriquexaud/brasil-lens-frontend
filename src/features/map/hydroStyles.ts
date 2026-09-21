import type { PathOptions } from 'leaflet';
import type { HydroFeatureProperties } from '@/api/types';

export function getHydroStyle(properties: HydroFeatureProperties, fireActive = false): PathOptions {
  if (properties.category === 'water_body') {
    return {
      fill: true,
      fillColor: '#7fabb6',
      fillOpacity: fireActive ? 0.12 : 0.22,
      color: '#6c98a7',
      weight: 0.6,
      opacity: 0.4,
      className: 'hydro-shape hydro-water-body',
    };
  }

  // category === 'river'
  const area = properties.drainageAreaKm2 ?? 0;
  let weight = 0.45;
  let color = '#9fbac2';
  let opacity = 0.3;

  if (area >= 200000) {
    weight = 1.5;
    color = '#6c98a7';
    opacity = 0.58;
  } else if (area >= 50000) {
    weight = 1.1;
    color = '#6c98a7';
    opacity = 0.5;
  } else if (area >= 10000) {
    weight = 0.85;
    color = '#80a4b0';
    opacity = 0.42;
  } else if (area >= 2000) {
    weight = 0.65;
    color = '#7fabb6';
    opacity = 0.35;
  }

  return {
    fill: false,
    color,
    weight,
    opacity: fireActive ? opacity * 0.7 : opacity,
    lineCap: 'round',
    lineJoin: 'round',
    className: 'hydro-shape hydro-river',
  };
}

export function formatDrainageArea(areaKm2: number | null): string | null {
  if (areaKm2 === null || areaKm2 === undefined || areaKm2 <= 0) return null;
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: areaKm2 > 100 ? 0 : 1,
  }).format(areaKm2);
}
