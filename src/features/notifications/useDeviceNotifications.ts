import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/api/client';
import type { PushConfig } from '@/api/types';
import { useAuth } from '@/features/auth/AuthContext';
import {
  disableDevice,
  enableDevice,
  existingSubscription,
  saveSubscription,
  supportsPush,
} from './device';

export function useDeviceNotifications() {
  const userId = useAuth()?.user?.id ?? null;
  const client = useQueryClient();
  const supported = supportsPush();
  const key = ['me', userId, 'push-device'] as const;
  const config = useQuery({
    queryKey: ['me', userId, 'push-config'],
    queryFn: ({ signal }) => apiGet<PushConfig>('/me/notifications/config', undefined, signal),
    enabled: supported && !!userId,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const device = useQuery({
    queryKey: key,
    queryFn: existingSubscription,
    enabled: supported && !!userId,
    staleTime: Infinity,
    refetchOnWindowFocus: 'always',
    retry: false,
  });
  const { mutate: restore, error: restoreError } = useMutation({
    mutationKey: ['me', userId, 'push-restore'],
    mutationFn: saveSubscription,
  });
  useEffect(() => {
    if (userId && device.data) restore(device.data);
  }, [userId, device.data, restore]);
  const enable = useMutation({
    mutationKey: ['me', userId, 'push-enable'],
    mutationFn: () => {
      if (!config.data?.publicKey)
        throw new Error('As notificações ainda não estão disponíveis. Tente novamente mais tarde.');
      return enableDevice(config.data.publicKey);
    },
    onSuccess: (subscription) => client.setQueryData(key, subscription),
  });
  const disable = useMutation({
    mutationKey: ['me', userId, 'push-disable'],
    mutationFn: disableDevice,
    onSuccess: () => client.setQueryData(key, null),
  });
  return {
    supported,
    enabled: !!device.data,
    available: !!config.data?.publicKey,
    checking: supported && config.isPending,
    busy: enable.isPending || disable.isPending,
    error: enable.error ?? disable.error ?? restoreError ?? config.error ?? device.error,
    enable: enable.mutateAsync,
    disable: () => disable.mutate(),
  };
}
