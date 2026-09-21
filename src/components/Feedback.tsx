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

export interface ErrorDescription {
  /** O que aconteceu — a mensagem do backend, quando há uma. */
  message: string;
  /** O que acontece agora: nova tentativa automática, ou quando o usuário pedir. */
  hint?: string;
}

function clockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Traduz uma falha em texto para a pessoa: a causa real (a mensagem do
 * backend já é escrita para o usuário) e o próximo passo.
 */
export function describeError(error: unknown): ErrorDescription {
  if (typeof error === 'string') return { message: error };
  if (error instanceof ApiError) {
    if (error.isRateLimited || error.retryAt === null) {
      return {
        message: error.message,
        hint: 'As consultas automáticas ficam pausadas até você tentar novamente.',
      };
    }
    if (error.retryAt) {
      return {
        message: error.message,
        hint: `Nova tentativa automática às ${clockTime(error.retryAt)}.`,
      };
    }
    if (error.code === 'http_error' && error.status >= 500) {
      return { message: error.message, hint: 'Tente novamente em instantes.' };
    }
    return { message: error.message };
  }
  if (error instanceof TypeError) {
    return {
      message: 'Sem conexão com o servidor.',
      hint: 'Verifique sua conexão; as consultas são refeitas automaticamente.',
    };
  }
  return { message: 'Não foi possível carregar os dados. Tente novamente em instantes.' };
}

export function ErrorMessage({ error }: { error: unknown }) {
  const { message, hint } = describeError(error);
  return (
    <div className="notice notice-error" role="alert">
      {message}
      {hint && <span className="notice-hint">{hint}</span>}
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
