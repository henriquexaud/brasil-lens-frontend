/**
 * Estilos e formatação da malha hidrográfica (ANA / SNIRH).
 *
 * Calibra a hierarquia visual de rios completos e massas d'água:
 * - Rios monumentais (Amazonas, Paraná, São Francisco, Tocantins) ganham destaque expressivo;
 * - Rios regionais e estaduais mantêm traçado nítido e contínuo;
 * - Tributários locais mantêm espessura leve para não poluir a tela;
 * - Lagos e represas recebem preenchimento translúcido com contorno definido.
 */
import type { PathOptions } from 'leaflet';
import type { HydroFeatureProperties } from '@/api/types';

export function getHydroStyle(properties: HydroFeatureProperties): PathOptions {
  if (properties.category === 'water_body') {
    return {
      fill: true,
      fillColor: '#38bdf8',
      fillOpacity: 0.35,
      color: '#0284c7',
      weight: 1.2,
      opacity: 0.85,
      className: 'hydro-shape hydro-water-body',
    };
  }

  // category === 'river'
  const area = properties.drainageAreaKm2 ?? 0;
  let weight = 1.2;
  let color = '#7dd3fc';
  let opacity = 0.75;

  if (area >= 200000) {
    weight = 3.8;
    color = '#0284c7';
    opacity = 0.95;
  } else if (area >= 50000) {
    weight = 2.8;
    color = '#0284c7';
    opacity = 0.9;
  } else if (area >= 10000) {
    weight = 2.1;
    color = '#0ea5e9';
    opacity = 0.85;
  } else if (area >= 2000) {
    weight = 1.6;
    color = '#38bdf8';
    opacity = 0.8;
  }

  return {
    fill: false,
    color,
    weight,
    opacity,
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
