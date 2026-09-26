/**
 * Seção "Municípios seguidos" para acesso rápido a recortes ambientais.
 * O alternador ("Seguir" ↔ "Seguindo") só existe com um município aberto.
 *
 * As escritas são otimistas (ver `useFollowMunicipality`): o botão muda no
 * clique, e uma falha desfaz a mudança e mostra o erro. A lista é carregada
 * assim que a seção monta, mesmo recolhida, para que abrir um município já
 * saiba se ele é seguido.
 *
 * Deixar de seguir é exclusividade do alternador "Seguindo" no topo — a
 * lista não tem um "x" próprio; para remover um município é preciso abri-lo
 * no mapa primeiro. Cada item da lista tem só um sino discreto, que liga/
 * desliga o alerta daquele vínculo (ligado por padrão ao seguir). Mesmo
 * ciclo otimista das outras escritas. Nada de canal de disparo aqui ainda —
 * só a preferência.
 */
import { useEffect, useRef, useState } from 'react';

import {
  type FollowTarget,
  useFollowedMunicipalities,
  useFollowMunicipality,
  useSetMunicipalityNotifications,
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

/** Sino do alerta de notificações: aberto quando ligado, com um traço quando desligado. */
function BellIcon({ size = 13, muted = false }: { size?: number; muted?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <path
        d="M8 2.5a3.5 3.5 0 0 0-3.5 3.5v1.7c0 .85-.27 1.68-.77 2.36L3 11h10l-.73-.94c-.5-.68-.77-1.5-.77-2.36V6A3.5 3.5 0 0 0 8 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M6.3 13a1.75 1.75 0 0 0 3.4 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {muted && (
        <path
          d="M2.8 2.8l10.4 10.4"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function FollowedMunicipalitiesPanel({ current, onOpen }: Props) {
  const disclosureRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(current !== null);

  const listQuery = useFollowedMunicipalities();
  const follow = useFollowMunicipality();
  const unfollow = useUnfollowMunicipality();
  const notifications = useSetMunicipalityNotifications();

  const municipalities = listQuery.data?.municipalities ?? [];
  const currentCode = current?.municipalityCode ?? null;
  const isFollowing =
    currentCode !== null && municipalities.some((item) => item.municipalityCode === currentCode);
  const writeError = follow.error ?? unfollow.error ?? notifications.error;

  // Entrar no nível municipal abre a seção: é ali que o gesto de seguir faz
  // sentido. Trocar de município com ela fechada não a reabre.
  const hasCurrent = currentCode !== null;
  useEffect(() => {
    if (hasCurrent) setOpen(true);
  }, [hasCurrent]);

  function resetErrors() {
    follow.reset();
    unfollow.reset();
    notifications.reset();
  }

  function toggleCurrent() {
    if (!current) return;
    resetErrors();
    if (isFollowing) unfollow.mutate(current.municipalityCode);
    else follow.mutate(current);
  }

  function toggleNotifications(item: FollowedMunicipality) {
    resetErrors();
    notifications.mutate({ code: item.municipalityCode, enabled: !item.notificationsEnabled });
  }

  const currentLabel = current?.name ?? 'município';
  const showEmptyState =
    municipalities.length === 0 && !listQuery.isPending && !listQuery.error && current === null;

  return (
    <details
      ref={disclosureRef}
      className="panel-section disclosure followed-municipalities"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && disclosureRef.current?.open) {
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
          <span className="follow-count-badge">{municipalities.length}</span>
        )}
        <span className="disclosure-chevron" aria-hidden="true" />
      </summary>
      <div className="disclosure-content">
        {current && !listQuery.error && (
          <div className="follow-top-bar">
            <button
              type="button"
              className={
                isFollowing ? 'follow-toggle-btn follow-btn is-following' : 'follow-toggle-btn follow-btn'
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
          <div className="follow-error">
            <ErrorMessage error={writeError} />
          </div>
        )}

        {listQuery.error && <ErrorMessage error={listQuery.error} />}

        {listQuery.isPending && (
          <div
            className="follow-skeleton-list"
            role="status"
            aria-label="Carregando municípios seguidos"
          >
            <div className="follow-skeleton-item" />
            <div className="follow-skeleton-item" />
          </div>
        )}

        {showEmptyState && (
          <div className="follow-empty-state">
            <div className="follow-empty-icon" aria-hidden="true">
              <PinIcon size={22} />
            </div>
            <p className="follow-empty-title">Nenhum município seguido</p>
            <p className="follow-empty-desc">
              Abra um município no mapa e toque em Seguir para acompanhá-lo por aqui.
            </p>
          </div>
        )}

        {municipalities.length > 0 && (
          <ul className="follow-list">
            {municipalities.map((item) => {
              const code = item.municipalityCode;
              const name = item.name ?? `Município ${code}`;
              const isCurrent = code === currentCode;
              return (
                <li key={code} className={isCurrent ? 'follow-item is-current' : 'follow-item'}>
                  <button
                    type="button"
                    className="follow-apply"
                    aria-current={isCurrent ? 'location' : undefined}
                    disabled={item.name === null}
                    onClick={() => onOpen(item)}
                    title={isCurrent ? 'Município aberto no mapa' : 'Abrir este município no mapa'}
                  >
                    <span className="follow-name">{name}</span>
                    <span className="follow-meta">
                      {(item.stateName ?? item.stateAbbreviation) && (
                        <>
                          <span className="follow-meta-pill">
                            {item.stateName ?? item.stateAbbreviation}
                          </span>
                          <span className="follow-meta-sep">·</span>
                        </>
                      )}
                      <span className="follow-meta-pill">
                        Seguindo desde {followedSince(item.followedAt)}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={
                      item.notificationsEnabled
                        ? 'icon-button follow-notif-toggle is-enabled'
                        : 'icon-button follow-notif-toggle'
                    }
                    aria-pressed={item.notificationsEnabled}
                    aria-label={
                      item.notificationsEnabled
                        ? `Desativar notificações de ${name}`
                        : `Ativar notificações de ${name}`
                    }
                    title={
                      item.notificationsEnabled
                        ? 'Notificações ativadas'
                        : 'Notificações desativadas'
                    }
                    onClick={() => toggleNotifications(item)}
                  >
                    <BellIcon muted={!item.notificationsEnabled} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
