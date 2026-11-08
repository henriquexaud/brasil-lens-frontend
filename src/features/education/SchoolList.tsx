import { useMemo, useState } from 'react';
import { ScrollList } from '@/components/ScrollList';
import type { BasicSchools } from '@/api/types';
import { ErrorMessage } from '@/components/Feedback';
import { CATEGORY_LABEL, formatCount, schoolName, searchText } from './education';

// Acima disso (capitais têm centenas, São Paulo 2.703), a busca por nome ajuda.
const SEARCHABLE = 20;

/** Escolas públicas do município na etapa escolhida, por matrículas. Só leitura. */
export function SchoolList({
  data,
  loading,
  error,
  year,
  emptyLabel,
}: {
  data?: BasicSchools;
  loading: boolean;
  error: Error | null;
  year: number | undefined;
  emptyLabel: string;
}) {
  const [query, setQuery] = useState('');
  const needle = searchText(query.trim());
  // Mesma lista entre renders: a ScrollList recomeça do topo quando ela muda.
  const found = useMemo(
    () =>
      needle && data
        ? data.schools.filter((item) => searchText(item.name).includes(needle))
        : data?.schools ?? [],
    [data, needle],
  );
  if (error && !data) return <ErrorMessage error={error} />;
  if (!data) return loading ? <p className="education-summary">Carregando escolas…</p> : null;
  if (!data.schools.length) return <p className="education-summary">{emptyLabel}</p>;
  return (
    <div className="education-institutions">
      {data.year !== null && year !== undefined && data.year !== year && (
        <p className="education-summary">Escolas do Censo {data.year}</p>
      )}
      {data.schools.length > SEARCHABLE && (
        <input
          type="search"
          className="education-school-search"
          placeholder={`Buscar entre ${formatCount(data.schools.length)} escolas`}
          aria-label="Buscar escola pelo nome"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      <ScrollList
        items={found}
        label="Escolas por matrículas"
        render={(item) => (
          <li key={item.code} className="education-institution education-school">
            <span className="education-institution-name">
              {schoolName(item.name)}
              <small>{CATEGORY_LABEL[item.network]}</small>
            </span>
            <strong>{formatCount(item.enrollment)}</strong>
          </li>
        )}
      />
      {needle && !found.length && (
        <p className="education-summary">Nenhuma escola com esse nome.</p>
      )}
    </div>
  );
}
