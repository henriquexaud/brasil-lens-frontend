import type { PoliticalSelection } from '../../api/types';

export const LIVE_REFRESH_INTERVAL = 5 * 60 * 1000;
export const ELECTION_WINDOWS = [
  {
    year: 2026,
    round: 2,
    startsAt: Date.parse('2026-10-25T18:00:00-03:00'),
    endsAt: Date.parse('2026-10-26T00:00:00-03:00'),
  },
] as const;

export function electionWindowAt(now: number) {
  return ELECTION_WINDOWS.find((window) => now >= window.startsAt && now < window.endsAt) ?? null;
}

export function nextElectionBoundary(now: number) {
  return ELECTION_WINDOWS.flatMap((window) => [window.startsAt, window.endsAt])
    .filter((boundary) => boundary > now)
    .sort((a, b) => a - b)[0];
}

export function electionRefreshInterval(
  window: ReturnType<typeof electionWindowAt>,
  selection: PoliticalSelection,
  status?: 'ok' | 'partial',
) {
  return window &&
    status === 'partial' &&
    selection.year === window.year &&
    selection.round === window.round &&
    selection.category !== 'representation' &&
    ['president', 'governor'].includes(selection.office)
    ? LIVE_REFRESH_INTERVAL
    : false;
}
