/**
 * Mapeamento e calibração de cores e estilos para alertas oficiais (INMET e CEMADEN).
 *
 * Configurado com visual sutil e elegante:
 * 1. Preenchimento translúcido leve (10% a 14% de opacidade) que preserva a
 *    leitura e a vibração da escala térmica do território subjacente.
 * 2. Perímetro com linha contínua sólida na cor laranja (#EA580C), espessura
 *    refinada (1.25px - 1.4px) e opacidade nítida (0.9), destacando a área de
 *    aviso com clareza e elegância sem sobrecarregar o mapa.
 * 3. Sem sombras pesadas, mantendo acabamento vetorial limpo e moderno.
 *
 * O tier de um alerta agora vem pronto do backend (`severityLevel`, calculado
 * em `services/weather.py` a partir do vocabulário próprio de cada fonte) —
 * este módulo só traduz tier → estilo visual. `resolveAlertTier` (adivinhação
 * por texto/cor) continua aqui só como rede de segurança para uma resposta
 * antiga em cache sem o campo; nenhum vocabulário de fonte novo deveria
 * precisar de uma entrada aqui.
 */

import type { WeatherAlertSeverityLevel } from '@/api/types';

export type AlertSeverityTier = WeatherAlertSeverityLevel;

/** Ordem de importância visual — menor é mais severo. Usado para ordenar mapa e lista. */
export const SEVERITY_RANK: Record<AlertSeverityTier, number> = {
  extreme: 0,
  danger: 1,
  potential: 2,
  other: 3,
};

/** Nome de exibição por fonte — a origem aparece dentro do alerta, nunca como camada própria. */
export const ALERT_SOURCE_LABELS: Record<string, string> = {
  inmet: 'INMET',
  cemaden: 'CEMADEN',
};

export function alertSourceLabel(provider: string): string {
  return ALERT_SOURCE_LABELS[provider] ?? provider.toUpperCase();
}

export interface AlertStyle {
  tier: AlertSeverityTier;
  label: string;
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWeight: number;
  strokeDashArray?: string;
  strokeOpacity: number;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

/** Cor oficial da linha de contorno dos avisos: laranja sólido vibrante e elegante. */
export const ALERT_BORDER_COLOR = '#EA580C';

export const ALERT_STYLES: Record<AlertSeverityTier, AlertStyle> = {
  extreme: {
    tier: 'extreme',
    label: 'Grande Perigo',
    fillColor: '#DC2626', // Vermelho alerta
    fillOpacity: 0.14,
    strokeColor: ALERT_BORDER_COLOR, // Linha sólida e laranja
    strokeWeight: 1.4,
    strokeOpacity: 0.9,
    badgeBg: '#FEE2E2',
    badgeBorder: '#DC2626',
    badgeText: '#7F1D1D',
  },
  danger: {
    tier: 'danger',
    label: 'Perigo',
    fillColor: '#EA580C', // Laranja alerta
    fillOpacity: 0.12,
    strokeColor: ALERT_BORDER_COLOR, // Linha sólida e laranja
    strokeWeight: 1.3,
    strokeOpacity: 0.9,
    badgeBg: '#FFEDD5',
    badgeBorder: '#EA580C',
    badgeText: '#9A3412',
  },
  potential: {
    tier: 'potential',
    label: 'Perigo Potencial',
    fillColor: '#F59E0B', // Âmbar alerta
    fillOpacity: 0.1,
    strokeColor: ALERT_BORDER_COLOR, // Linha sólida e laranja
    strokeWeight: 1.25,
    strokeOpacity: 0.9,
    badgeBg: '#FEF3C7',
    badgeBorder: '#D97706',
    badgeText: '#78350F',
  },
  other: {
    tier: 'other',
    label: 'Aviso Meteorológico',
    fillColor: '#8B5CF6',
    fillOpacity: 0.1,
    strokeColor: ALERT_BORDER_COLOR, // Linha sólida e laranja
    strokeWeight: 1.25,
    strokeOpacity: 0.9,
    badgeBg: '#EDE9FE',
    badgeBorder: '#7C3AED',
    badgeText: '#4C1D95',
  },
};

export function resolveAlertTier(
  severity?: string | null,
  color?: string | null,
): AlertSeverityTier {
  const sev = (severity ?? '').toLowerCase();
  const col = (color ?? '').toLowerCase();

  // 1. Grande Perigo (vermelho)
  if (
    sev.includes('grande perigo') ||
    col === '#ff0000' ||
    col === '#e60000' ||
    col === '#dc2626' ||
    col === '#c9461c'
  ) {
    return 'extreme';
  }

  // 2. Perigo Potencial (amarelo) - checado antes de "perigo" para não colidir
  if (sev.includes('potencial') || col === '#fffe00' || col === '#ffff00' || col === '#ffd700') {
    return 'potential';
  }

  // 3. Perigo (laranja)
  if (
    sev.includes('perigo') ||
    col === '#ff9e00' ||
    col === '#ff9900' ||
    col === '#f39200' ||
    col === '#ea580c'
  ) {
    return 'danger';
  }

  return 'other';
}

export function getAlertStyle(properties?: {
  severityLevel?: AlertSeverityTier | null;
  severity?: string | null;
  color?: string | null;
}): AlertStyle {
  if (!properties) {
    return ALERT_STYLES.other;
  }
  // Fonte de verdade: o tier que o backend já calculou por fonte. A
  // adivinhação por texto/cor só roda se `severityLevel` não vier (resposta
  // antiga em cache) — nunca para decidir o tier de um alerta novo.
  const tier =
    properties.severityLevel && properties.severityLevel in ALERT_STYLES
      ? properties.severityLevel
      : resolveAlertTier(properties.severity, properties.color);
  return ALERT_STYLES[tier];
}
