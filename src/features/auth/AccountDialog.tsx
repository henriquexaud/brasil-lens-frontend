import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { CONTACT_EMAIL, LEGAL_PATHS } from '@/features/legal/routes';
import { downloadAccountData } from './accountData';
import { useAuth } from './AuthContext';
import { useModalDialog } from '@/lib/useModalDialog';

function errorText(error: Error | null, fallback: string) {
  if (!error) return null;
  return error instanceof ApiError ? error.message : fallback;
}

export function AccountDialog({ onClose }: { onClose: () => void }) {
  const auth = useAuth()!;
  const user = auth.user!;
  const dialog = useModalDialog();
  const [confirming, setConfirming] = useState(false);
  const exporting = useMutation({
    mutationKey: ['me', user.id, 'export'],
    mutationFn: downloadAccountData,
  });
  const deleteError = errorText(
    auth.deleteError,
    'Não foi possível excluir a conta. Confira sua conexão e tente novamente.',
  );

  function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get('password');
    if (typeof password === 'string' && password) auth.deleteAccount(password);
  }

  return (
    <dialog
      ref={dialog}
      className="account-dialog"
      aria-labelledby="account-title"
      onClose={onClose}
      onCancel={(event) => {
        // Esc não interrompe uma exclusão em andamento.
        if (auth.deletingAccount) event.preventDefault();
      }}
      onClick={(event) => {
        if (event.target === dialog.current && !auth.deletingAccount) onClose();
      }}
    >
      <div className="account-card">
        <header className="account-header">
          <h2 id="account-title">Sua conta</h2>
          <button
            type="button"
            className="donation-close"
            aria-label="Fechar"
            disabled={auth.deletingAccount}
            onClick={onClose}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <dl className="account-identity">
          <dt>Nome</dt>
          <dd>{user.name}</dd>
          <dt>E-mail</dt>
          <dd>{user.email}</dd>
        </dl>

        <section className="account-section" aria-labelledby="account-privacy">
          <h3 id="account-privacy">Privacidade</h3>
          <p className="account-muted">
            Veja a{' '}
            <a href={LEGAL_PATHS.privacy} target="_blank" rel="noreferrer">
              Política de Privacidade
            </a>{' '}
            e os{' '}
            <a href={LEGAL_PATHS.terms} target="_blank" rel="noreferrer">
              Termos de Uso
            </a>
            . Dúvidas e pedidos: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
          <button
            type="button"
            className="account-secondary"
            disabled={exporting.isPending}
            onClick={() => exporting.mutate()}
          >
            {exporting.isPending ? 'Preparando arquivo…' : 'Baixar meus dados'}
          </button>
          {exporting.error && (
            <p className="auth-error" role="alert">
              {errorText(exporting.error, 'Não foi possível baixar os dados. Tente novamente.')}
            </p>
          )}
        </section>

        <section className="account-section" aria-labelledby="account-delete">
          <h3 id="account-delete">Excluir conta</h3>
          {confirming ? (
            <form className="account-delete" onSubmit={remove}>
              <p>
                Isso apaga de forma definitiva a sua conta, os municípios seguidos e as
                notificações. Não dá para desfazer.
              </p>
              <label htmlFor="account-password">Confirme com a sua senha</label>
              <input
                id="account-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                disabled={auth.deletingAccount}
                aria-invalid={Boolean(deleteError)}
                aria-describedby={deleteError ? 'account-delete-error' : undefined}
                onInput={() => auth.deleteError && auth.resetDelete()}
              />
              {deleteError && (
                <p id="account-delete-error" className="auth-error" role="alert">
                  {deleteError}
                </p>
              )}
              <div className="account-actions">
                <button
                  type="button"
                  className="account-secondary"
                  disabled={auth.deletingAccount}
                  onClick={() => {
                    setConfirming(false);
                    auth.resetDelete();
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="account-danger" disabled={auth.deletingAccount}>
                  {auth.deletingAccount ? 'Excluindo…' : 'Excluir definitivamente'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="account-muted">
                Apaga a conta e todos os dados dela. Você pode baixar seus dados antes.
              </p>
              <button
                type="button"
                className="account-secondary account-secondary--danger"
                onClick={() => setConfirming(true)}
              >
                Excluir minha conta
              </button>
            </>
          )}
        </section>
      </div>
    </dialog>
  );
}
