import { useEffect, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiPost, apiPut, onAuthenticationRequired } from '@/api/client';
import type { LoginRequest, RegisterRequest, User } from '@/api/types';
import { crossfade, finishEntryAnimations, waitFor } from '@/app/crossfade';
import { restoreTheme } from '@/app/theme';
import { AuthContext } from './AuthContext';
import { disableDevice } from '@/features/notifications/device';

const AUTH_KEY = ['auth', 'me'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const account = useQuery({
    queryKey: AUTH_KEY,
    queryFn: async ({ signal }) => {
      try {
        return await apiGet<User>('/auth/me', undefined, signal);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const user = account.data ?? null;
  const userTheme = user?.theme;

  const clearPrivateData = async () => {
    await client.cancelQueries({ queryKey: ['me'] });
    client.removeQueries({ queryKey: ['me'] });
  };

  useEffect(() => {
    if (userTheme) restoreTheme(userTheme);
  }, [user?.id, userTheme]);

  useEffect(
    () =>
      onAuthenticationRequired(() => {
        client.setQueryData(AUTH_KEY, null);
        void client
          .cancelQueries({ queryKey: ['me'] })
          .then(() => client.removeQueries({ queryKey: ['me'] }));
      }),
    [client],
  );

  const credentials = useMutation({
    mutationFn: (body: LoginRequest | RegisterRequest) =>
      apiPost<User>('name' in body ? '/auth/register' : '/auth/login', body),
    onSuccess: async (next) => {
      await client.cancelQueries({ queryKey: AUTH_KEY });
      await clearPrivateData();
      // A tela de acesso se dissolve no mapa, já com o tema da conta.
      await crossfade('screen', async () => {
        restoreTheme(next.theme);
        client.setQueryData(AUTH_KEY, next);
        await waitFor(() => document.querySelector('.leaflet-container') !== null, 300);
        finishEntryAnimations();
      });
      theme.reset();
      logout.reset();
    },
  });
  const logout = useMutation({
    mutationFn: async () => {
      await disableDevice();
      await apiPost<void>('/auth/logout', undefined);
    },
    onSuccess: async () => {
      await client.cancelQueries({ queryKey: AUTH_KEY });
      await crossfade('screen', () => {
        client.setQueryData(AUTH_KEY, null);
      });
      await clearPrivateData();
      credentials.reset();
      theme.reset();
    },
  });
  const theme = useMutation({
    mutationKey: ['me', user?.id, 'theme'],
    mutationFn: (value: User['theme']) => apiPut<User>('/me/preferences', { theme: value }),
    onSuccess: async (next) => {
      await client.cancelQueries({ queryKey: AUTH_KEY });
      client.setQueryData<User | null>(AUTH_KEY, (current) =>
        current?.id === next.id ? next : current,
      );
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: account.isPending,
        loadError: account.error,
        reload: () => {
          void account.refetch();
        },
        submit: credentials.mutate,
        submitting: credentials.isPending,
        submitError: credentials.error,
        resetSubmit: credentials.reset,
        logout: () => logout.mutate(),
        loggingOut: logout.isPending,
        logoutError: logout.error,
        saveTheme: theme.mutate,
        savingTheme: theme.isPending,
        themeError: theme.error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
