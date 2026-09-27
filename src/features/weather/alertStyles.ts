import type { WeatherAlertSeverityLevel } from '@/api/types';

export type AlertSeverityTier = WeatherAlertSeverityLevel;

export const SEVERITY_RANK: Record<AlertSeverityTier, number> = {
  extreme: 0,
  very_high: 1,
  high: 2,
  moderate: 3,
  danger: 2,
  potential: 3,
  other: 3,
};

export const SEVERITY_COLORS = {
  moderate: '#C58A00',
  high: '#E25822',
  very_high: '#C62828',
  extreme: '#7F1D1D',
} as const;

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
  color: string;
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

const EXTREME_STYLE: AlertStyle = {
  tier: 'extreme',
  label: 'Extremo',
  color: SEVERITY_COLORS.extreme,
  fillColor: SEVERITY_COLORS.extreme,
  fillOpacity: 0.18,
  strokeColor: SEVERITY_COLORS.extreme,
  strokeWeight: 1.45,
  strokeOpacity: 0.95,
  badgeBg: '#FEE2E2',
  badgeBorder: SEVERITY_COLORS.extreme,
  badgeText: SEVERITY_COLORS.extreme,
};

const VERY_HIGH_STYLE: AlertStyle = {
  tier: 'very_high',
  label: 'Muito alto',
  color: SEVERITY_COLORS.very_high,
  fillColor: SEVERITY_COLORS.very_high,
  fillOpacity: 0.16,
  strokeColor: SEVERITY_COLORS.very_high,
  strokeWeight: 1.35,
  strokeOpacity: 0.95,
  badgeBg: '#FEE2E2',
  badgeBorder: SEVERITY_COLORS.very_high,
  badgeText: '#991B1B',
};

const HIGH_STYLE: AlertStyle = {
  tier: 'high',
  label: 'Alto',
  color: SEVERITY_COLORS.high,
  fillColor: SEVERITY_COLORS.high,
  fillOpacity: 0.14,
  strokeColor: SEVERITY_COLORS.high,
  strokeWeight: 1.3,
  strokeOpacity: 0.95,
  badgeBg: '#FFEDD5',
  badgeBorder: SEVERITY_COLORS.high,
  badgeText: '#9A3412',
};

const MODERATE_STYLE: AlertStyle = {
  tier: 'moderate',
  label: 'Moderado',
  color: SEVERITY_COLORS.moderate,
  fillColor: SEVERITY_COLORS.moderate,
  fillOpacity: 0.12,
  strokeColor: SEVERITY_COLORS.moderate,
  strokeWeight: 1.25,
  strokeOpacity: 0.95,
  badgeBg: '#FEF9C3',
  badgeBorder: SEVERITY_COLORS.moderate,
  badgeText: '#78350F',
};

export const ALERT_STYLES: Record<AlertSeverityTier, AlertStyle> = {
  extreme: EXTREME_STYLE,
  very_high: VERY_HIGH_STYLE,
  high: HIGH_STYLE,
  moderate: MODERATE_STYLE,
  danger: HIGH_STYLE,
  potential: MODERATE_STYLE,
  other: MODERATE_STYLE,
};

export function resolveAlertTier(
  severity?: string | null,
  color?: string | null,
): AlertSeverityTier {
  const sev = (severity ?? '').toLowerCase();
  const col = (color ?? '').toLowerCase();

  if (sev.includes('extremo') || sev.includes('grande perigo') || col === '#7f1d1d') {
    return 'extreme';
  }

  if (
    sev.includes('muito alto') ||
    col === '#c62828' ||
    col === '#ff0000' ||
    col === '#e60000' ||
    col === '#dc2626'
  ) {
    return 'very_high';
  }

  if (
    sev.includes('moderado') ||
    sev.includes('potencial') ||
    col === '#c58a00' ||
    col === '#fffe00' ||
    col === '#ffff00' ||
    col === '#ffd700'
  ) {
    return 'moderate';
  }

  if (
    sev.includes('alto') ||
    sev.includes('perigo') ||
    col === '#e25822' ||
    col === '#ea580c' ||
    col === '#ff9e00' ||
    col === '#ff9900' ||
    col === '#ffa500' ||
    col === '#f39200'
  ) {
    return 'high';
  }

  return 'moderate';
}

export function getAlertStyle(properties?: {
  severityLevel?: AlertSeverityTier | null;
  severity?: string | null;
  color?: string | null;
}): AlertStyle {
  if (!properties) {
    return ALERT_STYLES.moderate;
  }
  const rawTier = properties.severityLevel;
  if (rawTier && rawTier in ALERT_STYLES) {
    return ALERT_STYLES[rawTier];
  }
  const resolved = resolveAlertTier(properties.severity, properties.color);
  return ALERT_STYLES[resolved] ?? ALERT_STYLES.moderate;
}
