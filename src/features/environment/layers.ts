import type { DataSource } from '@/components/LayerMetadata';

export type IndicatorLayer = 'deforestation' | 'alerts' | 'forest';

export interface IndicatorLayerConfig {
  indicatorKey: string;
  label: string;
  unit: string;
  source: DataSource;
}

// Desmatamento e Florestas são indicadores anuais por município, servidos pelo
// motor de indicadores com `context=environment` (ADR-15 do backend).
export const INDICATOR_LAYERS: Record<IndicatorLayer, IndicatorLayerConfig> = {
  deforestation: {
    indicatorKey: 'deforestation_prodes',
    // Rótulo curto da aba; legenda e ranking dizem "desmatamento".
    label: 'Perda',
    unit: 'km² · ano PRODES',
    source: {
      label: 'INPE',
      description:
        'PRODES: perda de vegetação nativa (desmatamento) entre agosto e julho, nos seis biomas.',
    },
  },
  // Não vem do catálogo do banco: a API monta os valores dos alertas do DETER na hora.
  alerts: {
    indicatorKey: 'deforestation_alerts',
    label: 'Alertas',
    unit: 'km² / 1.000 km²',
    source: {
      label: 'INPE DETER',
      description:
        'Alertas de desmatamento do DETER, só Amazônia e Cerrado. São alertas de fiscalização, não a taxa oficial (PRODES), e o INPE publica com cerca de duas semanas de atraso.',
    },
  },
  forest: {
    indicatorKey: 'forest_cover',
    label: 'Florestas',
    unit: '% da área',
    source: {
      label: 'MapBiomas',
      description: 'Coleção 11: cobertura florestal natural por município, em imagens de 30 m.',
    },
  },
};
