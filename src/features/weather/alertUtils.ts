import type { WeatherAlertFeature } from '@/api/types';
import { getAlertStyle, SEVERITY_RANK, type AlertSeverityTier } from './alertStyles';

/** Mapeamento canônico dos códigos IBGE de 2 dígitos para siglas de UF. */
export const IBGE_UF_MAP: Record<string, string> = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF',
};

export const UF_NAMES: Record<string, string> = {
  RO: 'Rondônia',
  AC: 'Acre',
  AM: 'Amazonas',
  RR: 'Roraima',
  PA: 'Pará',
  AP: 'Amapá',
  TO: 'Tocantins',
  MA: 'Maranhão',
  PI: 'Piauí',
  CE: 'Ceará',
  RN: 'Rio Grande do Norte',
  PB: 'Paraíba',
  PE: 'Pernambuco',
  AL: 'Alagoas',
  SE: 'Sergipe',
  BA: 'Bahia',
  MG: 'Minas Gerais',
  ES: 'Espírito Santo',
  RJ: 'Rio de Janeiro',
  SP: 'São Paulo',
  PR: 'Paraná',
  SC: 'Santa Catarina',
  RS: 'Rio Grande do Sul',
  MS: 'Mato Grosso do Sul',
  MT: 'Mato Grosso',
  GO: 'Goiás',
  DF: 'Distrito Federal',
};

/**
 * Remove URLs cruas do texto para evitar poluição visual e extrai
 * os links válidos para ações dedicadas ("Ver boletim oficial").
 */
export function extractAlertUrls(text: string): { cleanedText: string; urls: string[] } {
  if (!text) return { cleanedText: '', urls: [] };
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls: string[] = [];
  const matches = text.match(urlRegex);
  if (matches) {
    for (const match of matches) {
      // Remove pontuação final como ponto, vírgula, parênteses
      const cleanUrl = match.replace(/[.,;)]+$/, '');
      if (!urls.includes(cleanUrl)) {
        urls.push(cleanUrl);
      }
    }
  }

  // Remove URLs do texto
  let cleanedText = text.replace(urlRegex, '').trim();

  // Limpa frases residuais de introdução a boletim (CEMADEN / INMET)
  cleanedText = cleanedText
    .replace(/^(?:para mais informações,?\s*)?(?:consulte o\s+)?boletim(?:\s+oficial)?(?:\s+do\s+\w+)?:?\s*$/i, '')
    .replace(/:\s*$/, '')
    .trim();

  return { cleanedText, urls };
}

/**
 * Verifica se um alerta afeta ou pertence a um determinado estado (código IBGE de 2 dígitos).
 */
export function isAlertInState(alert: WeatherAlertFeature, stateCode?: string | null): boolean {
  if (!stateCode) return true;
  const codes = alert.properties.affectedIbgeCodes ?? [];
  if (codes.some((code) => code.startsWith(stateCode) || code === stateCode)) {
    return true;
  }
  const uf = IBGE_UF_MAP[stateCode];
  if (uf && alert.properties.description) {
    const desc = alert.properties.description.trim().toUpperCase();
    if (desc.endsWith(`/${uf}`) || desc.endsWith(` - ${uf}`) || desc.includes(`/${uf}`)) {
      return true;
    }
  }
  return false;
}

/** Formata data de expiração/vigência de forma concisa. */
export function formatAlertDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const parsed = Date.parse(dateStr);
  if (Number.isNaN(parsed)) return '—';
  const date = new Date(parsed);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Extrai a lista de siglas de UFs afetadas por um alerta. */
export function getAlertStates(alert: WeatherAlertFeature): string[] {
  const ufs = new Set<string>();
  const codes = alert.properties.affectedIbgeCodes ?? [];
  for (const code of codes) {
    const ufCode = code.slice(0, 2);
    const uf = IBGE_UF_MAP[ufCode];
    if (uf) {
      ufs.add(uf);
    }
  }
  return Array.from(ufs);
}

