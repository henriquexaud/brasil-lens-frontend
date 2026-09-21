/**
 * Busca de estados e municípios.
 *
 * Ocupa o canto superior esquerdo do mapa, onde antes ficava o controle de
 * zoom (ver MapView) — zoom continua disponível por scroll, pinça e +/- do
 * teclado, só perdeu o botão dedicado. A busca em si (sem acento, ordenada por
 * relevância) é do backend (ver `useTerritorySearch`); este componente só é a
 * caixa de texto e a lista de resultados, com um debounce curto para não
 * consultar a cada tecla.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { useTerritorySearch } from '@/api/queries';
import type { TerritoryLevel } from '@/api/types';
import { AnimatedText } from '@/components/AnimatedText';

import { LocationButton, type LocatedMunicipality } from './LocationButton';

const MIN_QUERY_LENGTH = 2;

export interface SearchResult {
  ibgeCode: string;
  name: string;
  level: TerritoryLevel;
  abbreviation: string | null;
  parentCode: string | null;
  parentName: string | null;
}

interface Props {
  onSelect: (result: SearchResult) => void;
  onPreview?: (code: string) => void;
  onLocated: (location: LocatedMunicipality) => void;
}

export function SearchBox({ onSelect, onPreview, onLocated }: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const searchResultsQuery = useTerritorySearch(debouncedQuery, focused);

  const results: SearchResult[] = useMemo(() => {
    if (!searchResultsQuery.data?.territories) return [];
    return searchResultsQuery.data.territories.map((row) => ({
      ibgeCode: row.ibgeCode,
      name: row.name,
      level: row.level,
      abbreviation: row.abbreviation,
      parentCode: row.parent?.ibgeCode ?? null,
      parentName: row.parent?.name ?? null,
    }));
  }, [searchResultsQuery.data]);

  const showDropdown = focused && query.trim().length >= MIN_QUERY_LENGTH;

  // Fecha ao clicar fora — o dropdown não é um elemento do Leaflet, então
  // nada além disso o fecharia ao interagir com o mapa por trás dele.
  useEffect(() => {
    if (!showDropdown) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setFocused(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showDropdown]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (showDropdown)
      document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, showDropdown, listId]);

  function selectResult(result: SearchResult) {
    onSelect(result);
    setQuery('');
    setFocused(false);
    inputRef.current?.blur();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || results.length === 0) {
      if (event.key === 'Escape' && query) {
        event.stopPropagation();
        setQuery('');
      }
      return;
    }
    // Não deixa o Esc do teclado global (fecha detalhe / volta ao Brasil)
    // competir com o Esc que só deveria fechar este dropdown.
    if (event.key === 'Escape') {
      event.stopPropagation();
      setFocused(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const result = results[activeIndex];
      if (result) selectResult(result);
    }
  }

  return (
    <div ref={rootRef} className="search-slot">
      <div className="search-tools">
        <div className="search-box">
          <svg
            className="search-icon"
            viewBox="0 0 16 16"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <path
              d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10Zm4.6-.9 3 3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Buscar estado ou município"
            aria-label="Buscar estado ou município"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              showDropdown && results[activeIndex] ? `${listId}-${activeIndex}` : undefined
            }
          />
          {query && (
            <button
              type="button"
              className="search-clear"
              aria-label="Limpar busca"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
            >
              <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </button>
          )}
        </div>

        <LocationButton onLocated={onLocated} />
      </div>

      {showDropdown && results.length > 0 && (
        <ul className="search-results" id={listId} role="listbox">
          {results.map((result, i) => (
            <li key={result.ibgeCode} role="presentation">
              <button
                type="button"
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={i === activeIndex ? 'search-result is-active' : 'search-result'}
                onMouseEnter={() => {
                  setActiveIndex(i);
                  onPreview?.(result.ibgeCode);
                }}
                onFocus={() => onPreview?.(result.ibgeCode)}
                // mousedown (não click) dispara antes do input perder o foco.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectResult(result)}
              >
                <AnimatedText as="span" className="search-result-name" text={result.name} />
                <span className="search-result-meta">
                  {result.level === 'state' ? 'Estado' : (result.parentName ?? 'Município')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showDropdown && searchResultsQuery.isLoading && (
        <p className="search-empty" role="status">
          Buscando lugares…
        </p>
      )}
      {showDropdown && searchResultsQuery.isError && (
        <p className="search-empty" role="status">
          Não foi possível carregar a busca.
        </p>
      )}
      {showDropdown &&
        results.length === 0 &&
        !searchResultsQuery.isLoading &&
        !searchResultsQuery.isError && <p className="search-empty">Nada encontrado</p>}
    </div>
  );
}
