import type {
  PoliticalOffice,
  PoliticalMetric,
  PoliticalSelection,
  PoliticalRelease,
} from '../../api/types';

export const OFFICES: { value: PoliticalOffice; label: string; group: string }[] = [
  { value: 'president', label: 'Presidência', group: 'Presidência' },
  { value: 'governor', label: 'Governo estadual', group: 'Governo estadual' },
  { value: 'senator', label: 'Senado', group: 'Senado' },
  { value: 'federal_deputy', label: 'Deputados federais', group: 'Deputados' },
  { value: 'state_deputy', label: 'Deputados estaduais / distritais', group: 'Deputados' },
  { value: 'mayor', label: 'Prefeitura', group: 'Prefeitura' },
  { value: 'councillor', label: 'Vereadores', group: 'Vereadores' },
];
export const METRICS: { value: PoliticalMetric; label: string }[] = [
  { value: 'leading_candidate', label: 'Candidato mais votado' },
  { value: 'leading_party', label: 'Partido mais votado' },
  { value: 'leader_share', label: 'Percentual do líder' },
  { value: 'margin', label: 'Margem de votos' },
  { value: 'turnout', label: 'Comparecimento' },
  { value: 'abstention', label: 'Abstenção' },
  { value: 'invalid_votes', label: 'Brancos e nulos' },
  { value: 'blank_votes', label: 'Votos brancos' },
  { value: 'null_votes', label: 'Votos nulos' },
  { value: 'representation', label: 'Eleitos no pleito' },
];
export const DEFAULT_SELECTION: PoliticalSelection = {
  category: 'elections',
  office: 'president',
  year: 2026,
  round: 1,
  metric: 'leading_candidate',
};
export const isExecutive = (office: PoliticalOffice) =>
  ['president', 'governor', 'mayor'].includes(office);
export const isParticipation = (metric: PoliticalMetric) =>
  ['turnout', 'abstention', 'invalid_votes', 'blank_votes', 'null_votes'].includes(metric);

export function validSelection(value: unknown): value is PoliticalSelection {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as PoliticalSelection;
  return (
    ['elections', 'representation', 'participation'].includes(s.category) &&
    OFFICES.some((o) => o.value === s.office) &&
    Number.isInteger(s.year) &&
    s.year >= 2022 &&
    s.year <= 2100 &&
    [1, 2].includes(s.round) &&
    METRICS.some((m) => m.value === s.metric)
  );
}

export function latestSelection(
  selection: PoliticalSelection,
  releases: PoliticalRelease[],
): PoliticalSelection {
  const release = releases
    .filter((r) =>
      r.contests.some((c) =>
        selection.category === 'participation'
          ? c.office === 'president' || c.office === 'mayor'
          : c.office === selection.office,
      ),
    )
    .reduce<PoliticalRelease | undefined>(
      (latest, r) => (!latest || r.year > latest.year ? r : latest),
      undefined,
    );
  if (!release) return selection;
  return { ...selection, year: release.year };
}

export function normalizeSelection(
  selection: PoliticalSelection,
  releases: PoliticalRelease[],
): PoliticalSelection {
  if (!releases.length) return selection;
  const next = { ...selection };
  if (next.category === 'participation') {
    const release =
      releases.find((r) => r.year === next.year) ??
      releases.find((r) => r.year === latestSelection(next, releases).year);
    if (release) next.year = release.year;
    next.office = release?.contests.some((c) => c.office === 'mayor') ? 'mayor' : 'president';
    if (!isParticipation(next.metric)) next.metric = 'turnout';
  } else if (next.category === 'representation') next.metric = 'representation';
  else if (!METRICS.slice(0, 4).some((m) => m.value === next.metric))
    next.metric = isExecutive(next.office) ? 'leading_candidate' : 'leading_party';
  let release = releases.find(
    (r) => r.year === next.year && r.contests.some((c) => c.office === next.office),
  );
  if (!release) {
    const latest = latestSelection(next, releases);
    release = releases.find(
      (r) => r.year === latest.year && r.contests.some((c) => c.office === next.office),
    );
    if (release) next.year = release.year;
  }
  const rounds = release?.contests.find((c) => c.office === next.office)?.rounds ?? [];
  if (!rounds.includes(next.round)) next.round = Math.max(...rounds, 1);
  return next;
}

export function parameters(selection: PoliticalSelection) {
  return {
    year: selection.year,
    office: selection.office,
    round: selection.category === 'representation' ? 0 : selection.round,
    metric: selection.metric,
  };
}
export const metricLabel = (metric: PoliticalMetric) =>
  METRICS.find((m) => m.value === metric)?.label ?? metric;
export const officeLabel = (office: PoliticalOffice) =>
  OFFICES.find((o) => o.value === office)?.label ?? office;
