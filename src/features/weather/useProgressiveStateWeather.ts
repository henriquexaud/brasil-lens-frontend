import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapFeature, WeatherCity } from '@/api/types';
import {
  interpolateStateWeather,
  mergeWeatherWithPrecedence,
} from './spatialInterpolation';

const STATE_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas (Stale-While-Revalidate)

interface CachedStateWeather {
  weatherByCode: Map<string, WeatherCity>;
  timestamp: number;
}

// Cache em memória persistente entre trocas de estado na mesma sessão
const stateWeatherCache = new Map<string, CachedStateWeather>();

function saveStateToSession(stateCode: string, map: Map<string, WeatherCity>): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const entries: [string, WeatherCity][] = [];
    for (const [code, city] of map) {
      entries.push([code, city]);
    }
    sessionStorage.setItem(`bl.sw.${stateCode}`, JSON.stringify({ entries, timestamp: Date.now() }));
  } catch {
    // sessionStorage quota exceeded or unavailable - ignore safely
  }
}

function loadStateFromSession(stateCode: string): CachedStateWeather | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(`bl.sw.${stateCode}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) return null;
    const weatherByCode = new Map<string, WeatherCity>(parsed.entries);
    return { weatherByCode, timestamp: parsed.timestamp };
  } catch {
    return null;
  }
}

function getStateCache(stateCode: string): CachedStateWeather | null {
  const mem = stateWeatherCache.get(stateCode);
  if (mem && Date.now() - mem.timestamp < STATE_CACHE_TTL_MS) {
    return mem;
  }
  const session = loadStateFromSession(stateCode);
  if (session && Date.now() - session.timestamp < STATE_CACHE_TTL_MS) {
    stateWeatherCache.set(stateCode, session);
    return session;
  }
  return null;
}

export function clearStateWeatherCacheForTesting(): void {
  stateWeatherCache.clear();
  if (typeof sessionStorage !== 'undefined') {
    try {
      const keys = Object.keys(sessionStorage);
      for (const k of keys) {
        if (k.startsWith('bl.sw.')) sessionStorage.removeItem(k);
      }
    } catch {
      // ignore
    }
  }
}

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
    const cached = getStateCache(stateCode);
    if (cached) {
      return cached.weatherByCode;
    }
    return new Map();
  });

  const activeStateRef = useRef<string | null>(stateCode);

  // Ao trocar de estado ou desabilitar:
  // Se houver cache recente do estado que está entrando, carrega instantaneamente no frame 0
  useEffect(() => {
    activeStateRef.current = stateCode;
    processedSignatureRef.current = '';
    if (!enabled || !stateCode) {
      setCurrentMap(new Map());
      return;
    }

    const cached = getStateCache(stateCode);
    if (cached) {
      setCurrentMap(cached.weatherByCode);
    } else {
      setCurrentMap(new Map());
    }
  }, [stateCode, enabled]);

  const processedSignatureRef = useRef<string>('');

  const filteredStateFeatures = useMemo(() => {
    if (!stateCode) return stateFeatures;
    return stateFeatures.filter((f) => {
      const code = f.properties?.ibgeCode || (typeof f.id === 'string' ? f.id : '');
      return code.startsWith(stateCode);
    });
  }, [stateFeatures, stateCode]);

  const filteredRealCities = useMemo(() => {
    if (!stateCode) return realCities;
    return realCities.filter((c) => c.id.startsWith(stateCode));
  }, [realCities, stateCode]);

  // Efeito principal de processamento em 3 momentos:
  // 1. Resposta imediata: primeira amostra real -> interpolação de todo o estado
  // 2. Refinamento progressivo: novos lotes reais chegam em segundo plano e recalculam as estimativas com maior resolução
  // 3. Estado final: 100% dos municípios com medições reais confirmadas
  useEffect(() => {
    if (!enabled || !stateCode || !filteredStateFeatures.length || !filteredRealCities.length) {
      return;
    }

    // Garante que a atualização ainda é para o estado ativo
    if (activeStateRef.current !== stateCode) return;

    // Evita recalcular se o estado, malha e quantidade de cidades reais não mudaram
    const signature = `${stateCode}:${filteredStateFeatures.length}:${filteredRealCities.length}:${isCoverageComplete}`;
    if (signature === processedSignatureRef.current) return;
    processedSignatureRef.current = signature;

    setCurrentMap((prev) => {
      // 1. Constrói mapa base com todos os dados reais conhecidos
      const realOnlyMap = new Map<string, WeatherCity>();

      // Preserva medições reais que já estavam no mapa anterior (ex: do cache ou seleções manuais) do estado ativo
      for (const [id, city] of prev) {
        if (!city.isInferred && id.startsWith(stateCode)) {
          realOnlyMap.set(id, city);
        }
      }

      // Mescla com as cidades reais atuais
      for (const city of filteredRealCities) {
        realOnlyMap.set(city.id, { ...city, isInferred: false });
      }

      const allRealCities = [...realOnlyMap.values()];
      let merged = new Map<string, WeatherCity>(realOnlyMap);

      // 2. Se a cobertura de dados reais ainda não for total,
      // recalcula a interpolação para os municípios restantes com base no conjunto expandido de cidades reais.
      // A cada novo lote que chega em segundo plano, as estimativas são refinadas aumentando a resolução espacial.
      if (allRealCities.length < filteredStateFeatures.length) {
        const estimatedMap = interpolateStateWeather(
          filteredStateFeatures,
          allRealCities,
          filteredStateFeatures[0]?.properties?.abbreviation || '',
        );
        merged = mergeWeatherWithPrecedence(merged, estimatedMap);
      }

      // 3. Salva no cache com TTL e persiste na sessão
      stateWeatherCache.set(stateCode, {
        weatherByCode: merged,
        timestamp: Date.now(),
      });
      saveStateToSession(stateCode, merged);

      return merged;
    });
  }, [enabled, stateCode, filteredStateFeatures, filteredRealCities, isCoverageComplete]);

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

  const totalCount = filteredStateFeatures.length;
  const realCount = measuredCities.length;
  const inferredCount = Math.max(0, currentMap.size - realCount);

  const isFinal = isCoverageComplete || (totalCount > 0 && realCount >= totalCount);
  const stage = !enabled || !stateCode
    ? 'idle'
    : isFinal
      ? 'final'
      : realCount > 16
        ? 'progressive'
        : realCount > 0
          ? 'immediate'
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

