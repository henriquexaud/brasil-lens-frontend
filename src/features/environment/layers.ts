import type { DataSource } from '@/components/LayerMetadata';

export type IndicatorLayer = 'deforestation' | 'forest';

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
    label: 'Desmatamento',
    unit: 'km² · ano PRODES',
    source: {
      label: 'INPE',
      description:
        'PRODES: perda de vegetação nativa (desmatamento) entre agosto e julho, nos seis biomas.',
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
