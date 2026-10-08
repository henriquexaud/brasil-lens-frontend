import type { PoliticalDetail } from '@/api/types';
import { candidateName } from './presentation';
import { candidateVoteCounts } from './summary';
import { formatCount, PartyDot, PoliticalStats } from './PoliticalSummary';

export function CandidateVotes({
  data,
  emphasizeLeader = false,
}: {
  data: PoliticalDetail;
  emphasizeLeader?: boolean;
}) {
  const counts = candidateVoteCounts(data);
  if (counts.leaders.length < 2) return null;
  return (
    <div className="political-candidate-votes" aria-label="Votos válidos por candidato">
      <PoliticalStats
        rows={[
          ...counts.leaders.map((candidate, index) => ({
            emphasized: emphasizeLeader && index === 0,
            label: `${candidateName(candidate.name)} · ${candidate.party}`,
            value: (
              <>
                <PartyDot party={candidate.party} />
                {formatCount(candidate.votes)}
              </>
            ),
          })),
          { label: 'Demais candidatos', value: formatCount(counts.others) },
        ]}
      />
    </div>
  );
}
