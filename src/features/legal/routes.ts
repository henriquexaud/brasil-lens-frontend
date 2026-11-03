// Versão vigente da Política e dos Termos: mude junto com `TERMS_VERSION` em
// `backend/app/core/legal.py`. Contas que aceitaram uma versão anterior veem o aviso ao entrar.
export const LEGAL_VERSION = '2026-11-02';
export const LEGAL_UPDATED = '2 de novembro de 2026';
export const CONTACT_EMAIL = 'contato@brasillens.com.br';

export type LegalDocument = 'privacy' | 'terms';

export const LEGAL_PATHS: Record<LegalDocument, string> = {
  privacy: '/privacidade',
  terms: '/termos',
};

// Páginas públicas: abrem sem conta, antes da tela de acesso.
export function legalDocumentFor(pathname: string): LegalDocument | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === LEGAL_PATHS.privacy) return 'privacy';
  if (path === LEGAL_PATHS.terms) return 'terms';
  return null;
}
