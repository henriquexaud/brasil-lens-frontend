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
