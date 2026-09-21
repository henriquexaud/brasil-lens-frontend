import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapFeature, WeatherCity } from '@/api/types';
import {
  interpolateStateWeather,
  mergeWeatherWithPrecedence,
} from './spatialInterpolation';

const STATE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos de janela aceitável

interface CachedStateWeather {
  weatherByCode: Map<string, WeatherCity>;
  timestamp: number;
}

// Cache em memória persistente entre trocas de estado na mesma sessão
const stateWeatherCache = new Map<string, CachedStateWeather>();

export interface ProgressiveWeatherResult {
  /** Mapa completo (código IBGE -> WeatherCity) contendo valores reais e estimados */
  weatherByCode: Map<string, WeatherCity>;
  /** Apenas as cidades com medição real confirmada (para exibição de marcadores/pills no mapa) */
  measuredCities: WeatherCity[];
  /** Estatísticas do estágio de cobertura */
  stage: 'immediate' | 'progressive' | 'final' | 'idle';
  realCount: number;
  inferredCount: number;
  totalCount: number;
}

export function useProgressiveStateWeather({
  stateCode,
  stateFeatures,
  realCities,
  isCoverageComplete,
  enabled,
}: {
  stateCode: string | null;
  stateFeatures: MapFeature[];
  realCities: WeatherCity[];
  isCoverageComplete: boolean;
  enabled: boolean;
}): ProgressiveWeatherResult {
  // Estado local para armazenar as leituras consolidadas do estado atual
  const [currentMap, setCurrentMap] = useState<Map<string, WeatherCity>>(() => {
    if (!stateCode || !enabled) return new Map();
    const cached = stateWeatherCache.get(stateCode);
    if (cached && Date.now() - cached.timestamp < STATE_CACHE_TTL_MS) {
      return cached.weatherByCode;
    }
    return new Map();
  });

  const activeStateRef = useRef<string | null>(stateCode);

  // Ao trocar de estado ou desabilitar:
  // Se houver cache recente do estado que está entrando, carrega instantaneamente
  useEffect(() => {
    activeStateRef.current = stateCode;
    if (!enabled || !stateCode) {
      setCurrentMap(new Map());
      return;
    }

    const cached = stateWeatherCache.get(stateCode);
    if (cached && Date.now() - cached.timestamp < STATE_CACHE_TTL_MS) {
      setCurrentMap(cached.weatherByCode);
    } else {
      setCurrentMap(new Map());
    }
  }, [stateCode, enabled]);

  const processedSignatureRef = useRef<string>('');

  // Efeito principal de processamento em 3 momentos:
  // 1. Resposta imediata: primeira amostra real -> interpolação de todo o estado
  // 2. Refinamento progressivo: novos lotes reais substituem estimativas
  // 3. Estado final: consolidação e gravação no cache
  useEffect(() => {
    if (!enabled || !stateCode || !stateFeatures.length || !realCities.length) {
      return;
    }

    // Garante que a atualização ainda é para o estado ativo
    if (activeStateRef.current !== stateCode) return;

    // Evita recalcular se o estado e a quantidade de cidades reais não mudaram
    const signature = `${stateCode}:${realCities.length}:${isCoverageComplete}`;
    if (signature === processedSignatureRef.current) return;
    processedSignatureRef.current = signature;

    setCurrentMap((prev) => {
      // 1. Constrói mapa base com os dados reais recém-chegados
      const realOnlyMap = new Map<string, WeatherCity>();
      for (const city of realCities) {
        realOnlyMap.set(city.id, { ...city, isInferred: false });
      }

      // 2. Mescla os novos dados reais sobre o mapa anterior respeitando a precedência
      let merged = mergeWeatherWithPrecedence(prev, realOnlyMap);

      // 3. Se ainda houver municípios da malha sem dado nenhum (ou apenas o mapa inicial com 0 ou poucas cidades),
      // geramos a estimativa espacial para cobrir 100% do território do estado.
      const hasUncoveredMunicipalities = stateFeatures.some(
        (f) => !merged.has(f.properties?.ibgeCode || f.id),
      );

      if (hasUncoveredMunicipalities || isCoverageComplete) {
        if (!isCoverageComplete) {
          // Momento 1 e 2: Interpola os municípios ainda sem dados reais
          const estimatedMap = interpolateStateWeather(
            stateFeatures,
            realCities,
            stateFeatures[0]?.properties?.abbreviation || '',
          );
          merged = mergeWeatherWithPrecedence(merged, estimatedMap);
        }
      }

      // 4. Salva no cache com TTL
      stateWeatherCache.set(stateCode, {
        weatherByCode: merged,
        timestamp: Date.now(),
      });

      return merged;
    });
  }, [enabled, stateCode, stateFeatures, realCities, isCoverageComplete]);

  // Separa as cidades puramente medidas (para os pills/marcadores do WeatherLayer)
  const measuredCities = useMemo(() => {
    const list: WeatherCity[] = [];
    for (const city of currentMap.values()) {
      if (!city.isInferred) {
        list.push(city);
      }
    }
    return list;
  }, [currentMap]);

  const totalCount = stateFeatures.length;
  const realCount = measuredCities.length;
  const inferredCount = Math.max(0, currentMap.size - realCount);

  const stage = !enabled || !stateCode
    ? 'idle'
    : isCoverageComplete || (totalCount > 0 && realCount >= totalCount)
      ? 'final'
      : inferredCount > 0 && realCount > 0
        ? 'immediate'
        : realCount > 0
          ? 'progressive'
          : 'idle';

  return {
    weatherByCode: currentMap,
    measuredCities,
    stage,
    realCount,
    inferredCount,
    totalCount,
  };
}

