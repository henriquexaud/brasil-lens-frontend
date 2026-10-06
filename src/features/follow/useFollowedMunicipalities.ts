import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import type { FollowedMunicipality, FollowedMunicipalityListResponse } from '@/api/types';
import { useAuth } from '@/features/auth/AuthContext';

const FOLLOW_MUTATION_KEY = ['me', 'followed-municipalities', 'write'] as const;
const FOLLOWED_PATH = '/me/followed-municipalities';

export function useFollowedMunicipalities(enabled = true) {
  const userId = useAuth()?.user?.id ?? null;
  return useQuery({
    queryKey: queryKeys.followedMunicipalities(userId),
    queryFn: ({ signal }) =>
      apiGet<FollowedMunicipalityListResponse>(FOLLOWED_PATH, undefined, signal),
    enabled: enabled && userId !== null,
    staleTime: 60 * 1000,
  });
}

type FollowListSnapshot = { previous: FollowedMunicipalityListResponse | undefined };

function useOptimisticFollowMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  update: (list: FollowedMunicipality[], variables: TVariables) => FollowedMunicipality[],
) {
  const queryClient = useQueryClient();
  const userId = useAuth()?.user?.id ?? null;
  const key = queryKeys.followedMunicipalities(userId);
  return useMutation<unknown, Error, TVariables, FollowListSnapshot>({
    mutationKey: ['me', userId, ...FOLLOW_MUTATION_KEY.slice(1)],
    scope: { id: `me/${userId}/followed-municipalities` },
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
      if (
        queryClient.isMutating({ mutationKey: ['me', userId, 'followed-municipalities'] }) === 1
      ) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export type FollowTarget = Omit<FollowedMunicipality, 'followedAt' | 'notificationsEnabled'>;

export function useFollowMunicipality() {
  return useOptimisticFollowMutation(
    (target: FollowTarget) =>
      apiPut<FollowedMunicipality>(`${FOLLOWED_PATH}/${target.municipalityCode}`, undefined),
    (list, target) =>
      list.some((item) => item.municipalityCode === target.municipalityCode)
        ? list
        : [
            { ...target, followedAt: new Date().toISOString(), notificationsEnabled: true },
            ...list,
          ],
  );
}

export function useUnfollowMunicipality() {
  return useOptimisticFollowMutation(
    (code: string) => apiDelete(`${FOLLOWED_PATH}/${code}`),
    (list, code) => list.filter((item) => item.municipalityCode !== code),
  );
}

export interface SetNotificationsVariables {
  code: string;
  enabled: boolean;
}

export function useSetMunicipalityNotifications() {
  return useOptimisticFollowMutation(
    ({ code, enabled }: SetNotificationsVariables) =>
      apiPost<FollowedMunicipality>(`${FOLLOWED_PATH}/${code}/notifications`, { enabled }),
    (list, { code, enabled }) =>
      list.map((item) =>
        item.municipalityCode === code ? { ...item, notificationsEnabled: enabled } : item,
      ),
  );
}
