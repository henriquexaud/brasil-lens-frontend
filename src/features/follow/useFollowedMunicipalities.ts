import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPut } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import type { FollowedMunicipality, FollowedMunicipalityListResponse } from '@/api/types';

/* ------------------------------------------------------ municípios seguidos --
 *
 * Ao contrário das visualizações, estas escritas **são otimistas**: seguir é
 * um alternador de um toque, e esperar o servidor para acender o botão faria
 * o clique parecer perdido. O backend continua sendo a fonte de verdade — a
 * falha desfaz a mudança local e, ao final, a lista é relida do servidor.
 *
 * PUT/DELETE são idempotentes no backend, então repetir o pedido (duplo clique,
 * alternar rápido) nunca vira erro. E todas as escritas dividem um `scope`: o
 * cache muda no clique, mas as requisições saem em fila, na ordem dos cliques —
 * um "seguir" seguido de "deixar" nunca chega invertido ao servidor.
 */

const FOLLOW_MUTATION_KEY = ['me', 'followed-municipalities', 'write'] as const;
const FOLLOWED_PATH = '/me/followed-municipalities';

/**
 * Lista do usuário. Pequena e pessoal: carregada uma vez ao entrar no clima e
 * mantida em cache, para que abrir um município já saiba se ele é seguido.
 */
export function useFollowedMunicipalities(enabled = true) {
  return useQuery({
    queryKey: queryKeys.followedMunicipalities(),
    queryFn: ({ signal }) =>
      apiGet<FollowedMunicipalityListResponse>(FOLLOWED_PATH, undefined, signal),
    enabled,
    staleTime: 60 * 1000,
  });
}

type FollowListSnapshot = { previous: FollowedMunicipalityListResponse | undefined };

/**
 * Ciclo otimista comum a seguir e deixar de seguir: aplica `update` no cache,
 * desfaz em caso de erro e relê a lista quando a *última* escrita em curso
 * termina — reler no meio de uma sequência rápida traria de volta um estado
 * intermediário e faria o botão piscar.
 */
function useOptimisticFollowMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  update: (list: FollowedMunicipality[], variables: TVariables) => FollowedMunicipality[],
) {
  const queryClient = useQueryClient();
  const key = queryKeys.followedMunicipalities();
  return useMutation<unknown, Error, TVariables, FollowListSnapshot>({
    mutationKey: FOLLOW_MUTATION_KEY,
    scope: { id: FOLLOW_MUTATION_KEY.join('/') },
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FollowedMunicipalityListResponse>(key);
      queryClient.setQueryData<FollowedMunicipalityListResponse>(key, {
        municipalities: update(previous?.municipalities ?? [], variables),
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: FOLLOW_MUTATION_KEY }) === 1) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

/** O que a interface já sabe do município — só para a linha otimista. */
export type FollowTarget = Omit<FollowedMunicipality, 'followedAt'>;

export function useFollowMunicipality() {
  return useOptimisticFollowMutation(
    (target: FollowTarget) =>
      apiPut<FollowedMunicipality>(`${FOLLOWED_PATH}/${target.municipalityCode}`, undefined),
    (list, target) =>
      list.some((item) => item.municipalityCode === target.municipalityCode)
        ? list
        : [{ ...target, followedAt: new Date().toISOString() }, ...list],
  );
}

export function useUnfollowMunicipality() {
  return useOptimisticFollowMutation(
    (code: string) => apiDelete(`${FOLLOWED_PATH}/${code}`),
    (list, code) => list.filter((item) => item.municipalityCode !== code),
  );
}
