/**
 * Motor de busca de territórios (estados e municípios).
 *
 * A busca por nome que a API já expõe (`/territories?search=`) é um `ILIKE`
 * puro no banco: não ignora acento. "sao paulo" não acha "São Paulo" — e é
 * assim que a maior parte das pessoas digita, sem acento, por hábito ou
 * teclado. Em vez de resolver isso no banco, o catálogo inteiro (27 estados +
 * ~5.600 municípios, ver `useSearchIndex`) é buscado uma vez e casado aqui,
 * no cliente: nome e sigla comparados sem acento e sem caixa, com pontuação
 * que prioriza início de palavra sobre "contém em qualquer lugar do nome".
 */
import type { TerritoryLevel } from '@/api/types';

export interface SearchableTerritory {
  ibgeCode: string;
  name: string;
  level: TerritoryLevel;
  abbreviation: string | null;
  parentCode: string | null;
  parentName: string | null;
}

interface IndexedTerritory extends SearchableTerritory {
  normalizedName: string;
  normalizedAbbreviation: string | null;
}

export interface SearchResult extends SearchableTerritory {
  /** Quanto menor, mais direto o casamento (0 = sigla exata, 1 = nome exato...). */
  score: number;
}

const DEFAULT_LIMIT = 8;

/** Minúsculo e sem diacríticos: "São Paulo" e "sao paulo" viram o mesmo texto. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Pré-computa a forma normalizada uma vez, não a cada tecla digitada. */
export function buildSearchIndex(territories: SearchableTerritory[]): IndexedTerritory[] {
  return territories.map((territory) => ({
    ...territory,
    normalizedName: normalize(territory.name),
    normalizedAbbreviation: territory.abbreviation ? normalize(territory.abbreviation) : null,
  }));
}

/**
 * `null` quando não casa. Ordem dos testes é a ordem de relevância: sigla
 * exata ("SP") e nome exato vêm antes de "começa com", que vem antes de
 * "alguma palavra do nome começa com" (acha "São Paulo" digitando "paulo"),
 * que vem antes de "aparece em algum lugar" (o caso mais fraco).
 */
function scoreMatch(query: string, item: IndexedTerritory): number | null {
  if (item.normalizedAbbreviation === query) return 0;
  if (item.normalizedName === query) return 1;
  if (item.normalizedName.startsWith(query)) return 2;
  if (item.normalizedName.split(' ').some((word) => word.startsWith(query))) return 3;
  if (item.normalizedAbbreviation?.startsWith(query)) return 4;
  // "Contém em qualquer lugar" só a partir de 3 letras: com 2, um dígrafo
  // como "rj" aparece no meio de dezenas de nomes (Varjão, Gurjão...) sem
  // ter relação nenhuma com o Rio de Janeiro que a sigla já achou acima.
  if (query.length >= 3 && item.normalizedName.includes(query)) return 5;
  return null;
}

export function searchTerritories(
  query: string,
  index: IndexedTerritory[],
  limit = DEFAULT_LIMIT,
): SearchResult[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const matches: Array<{ item: IndexedTerritory; score: number }> = [];
  for (const item of index) {
    const score = scoreMatch(normalizedQuery, item);
    if (score !== null) matches.push({ item, score });
  }

  matches.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    // Em empate, o nome mais curto tende a ser o resultado mais direto (ex.:
    // "Paulo" antes de "São Paulo de Olivença") e estado antes de município.
    if (a.item.level !== b.item.level) return a.item.level === 'state' ? -1 : 1;
    if (a.item.normalizedName.length !== b.item.normalizedName.length) {
      return a.item.normalizedName.length - b.item.normalizedName.length;
    }
    return a.item.name.localeCompare(b.item.name, 'pt-BR');
  });

  return matches.slice(0, limit).map(({ item, score }) => ({
    ibgeCode: item.ibgeCode,
    name: item.name,
    level: item.level,
    abbreviation: item.abbreviation,
    parentCode: item.parentCode,
    parentName: item.parentName,
    score,
  }));
}

export type { IndexedTerritory };
