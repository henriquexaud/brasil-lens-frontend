/**
 * Seção de visualizações salvas.
 *
 * É a única parte da interface que **escreve** no backend, e usa os quatro
 * métodos HTTP com a semântica padrão de cada um:
 *
 *     GET    /views        → a lista abaixo
 *     POST   /views        → "Salvar atual"
 *     PUT    /views/{id}   → renomear (substituição completa do recorte)
 *     DELETE /views/{id}   → remover
 *
 * Nenhuma escrita é otimista: cada mutação invalida a lista e a interface passa
 * a refletir o banco. Em uma lista de marcadores, mostrar uma linha que o
 * servidor recusou seria pior que esperar 40 ms.
 *
 * O componente é uma *seção* do painel existente, como os controles e o
 * detalhe — não um terceiro objeto flutuante disputando espaço com o mapa.
 */
import { useRef, useState } from 'react';

import {
  useCreateSavedView,
  useDeleteSavedView,
  useSavedViews,
  useTerritories,
  useUpdateSavedView,
} from '@/api/queries';
import type { Indicator, MapScopeInput, SavedView } from '@/api/types';
import { ErrorMessage } from '@/components/Feedback';
import { levelPluralLabel } from '@/lib/format';

const NAME_MAX_LENGTH = 80;

interface Props {
  /** Recorte em exibição — é ele que "Salvar atual" grava. */
  current: MapScopeInput;
  /** Nome do território pai do recorte atual, quando há drill-down. */
  currentParentName: string | null;
  /** Catálogo já carregado pelo App: evita um request só para exibir nomes. */
  indicators: Indicator[];
  /** Aplica uma visualização ao mapa. O nome do pai chega resolvido. */
  onApply: (view: SavedView, parentName: string | null) => void;
}

/** "Municípios de São Paulo", "Estados" — a parte territorial do rótulo. */
function scopeLabel(scope: Pick<SavedView, 'level' | 'parentCode'>, parentName: string | null) {
  return scope.parentCode
    ? `Municípios de ${parentName ?? scope.parentCode}`
    : levelPluralLabel(scope.level);
}

/**
 * Campo de nome com botão de salvar.
 *
 * Compartilhado por "Salvar atual" e pelo renomear: os dois são o mesmo
 * formulário, e mantê-los separados fazia duas cópias do mesmo `<input>`
 * divergirem em `maxLength` e em rótulo acessível.
 */
function NameForm({
  id,
  label,
  ariaLabel,
  value,
  busy,
  onChange,
  onSubmit,
  onCancel,
}: {
  id: string;
  label?: string;
  ariaLabel?: string;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && value.trim()) onSubmit();
      }}
    >
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="views-form-row">
        <input
          id={id}
          className="field-control views-input"
          value={value}
          maxLength={NAME_MAX_LENGTH}
          autoFocus
          disabled={busy}
          aria-label={ariaLabel}
          onChange={(event) => onChange(event.target.value)}
          // Escape é a saída esperada de um campo que abriu no lugar de uma
          // linha: sem ela, sair do modo de edição exigiria achar o botão.
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              onCancel();
            }
          }}
        />
        <button
          type="submit"
          className="drill-button views-submit"
          disabled={busy || !value.trim()}
        >
          Salvar
        </button>
      </div>
    </form>
  );
}

