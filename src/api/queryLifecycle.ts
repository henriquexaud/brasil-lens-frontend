import { hashKey, type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { scheduleIdle } from '@/lib/idle';

/**
 * Cancela a requisição em voo quando a consulta é desligada ou deixa a tela.
 *
 * A chave entra nas dependências pelo hash: um array novo a cada render não
 * pode reexecutar o efeito — e cancelar — sem que a chave tenha mudado. O
 * `JSON.parse` reconstrói uma chave com o mesmo hash, que é o que o filtro
 * `exact` compara.
 */
export function useCancelWhenDisabled(queryKey: QueryKey, enabled: boolean) {
  const client = useQueryClient();
  const hash = hashKey(queryKey);
  useEffect(() => {
    const filters = { queryKey: JSON.parse(hash) as QueryKey, exact: true };
    if (!enabled) void client.cancelQueries(filters);
    return () => {
      void client.cancelQueries(filters);
    };
  }, [client, enabled, hash]);
}

interface PagedQueryState {
  hasNextPage: boolean;
  isFetching: boolean;
  isError: boolean;
  fetchNextPage: () => Promise<unknown>;
}

/** Completa as páginas seguintes na ociosidade, uma por vez, enquanto `active`. */
export function useIdleNextPage(
  { hasNextPage, isFetching, isError, fetchNextPage }: PagedQueryState,
  active: boolean,
  pageCount: number,
  delay: number,
) {
  useEffect(() => {
    if (!active || !hasNextPage || isFetching || isError) return;
    return scheduleIdle(() => {
      void fetchNextPage();
    }, delay);
  }, [active, hasNextPage, isFetching, isError, fetchNextPage, pageCount, delay]);
}
