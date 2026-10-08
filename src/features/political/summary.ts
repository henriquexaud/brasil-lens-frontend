import type { PoliticalDetail, PoliticalSelection } from '../../api/types';

export function summaryMetric(data: PoliticalDetail, metric: PoliticalSelection['metric']) {
  const summary = data.summary;
  if (!summary) return { value: null, count: null };
  let numerator: number | null | undefined;
  let denominator: number | null | undefined;
  switch (metric) {
    case 'turnout':
    case 'abstention':
      numerator = summary[metric];
      denominator = summary.eligible;
      break;
    case 'blank_votes':
    case 'null_votes':
      numerator = metric === 'blank_votes' ? summary.blankVotes : summary.nullVotes;
      denominator = summary.totalVotes;
      break;
    case 'invalid_votes':
      numerator =
        summary.blankVotes == null || summary.nullVotes == null
          ? null
          : summary.blankVotes + summary.nullVotes;
      denominator = summary.totalVotes;
      break;
    case 'leader_share':
      numerator = data.leaders[0]?.votes;
      denominator = summary.validVotes;
      break;
    case 'margin': {
      const [first, second] = data.leaders;
      numerator = first?.votes == null || second?.votes == null ? null : first.votes - second.votes;
      denominator = summary.validVotes;
      break;
    }
    default:
      return { value: null, count: null };
  }
  return {
    value:
      numerator == null || !denominator
        ? null
        : Math.round((10000 * numerator) / denominator) / 100,
    count: numerator ?? null,
  };
}

export function voteShares(data: PoliticalDetail, selection: PoliticalSelection) {
  if (
    selection.category !== 'elections' ||
    !['president', 'governor', 'mayor'].includes(selection.office) ||
    !['leading_candidate', 'leader_share', 'margin'].includes(selection.metric)
  )
    return null;
  const counts = candidateVoteCounts(data);
  const total = data.summary?.validVotes;
  if (counts.others === null || !total || counts.leaders.length !== 2) return null;
  const votes = total - counts.others;
  if (votes <= 0) return null;
  return {
    leaders: counts.leaders.map((candidate) => ({
      ...candidate,
      percent: (100 * candidate.votes!) / total,
      balancePercent: (100 * candidate.votes!) / votes,
    })),
    others: (100 * counts.others) / total,
    otherVotes: counts.others,
  };
}

export function candidateVoteCounts(data: PoliticalDetail) {
  const total = data.summary?.validVotes;
  const leaders = data.leaders.slice(0, 2);
  if (
    total == null ||
    !Number.isFinite(total) ||
    total <= 0 ||
    leaders.length !== 2 ||
    leaders[0]!.id === leaders[1]!.id ||
    leaders.some(
      (candidate) =>
        candidate.votes == null || !Number.isFinite(candidate.votes) || candidate.votes < 0,
    )
  ) {
    return { leaders, others: null };
  }
  const votes = leaders.reduce((sum, candidate) => sum + candidate.votes!, 0);
  return { leaders, others: votes > total ? null : total - votes };
}