export function SavedViewsPanel({ current, currentParentName, indicators, onApply }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const disclosureRef = useRef<HTMLDetailsElement>(null);
  const viewsQuery = useSavedViews(isExpanded);
  const createView = useCreateSavedView();
  const updateView = useUpdateSavedView();
  const deleteView = useDeleteSavedView();

  const views = viewsQuery.data?.views ?? [];

  // Só as UFs podem ser pai de um recorte municipal, e só são buscadas se
  // alguma visualização salva de fato tiver um pai para traduzir.
  const states = useTerritories(
    'state',
    isExpanded && views.some((view) => view.parentCode !== null),
  );

  /** Nome em edição: `null` fora de edição, `{ view: null }` ao criar. */
  const [draft, setDraft] = useState<{ view: SavedView | null; name: string } | null>(null);
  /** Visualização aguardando confirmação de exclusão. */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const indicatorName = (key: string) =>
    indicators.find((indicator) => indicator.key === key)?.name ?? key;
  const stateName = (code: string | null) =>
    code === null
      ? null
      : (states.data?.territories.find((territory) => territory.ibgeCode === code)?.name ?? null);

  const pendingError = createView.error ?? updateView.error ?? deleteView.error;
  const isBusy = createView.isPending || updateView.isPending || deleteView.isPending;
  const isCreating = draft?.view === null;
  const showEmptyState =
    views.length === 0 && !viewsQuery.isPending && !viewsQuery.error && draft === null;

  function openDraft() {
    createView.reset();
    setConfirmingId(null);
    const scope = scopeLabel(
      { level: current.level, parentCode: current.parentCode ?? null },
      currentParentName,
    );
    const year = current.year === 'latest' ? '' : ` · ${current.year}`;
    setDraft({
      view: null,
      name: `${indicatorName(current.indicatorKey)} · ${scope}${year}`.slice(0, NAME_MAX_LENGTH),
    });
  }

  function openRename(view: SavedView) {
    updateView.reset();
    setConfirmingId(null);
    setDraft({ view, name: view.name });
  }

  function submitDraft() {
    if (!draft) return;
    const name = draft.name.trim();
    const close = { onSuccess: () => setDraft(null) };

    if (draft.view === null) {
      createView.mutate({ ...current, name }, close);
      return;
    }
    // PUT é substituição completa: o recorte acompanha o nome, mesmo quando só
    // o nome mudou.
    const { id, description, level, parentCode, indicatorKey, year, classes } = draft.view;
    updateView.mutate(
      { id, input: { name, description, level, parentCode, indicatorKey, year, classes } },
      close,
    );
  }

  return (
    <details
      ref={disclosureRef}
      className="panel-section disclosure saved-views"
      onToggle={(event) => {
        setIsExpanded(event.currentTarget.open);
        if (!event.currentTarget.open) {
          setDraft(null);
          setConfirmingId(null);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !draft && !confirmingId && disclosureRef.current?.open) {
          event.stopPropagation();
          disclosureRef.current.open = false;
          disclosureRef.current.querySelector('summary')?.focus();
        }
      }}
    >
      <summary className="disclosure-trigger">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M4 2.5h8v11l-4-2.8-4 2.8Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
        <span>Visualizações salvas</span>
        <span className="disclosure-chevron" aria-hidden="true" />
      </summary>
      <div className="disclosure-content">
        <header className="views-header">
          <button
            type="button"
            // O "+" do rótulo vem do CSS, então ele sai junto com o rótulo
            // quando o botão vira "Cancelar".
            className={isCreating ? 'ghost-button is-plain' : 'ghost-button is-add'}
            onClick={isCreating ? () => setDraft(null) : openDraft}
            disabled={isBusy}
          >
            {isCreating ? 'Cancelar' : 'Salvar atual'}
          </button>
        </header>

        {isCreating && draft && (
          <div className="views-form">
            <NameForm
              id="saved-view-name"
              label="Nome da visualização"
              value={draft.name}
              busy={isBusy}
              onChange={(name) => setDraft({ view: null, name })}
              onSubmit={submitDraft}
              onCancel={() => setDraft(null)}
            />
          </div>
        )}

        {pendingError && (
          <div className="views-error">
            <ErrorMessage error={pendingError} />
          </div>
        )}

        {viewsQuery.error && !pendingError && <ErrorMessage error={viewsQuery.error} />}

        {viewsQuery.isPending && (
          <p className="source-note" role="status">
            Carregando visualizações…
          </p>
        )}

        {showEmptyState && <p className="source-note">Nenhuma visualização salva.</p>}

        <ul className="views-list">
          {views.map((view) => (
            <li key={view.id} className="views-item">
              {draft?.view?.id === view.id ? (
                <NameForm
                  id={`saved-view-${view.id}`}
                  ariaLabel={`Novo nome para ${view.name}`}
                  value={draft.name}
                  busy={isBusy}
                  onChange={(name) => setDraft({ view, name })}
                  onSubmit={submitDraft}
                  onCancel={() => setDraft(null)}
                />
              ) : (
                <>
                  <button
                    type="button"
                    className="views-apply"
                    onClick={() => {
                      onApply(view, stateName(view.parentCode));
                      if (disclosureRef.current) disclosureRef.current.open = false;
                    }}
                    title="Abrir esta visualização no mapa"
                  >
                    <span className="views-name">{view.name}</span>
                    <span className="views-meta">
                      {scopeLabel(view, stateName(view.parentCode))}
                      {' · '}
                      {indicatorName(view.indicatorKey)}
                      {view.year !== 'latest' && ` · ${view.year}`}
                    </span>
                  </button>

                  {confirmingId === view.id ? (
                    // Exclusão não tem desfazer: o segundo clique é o que separa
                    // um engano de uma decisão.
                    <span className="views-confirm">
                      <button
                        type="button"
                        className="views-confirm-yes"
                        disabled={isBusy}
                        onClick={() => {
                          deleteView.reset();
                          deleteView.mutate(view.id, { onSettled: () => setConfirmingId(null) });
                        }}
                      >
                        Excluir?
                      </button>
                      <button
                        type="button"
                        className="icon-button views-action"
                        aria-label="Cancelar exclusão"
                        title="Cancelar"
                        onClick={() => setConfirmingId(null)}
                      >
                        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                          <path
                            d="M4 4l8 8M12 4l-8 8"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            fill="none"
                          />
                        </svg>
                      </button>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="icon-button views-action"
                        aria-label={`Renomear ${view.name}`}
                        title="Renomear"
                        disabled={isBusy}
                        onClick={() => openRename(view)}
                      >
                        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                          <path
                            d="M10.5 2.5l3 3L6 13H3v-3z"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinejoin="round"
                            fill="none"
                          />
                        </svg>
                      </button>

                      <button
                        type="button"
                        className="icon-button views-action"
                        aria-label={`Excluir ${view.name}`}
                        title="Excluir"
                        disabled={isBusy}
                        onClick={() => setConfirmingId(view.id)}
                      >
                        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                          <path
                            d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.6 8.2h4.8L11 4.5"
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                        </svg>
                      </button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
