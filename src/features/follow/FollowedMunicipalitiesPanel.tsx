/**
 * Seção "Municípios seguidos" do contexto Clima.
 *
 * Irmã de "Visualizações salvas" no socioeconômico: mesma seção recolhível,
 * mesma lista, mesmas ações — o usuário não precisa aprender um segundo
 * vocabulário. A diferença é o gesto principal: aqui é um alternador
 * ("Seguir" ↔ "Seguindo") que só existe com um município aberto no mapa.
 *
 * As escritas são otimistas (ver `useFollowMunicipality`): o botão muda no
 * clique, e uma falha desfaz a mudança e mostra o erro. A lista é carregada
 * assim que a seção monta, mesmo recolhida, para que abrir um município já
 * saiba se ele é seguido.
 *
 * Nada de alertas aqui ainda — só a relação `usuário ↔ município`.
 */
import { useEffect, useRef, useState } from 'react';

import {
  type FollowTarget,
  useFollowedMunicipalities,
  useFollowMunicipality,
  useUnfollowMunicipality,
} from './useFollowedMunicipalities';
import type { FollowedMunicipality } from '@/api/types';
import { ErrorMessage } from '@/components/Feedback';

interface Props {
  /** Município aberto no mapa, ou `null` fora do nível municipal. */
  current: FollowTarget | null;
  /** Leva o mapa até um município da lista. */
  onOpen: (municipality: FollowedMunicipality) => void;
}

function followedSince(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

function PinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path
        d="M8 14s-4.5-4.1-4.5-7.6a4.5 4.5 0 0 1 9 0C12.5 9.9 8 14 8 14Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="6.4" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function FollowedMunicipalitiesPanel({ current, onOpen }: Props) {
  const disclosureRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(current !== null);
  const [confirmingCode, setConfirmingCode] = useState<string | null>(null);

  const listQuery = useFollowedMunicipalities();
  const follow = useFollowMunicipality();
  const unfollow = useUnfollowMunicipality();

  const municipalities = listQuery.data?.municipalities ?? [];
  const currentCode = current?.municipalityCode ?? null;
  const isFollowing =
    currentCode !== null && municipalities.some((item) => item.municipalityCode === currentCode);
  const writeError = follow.error ?? unfollow.error;

  // Entrar no nível municipal abre a seção: é ali que o gesto de seguir faz
  // sentido. Trocar de município com ela fechada não a reabre.
  const hasCurrent = currentCode !== null;
  useEffect(() => {
    if (hasCurrent) setOpen(true);
  }, [hasCurrent]);

  function resetErrors() {
    follow.reset();
    unfollow.reset();
  }

  function toggleCurrent() {
    if (!current) return;
    resetErrors();
    if (isFollowing) unfollow.mutate(current.municipalityCode);
    else follow.mutate(current);
  }

  function remove(code: string) {
    resetErrors();
    setConfirmingCode(null);
    unfollow.mutate(code);
  }

  const currentLabel = current?.name ?? 'município';
  const showEmptyState =
    municipalities.length === 0 && !listQuery.isPending && !listQuery.error && current === null;

  return (
    <details
      ref={disclosureRef}
      className="panel-section disclosure saved-views followed-municipalities"
      open={open}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
        if (!event.currentTarget.open) setConfirmingCode(null);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !confirmingCode && disclosureRef.current?.open) {
          event.stopPropagation();
          disclosureRef.current.open = false;
          disclosureRef.current.querySelector('summary')?.focus();
        }
      }}
    >
      <summary className="disclosure-trigger">
        <PinIcon />
        <span>Municípios seguidos</span>
        {municipalities.length > 0 && (
          <span className="views-count-badge">{municipalities.length}</span>
        )}
        <span className="disclosure-chevron" aria-hidden="true" />
      </summary>
      <div className="disclosure-content">
        {current && !listQuery.error && (
          <div className="views-top-bar">
            <button
              type="button"
              className={
                isFollowing ? 'views-save-btn follow-btn is-following' : 'views-save-btn follow-btn'
              }
              aria-pressed={isFollowing}
              disabled={listQuery.isPending}
              onClick={toggleCurrent}
            >
              <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                {isFollowing ? (
                  <path
                    d="M3 8.5l3.5 3.5 6.5-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
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
              <span className="follow-btn-label">
                {isFollowing ? 'Seguindo' : 'Seguir'} <strong>{currentLabel}</strong>
              </span>
              {isFollowing && (
                <span className="follow-btn-hover-label" aria-hidden="true">
                  Deixar de seguir
                </span>
              )}
            </button>
          </div>
        )}

        {writeError && (
          <div className="views-error">
            <ErrorMessage error={writeError} />
          </div>
        )}

        {listQuery.error && <ErrorMessage error={listQuery.error} />}

        {listQuery.isPending && (
          <div
            className="views-skeleton-list"
            role="status"
            aria-label="Carregando municípios seguidos"
          >
            <div className="views-skeleton-item" />
            <div className="views-skeleton-item" />
          </div>
        )}

        {showEmptyState && (
          <div className="views-empty-state">
            <div className="views-empty-icon" aria-hidden="true">
              <PinIcon size={22} />
            </div>
            <p className="views-empty-title">Nenhum município seguido</p>
            <p className="views-empty-desc">
              Abra um município no mapa e toque em Seguir para acompanhá-lo por aqui.
            </p>
          </div>
        )}

        {municipalities.length > 0 && (
          <ul className="views-list">
            {municipalities.map((item) => {
              const code = item.municipalityCode;
              const name = item.name ?? `Município ${code}`;
              const isCurrent = code === currentCode;
              return (
                <li key={code} className={isCurrent ? 'views-item is-current' : 'views-item'}>
                  <button
                    type="button"
                    className="views-apply"
                    aria-current={isCurrent ? 'location' : undefined}
                    disabled={item.name === null}
                    onClick={() => onOpen(item)}
                    title={isCurrent ? 'Município aberto no mapa' : 'Abrir este município no mapa'}
                  >
                    <span className="views-name">{name}</span>
                    <span className="views-meta">
                      {(item.stateName ?? item.stateAbbreviation) && (
                        <>
                          <span className="views-meta-pill">
                            {item.stateName ?? item.stateAbbreviation}
                          </span>
                          <span className="views-meta-sep">·</span>
                        </>
                      )}
                      <span className="views-meta-pill">
                        Seguindo desde {followedSince(item.followedAt)}
                      </span>
                    </span>
                  </button>

                  {confirmingCode === code ? (
                    <span className="views-confirm">
                      <button
                        type="button"
                        className="views-confirm-yes"
                        onClick={() => remove(code)}
                      >
                        Deixar de seguir?
                      </button>
                      <button
                        type="button"
                        className="icon-button views-action"
                        aria-label="Cancelar"
                        title="Cancelar"
                        onClick={() => setConfirmingCode(null)}
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
                        aria-label={`Deixar de seguir ${name}`}
                        title="Deixar de seguir"
                        onClick={() => setConfirmingCode(code)}
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
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
