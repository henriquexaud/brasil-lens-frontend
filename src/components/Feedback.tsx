/** Estados de carregamento, erro e vazio. */
import { ApiError } from '@/api/client';

/**
 * Indicador de carregamento em andamento: uma linha fina no topo do mapa.
 *
 * Substitui um cartão com spinner. Uma requisição em curso não é informação
 * que mereça um objeto flutuante próprio disputando atenção com o mapa.
 */
export function TopProgress() {
  return <div className="top-progress" role="status" aria-label="Carregando dados" />;
}

export function ErrorMessage({ error }: { error: unknown }) {
  const message =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? 'Não foi possível carregar os dados. Tente novamente em instantes.'
        : 'Erro inesperado.';

  return (
    <div className="notice notice-error" role="alert">
      {message}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="notice">
      <strong>{title}</strong>
      {hint && <span className="notice-hint">{hint}</span>}
    </div>
  );
}
