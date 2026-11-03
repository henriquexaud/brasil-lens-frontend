import { apiGet } from '@/api/client';
import type { AccountExport } from '@/api/types';

// Portabilidade (LGPD, art. 18): o arquivo nasce no navegador, a partir da resposta da API.
export async function downloadAccountData() {
  const data = await apiGet<AccountExport>('/me/data');
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: 'brasil-lens-meus-dados.json',
  });
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