export interface NationalAlertsSummaryData {
  totalAlerts: number;
  affectedStatesCount: number;
  severityDistribution: Record<'extreme' | 'very_high' | 'high' | 'moderate', number>;
  sources: {
    cemaden: number;
    inmet: number;
    [key: string]: number;
  };
  topStates: Array<{ uf: string; count: number }>;
}

/** Agrega os alertas de todo o país para o resumo compacto da visualização nacional. */
export function getNationalAlertsSummary(
  features: WeatherAlertFeature[] = [],
): NationalAlertsSummaryData {
  const totalAlerts = features.length;
  const stateCounts = new Map<string, number>();
  const severityDistribution: Record<'extreme' | 'very_high' | 'high' | 'moderate', number> = {
    extreme: 0,
    very_high: 0,
    high: 0,
    moderate: 0,
  };
  const sources = {
    cemaden: 0,
    inmet: 0,
  };

  for (const feature of features) {
    const style = getAlertStyle(feature.properties);
    const tier = style.tier in severityDistribution ? (style.tier as keyof typeof severityDistribution) : 'moderate';
    severityDistribution[tier] = (severityDistribution[tier] ?? 0) + 1;

    const provider = (feature.properties.provider ?? '').toLowerCase();
    if (provider === 'cemaden') {
      sources.cemaden++;
    } else if (provider === 'inmet') {
      sources.inmet++;
    }

    const states = getAlertStates(feature);
    for (const uf of states) {
      stateCounts.set(uf, (stateCounts.get(uf) ?? 0) + 1);
    }
  }

  const topStates = Array.from(stateCounts.entries())
    .map(([uf, count]) => ({ uf, count }))
    .sort((a, b) => b.count - a.count || a.uf.localeCompare(b.uf))
    .slice(0, 4);

  return {
    totalAlerts,
    affectedStatesCount: stateCounts.size,
    severityDistribution,
    sources,
    topStates,
  };
}

export interface GroupedMunicipality {
  name: string;
  bulletinUrl?: string;
}

export interface GroupedStateAlert {
  id: string;
  isGroup: boolean;
  event: string;
  tier: AlertSeverityTier;
  provider: string;
  count: number;
  municipalities: GroupedMunicipality[];
  features: WeatherAlertFeature[];
  bulletinUrls: string[];
  primaryFeature: WeatherAlertFeature;
}

/**
 * Agrupa ocorrências semelhantes de um estado (ex.: "Risco hidrológico · 8 municípios")
 * para reduzir fortemente a poluição visual na visão de estado.
 */
