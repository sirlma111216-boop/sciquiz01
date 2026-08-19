import { cx, formatPoints, rankMedal } from '../../lib/utils';
import type { RankedParticipant } from '../../types/game';

/** 순위 변화 표시 (▲3 / ▼1 / -) */
function RankChange({ change }: { change: number | null }) {
  if (change === null || change === 0) {
    return (
      <span className="text-sm font-semibold text-slate-500" aria-label="순위 변화 없음">
        –
      </span>
    );
  }
  if (change > 0) {
    return (
      <span className="text-sm font-bold text-real-400" aria-label={`${change}계단 상승`}>
        ▲{change}
      </span>
    );
  }
  return (
    <span className="text-sm font-bold text-fake-400" aria-label={`${Math.abs(change)}계단 하락`}>
      ▼{Math.abs(change)}
    </span>
  );
}

interface RankingBoardProps {
  ranked: RankedParticipant[];
  max?: number;
  title?: string;
  showRankChange?: boolean;
  compact?: boolean;
}

export function RankingBoard({
  ranked,
  max = 5,
  title = '현재 순위',
  showRankChange = true,
  compact = false,
}: RankingBoardProps) {
  const rows = ranked.slice(0, max);

  return (
    <div className="panel px-5 py-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className={cx('font-black text-white', compact ? 'text-lg' : 'text-2xl')}>{title}</h2>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          TOP {rows.length}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">아직 기록이 없습니다.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((participant) => {
            const medal = rankMedal(participant.rank);
            return (
              <li
                key={participant.uid}
                className={cx(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                  participant.rank <= 3
                    ? 'border-spark-400/30 bg-spark-400/10'
                    : 'border-white/10 bg-white/5',
                )}
              >
                <span
                  className={cx(
                    'w-11 shrink-0 text-center font-black tabular-nums',
                    compact ? 'text-base' : 'text-xl',
                    participant.rank <= 3 ? 'text-spark-400' : 'text-slate-400',
                  )}
                >
                  {medal || `${participant.rank}위`}
                </span>
                <span
                  className={cx(
                    'min-w-0 flex-1 truncate font-bold text-white',
                    compact ? 'text-base' : 'text-xl',
                  )}
                >
                  {participant.nickname}
                </span>
                {showRankChange && <RankChange change={participant.rankChange} />}
                <span
                  className={cx(
                    'shrink-0 font-black tabular-nums text-beam-400',
                    compact ? 'text-base' : 'text-xl',
                  )}
                >
                  {formatPoints(participant.score)} P
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
