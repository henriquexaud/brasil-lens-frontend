import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Os dados mudam apenas quando a ingestão roda: refetch automático em
      // foco ou reconexão só geraria tráfego sem informação nova.
      refetchOnWindowFocus: false,
      retry: 1,
      // `networkMode` fica no padrão ('online') de propósito: quando o
      // aparelho está de fato sem rede, pausar e retomar na reconexão é
      // melhor que falhar. Falha da API com rede disponível já resulta em
      // erro normal, propagado até a mensagem na tela.
    },
  },
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
