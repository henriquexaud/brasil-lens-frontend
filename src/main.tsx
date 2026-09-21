import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ApiError, isTransientError, onSourceRecovered } from './api/client';
import App from './App';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Os dados mudam apenas quando a ingestão roda: refetch automático em
      // foco ou reconexão só geraria tráfego sem informação nova.
      refetchOnWindowFocus: false,
      // Só falhas passageiras (rede, servidor reiniciando) são repetidas, até
      // duas vezes e com espera crescente (1 s, 2 s). Validação, 404, fonte
      // externa fora do ar ou sem cota não mudam em um segundo: a pausa por
      // fonte em `api/client.ts` decide quando tentar de novo.
      retry: (failureCount, error) => failureCount < 2 && isTransientError(error),
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      // `networkMode` fica no padrão ('online') de propósito: quando o
      // aparelho está de fato sem rede, pausar e retomar na reconexão é
      // melhor que falhar. Falha da API com rede disponível já resulta em
      // erro normal, propagado até a mensagem na tela.
    },
  },
});

// Terminada a pausa automática de uma fonte, as consultas que falharam por
// causa dela voltam sozinhas. Cota esgotada não entra aqui: ela só é liberada
// pelo botão "Tentar novamente".
onSourceRecovered((source) => {
  void queryClient.invalidateQueries({
    predicate: (query) => {
      const error = query.state.error;
      return error instanceof ApiError && error.source === source;
    },
  });
});

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado.');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
