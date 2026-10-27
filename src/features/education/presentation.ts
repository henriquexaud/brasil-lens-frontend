import type { EducationInstitutionDetail, MapValuesResponse } from '@/api/types';
import type { TerritoryPresentation } from '@/features/map/TerritoryPresentation';
import { NO_DATA_COLOR } from '@/features/socioeconomic/colors';
import { presentationFor } from '@/features/socioeconomic/presentation';
import { formatCount, institutionName } from './education';

export const NO_OFFER = 'Sem oferta presencial';

// No Censo, território sem valor é território sem curso presencial da rede: não
// é falta de dado, e o tooltip diz isso.
export function educationPresentation(data: MapValuesResponse): TerritoryPresentation {
  const base = presentationFor(data);
  const tooltips = new Map(base.tooltips);
  for (const item of data.values) {
    if (item.value === null) {
      const tooltip = tooltips.get(item.ibgeCode);
      if (tooltip) tooltips.set(item.ibgeCode, { ...tooltip, value: NO_OFFER });
    }
  }
  return { ...base, tooltips };
}

/**
 * Com uma instituição aberta, o mapa mantém a escala da rede e apaga o resto:
 * só os municípios onde ela tem curso presencial (e, no Brasil, as UFs deles)
 * ficam pintados. A legenda continua valendo para o que aparece.
 */
export function highlightInstitution(
  presentation: TerritoryPresentation,
  institution: EducationInstitutionDetail,
): TerritoryPresentation {
  const campuses = new Map(institution.campuses.map((item) => [item.code, item]));
  const states = new Set(institution.campuses.map((item) => item.code.slice(0, 2)));
  const label = institution.acronym ?? institutionName(institution.name, null);
  const neutral = `var(--map-neutral, ${NO_DATA_COLOR})`;
  const colors = new Map<string, string>();
  const tooltips = new Map(presentation.tooltips);
  for (const [code, color] of presentation.colors) {
    const campus = campuses.get(code);
    colors.set(code, campus || states.has(code) ? color : neutral);
    if (campus) {
      const tooltip = tooltips.get(code);
      if (tooltip)
        tooltips.set(code, {
          ...tooltip,
          meta: `${tooltip.meta} · ${label}: ${formatCount(campus.enrollment)}`,
        });
    }
  }
  return {
    key: `${presentation.key}:institution:${institution.code}`,
    colors,
    values: new Set(
      [...presentation.values].filter((code) => campuses.has(code) || states.has(code)),
    ),
    tooltips,
  };
}