export function groupStateAlerts(
  features: WeatherAlertFeature[],
  stateCode: string,
): GroupedStateAlert[] {
  // Filtra apenas os que pertencem ou intersectam o estado
  const stateFeatures = features.filter((alert) => isAlertInState(alert, stateCode));

  // Chave de agrupamento: evento normalizado + severidade normalizada + provider
  const groupsMap = new Map<string, WeatherAlertFeature[]>();

  for (const alert of stateFeatures) {
    const tier = getAlertStyle(alert.properties).tier;
    const provider = alert.properties.provider;
    // Remove sufixos como "- Moderado", "- Alto" para agrupar pelo tipo de evento real
    const event = alert.properties.event.replace(/\s*-\s*(Moderado|Alto|Muito Alto|Extremo|Perigo.*)$/i, '').trim();
    const groupKey = `${provider}:${event.toLowerCase()}:${tier}`;

    const existing = groupsMap.get(groupKey);
    if (existing) {
      existing.push(alert);
    } else {
      groupsMap.set(groupKey, [alert]);
    }
  }

  const result: GroupedStateAlert[] = [];

  for (const [, groupFeatures] of groupsMap) {
    const primary = groupFeatures[0];
    if (!primary) continue;
    const style = getAlertStyle(primary.properties);
    const event = primary.properties.event.replace(/\s*-\s*(Moderado|Alto|Muito Alto|Extremo|Perigo.*)$/i, '').trim();
    const provider = primary.properties.provider;

    // Coleta municípios com seu boletim específico e URLs consolidadas de boletim
    const municipalitiesMap = new Map<string, string | undefined>();
    const bulletinUrlsSet = new Set<string>();

    for (const feat of groupFeatures) {
      let featureBulletinUrl: string | undefined;

      // Instruções e riscos podem ter links de boletim
      for (const inst of feat.properties.instructions ?? []) {
        const { urls } = extractAlertUrls(inst);
        for (const u of urls) {
          bulletinUrlsSet.add(u);
          if (!featureBulletinUrl) featureBulletinUrl = u;
        }
      }
      for (const risk of feat.properties.risks ?? []) {
        const { urls } = extractAlertUrls(risk);
        for (const u of urls) {
          bulletinUrlsSet.add(u);
          if (!featureBulletinUrl) featureBulletinUrl = u;
        }
      }

      // Descrição livre frequentemente contém o nome do município no CEMADEN
      if (feat.properties.description) {
        const cityName = feat.properties.description.replace(/\/[A-Z]{2}$/i, '').trim();
        if (cityName) {
          if (!municipalitiesMap.has(cityName) || (!municipalitiesMap.get(cityName) && featureBulletinUrl)) {
            municipalitiesMap.set(cityName, featureBulletinUrl);
          }
        }
      }
    }

    const singleUrl = bulletinUrlsSet.size === 1 ? Array.from(bulletinUrlsSet)[0] : undefined;
    const municipalities: GroupedMunicipality[] = Array.from(municipalitiesMap.entries())
      .map(([name, bulletinUrl]) => ({
        name,
        bulletinUrl: bulletinUrl ?? singleUrl,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    // Se há múltiplos alertas ou múltiplos municípios
    const totalCount = Math.max(groupFeatures.length, municipalities.length);
    const isGroup = totalCount > 1;

    result.push({
      id: `${primary.id}:group:${groupFeatures.length}`,
      isGroup,
      event,
      tier: style.tier,
      provider,
      count: totalCount,
      municipalities,
      features: groupFeatures,
      bulletinUrls: Array.from(bulletinUrlsSet),
      primaryFeature: primary,
    });
  }

  // Ordena pela maior severidade primeiro
  result.sort((a, b) => {
    const rankDiff = SEVERITY_RANK[a.tier] - SEVERITY_RANK[b.tier];
    if (rankDiff !== 0) return rankDiff;
    return b.count - a.count;
  });

  return result;
}

/**
 * Na visualização municipal:
 * - localAlerts: afetam diretamente o município selecionado
 * - otherStateAlerts: demais avisos da mesma UF
 */
export function partitionMunicipalityAlerts(
  features: WeatherAlertFeature[],
  municipalityCode: string,
  stateCode: string,
): {
  localAlerts: WeatherAlertFeature[];
  otherStateAlerts: WeatherAlertFeature[];
} {
  const localAlerts: WeatherAlertFeature[] = [];
  const otherStateAlerts: WeatherAlertFeature[] = [];

  for (const alert of features) {
    const affected = alert.properties.affectedIbgeCodes ?? [];
    const isDirectlyAffected =
      affected.includes(municipalityCode) ||
      (affected.length === 1 && affected[0] === stateCode);

    if (isDirectlyAffected) {
      localAlerts.push(alert);
    } else if (isAlertInState(alert, stateCode)) {
      otherStateAlerts.push(alert);
    }
  }

  // Ordena por severidade
  localAlerts.sort(
    (a, b) =>
      SEVERITY_RANK[getAlertStyle(a.properties).tier] -
      SEVERITY_RANK[getAlertStyle(b.properties).tier],
  );
  otherStateAlerts.sort(
    (a, b) =>
      SEVERITY_RANK[getAlertStyle(a.properties).tier] -
      SEVERITY_RANK[getAlertStyle(b.properties).tier],
  );

  return { localAlerts, otherStateAlerts };
}
