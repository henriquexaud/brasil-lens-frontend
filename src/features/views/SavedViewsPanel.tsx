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
import { useEffect, useRef, useState } from 'react';

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

/** Gera o próximo nome padrão sequencial: "Visualização 1", "Visualização 2", etc. */
export function defaultViewName(existingViews: { name: string }[]): string {
  const existingNames = new Set(existingViews.map((v) => v.name.trim().toLowerCase()));

  let maxUsed = 0;
  for (const v of existingViews) {
    const match = v.name.match(/^visualiza[çc][ãa]o\s+(\d+)$/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > maxUsed) maxUsed = num;
    }
  }

  let nextNum = maxUsed + 1;
  while (
    existingNames.has(`visualização ${nextNum}`) ||
    existingNames.has(`visualizacao ${nextNum}`)
  ) {
    nextNum++;
  }

  return `Visualização ${nextNum}`;
}

/**
 * Campo de nome com botão de salvar.
 * Compartilhado por "Salvar atual" e pelo renomear.
 */
function NameForm({
  id,
  label,
  ariaLabel,
  value,
  busy,
  submitLabel = 'Salvar',
  onChange,
  onSubmit,
  onCancel,
}: {
  id: string;
  label?: string;
  ariaLabel?: string;
  value: string;
  busy: boolean;
  submitLabel?: string;
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
          onFocus={(event) => event.target.select()}
          onChange={(event) => onChange(event.target.value)}
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
          {submitLabel}
        </button>
        <button
          type="button"
          className="ghost-button views-cancel-btn"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
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
  /** Feedback de sucesso temporário */
  const [savedSuccess, setSavedSuccess] = useState(false);

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

  useEffect(() => {
    if (!savedSuccess) return;
    const timer = setTimeout(() => setSavedSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [savedSuccess]);

  function openDraft() {
    createView.reset();
    setConfirmingId(null);
    setDraft({
      view: null,
      name: defaultViewName(views),
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
    const close = {
      onSuccess: () => {
        setDraft(null);
        setSavedSuccess(true);
      },
    };

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
        {views.length > 0 && <span className="views-count-badge">{views.length}</span>}
        <span className="disclosure-chevron" aria-hidden="true" />
      </summary>
      <div className="disclosure-content">
        <div className="views-top-bar">
          <button
            type="button"
            className={isCreating ? 'views-save-btn is-active' : 'views-save-btn'}
            onClick={isCreating ? () => setDraft(null) : openDraft}
            disabled={isBusy}
          >
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              {isCreating ? (
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  fill="none"
                />
              ) : (
                <path
                  d="M8 3v10M3 8h10"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  fill="none"
                />
              )}
            </svg>
            <span>{isCreating ? 'Cancelar' : 'Salvar visualização atual'}</span>
          </button>
        </div>

        {savedSuccess && (
          <div className="views-success-banner" role="status">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path
                d="M3 8.5l3.5 3.5 6.5-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Visualização salva com sucesso!</span>
          </div>
        )}

        {isCreating && draft && (
          <div className="views-create-card">
            <div className="views-card-header">
              <span className="views-card-title">Salvar recorte atual</span>
            </div>

            <div className="views-context-chips" aria-label="Detalhes da visualização atual">
              <span className="views-chip" title="Indicador selecionado">
                <span className="views-chip-label">Indicador:</span>
                <span className="views-chip-val">{indicatorName(current.indicatorKey)}</span>
              </span>
              <span className="views-chip" title="Recorte geográfico">
                <span className="views-chip-label">Recorte:</span>
                <span className="views-chip-val">
                  {scopeLabel(
                    { level: current.level, parentCode: current.parentCode ?? null },
                    currentParentName,
                  )}
                </span>
              </span>
              <span className="views-chip" title="Ano de referência">
                <span className="views-chip-label">Ano:</span>
                <span className="views-chip-val">
                  {current.year === 'latest' ? 'Último' : current.year}
                </span>
              </span>
            </div>

            <div className="views-form">
              <NameForm
                id="saved-view-name"
                label="Nome da visualização"
                value={draft.name}
                busy={isBusy}
                submitLabel={createView.isPending ? 'Salvando…' : 'Salvar'}
                onChange={(name) => setDraft({ view: null, name })}
                onSubmit={submitDraft}
                onCancel={() => setDraft(null)}
              />
            </div>
          </div>
        )}

        {pendingError && (
          <div className="views-error">
            <ErrorMessage error={pendingError} />
          </div>
        )}

        {viewsQuery.error && !pendingError && <ErrorMessage error={viewsQuery.error} />}

        {viewsQuery.isPending && (
          <div className="views-skeleton-list" role="status" aria-label="Carregando visualizações">
            <div className="views-skeleton-item" />
            <div className="views-skeleton-item" />
          </div>
        )}

        {showEmptyState && (
          <div className="views-empty-state">
            <div className="views-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path
                  d="M6 3.5h12v17l-6-4.2-6 4.2Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="views-empty-title">Nenhuma visualização salva</p>
            <p className="views-empty-desc">
              Salve a visualização atual do mapa para voltar a ela com um clique a qualquer momento.
            </p>
          </div>
        )}

        {views.length > 0 && (
          <ul className="views-list">
            {views.map((view) => (
              <li key={view.id} className="views-item">
                {draft?.view?.id === view.id ? (
                  <div className="views-edit-row">
                    <NameForm
                      id={`saved-view-${view.id}`}
                      ariaLabel={`Novo nome para ${view.name}`}
                      value={draft.name}
                      busy={isBusy}
                      submitLabel={updateView.isPending ? 'Salvando…' : 'Salvar'}
                      onChange={(name) => setDraft({ view, name })}
                      onSubmit={submitDraft}
                      onCancel={() => setDraft(null)}
                    />
                  </div>
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
                        <span className="views-meta-pill">
                          {scopeLabel(view, stateName(view.parentCode))}
                        </span>
                        <span className="views-meta-sep">·</span>
                        <span className="views-meta-pill">{indicatorName(view.indicatorKey)}</span>
                        {view.year !== 'latest' && (
                          <>
                            <span className="views-meta-sep">·</span>
                            <span className="views-meta-pill">{view.year}</span>
                          </>
                        )}
                      </span>
                    </button>

                    {confirmingId === view.id ? (
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
                          {deleteView.isPending ? 'Excluindo…' : 'Excluir?'}
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
                      <div className="views-actions-group">
                        <button
                          type="button"
                          className="icon-button views-action"
                          aria-label={`Renomear ${view.name}`}
                          title="Renomear visualização"
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
                          title="Excluir visualização"
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
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
