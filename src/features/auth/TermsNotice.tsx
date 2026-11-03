import { ApiError } from '@/api/client';
import { LEGAL_PATHS, LEGAL_UPDATED } from '@/features/legal/routes';
import { useAuth } from './AuthContext';
import { useModalDialog } from '@/lib/useModalDialog';

// Contas anteriores à versão vigente: o mapa fica atrás do aceite, e a saída é sair da conta.
export function TermsNotice() {
  const auth = useAuth()!;
  const dialog = useModalDialog();
  const busy = auth.acceptingTerms || auth.loggingOut;
  return (
    <dialog
      ref={dialog}
      className="account-dialog"
      aria-labelledby="terms-notice-title"
      onCancel={(event) => event.preventDefault()}
    >
      <div className="account-card">
        <header className="account-header">
          <h2 id="terms-notice-title">Atualizamos a Política e os Termos</h2>
        </header>
        <p>
          Publicamos em {LEGAL_UPDATED} a{' '}
          <a href={LEGAL_PATHS.privacy} target="_blank" rel="noreferrer">
            Política de Privacidade
          </a>{' '}
          e os{' '}
          <a href={LEGAL_PATHS.terms} target="_blank" rel="noreferrer">
            Termos de Uso
          </a>{' '}
          do Brasil Lens. Para continuar usando a sua conta, leia e aceite os dois.
        </p>
        <p className="account-muted">
          Em resumo: guardamos só o necessário para a sua conta, notificações e localização são
          opcionais, e você pode baixar seus dados ou excluir a conta quando quiser.
        </p>
        {auth.termsError && (
          <p className="auth-error" role="alert">
            {auth.termsError instanceof ApiError
              ? auth.termsError.message
              : 'Não foi possível salvar o aceite. Confira sua conexão e tente novamente.'}
          </p>
        )}
        <div className="account-actions">
          <button type="button" className="account-secondary" disabled={busy} onClick={auth.logout}>
            {auth.loggingOut ? 'Saindo…' : 'Sair da conta'}
          </button>
          <button
            type="button"
            className="account-primary"
            data-autofocus
            disabled={busy}
            onClick={auth.acceptTerms}
          >
            {auth.acceptingTerms ? 'Salvando…' : 'Li e aceito'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
