import { formatPoints } from '../../lib/utils';

interface StudentHeaderProps {
  nickname: string;
  score: number;
  roundNumber: number | null;
  totalRounds: number;
}

/** 학생 화면 맨 위에 항상 붙어 있는 작은 상태 표시줄 */
export function StudentHeader({
  nickname,
  score,
  roundNumber,
  totalRounds,
}: StudentHeaderProps) {
  return (
    <header className="sticky top-0 z-10 -mx-4 mb-3 border-b border-white/10 bg-ink-900/90 px-4 py-2.5 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-base font-black text-white">{nickname}</p>
        {roundNumber !== null && (
          <p className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-slate-300">
            {roundNumber} / {totalRounds}
          </p>
        )}
        <p className="shrink-0 text-lg font-black tabular-nums text-beam-400">
          {formatPoints(score)} P
        </p>
      </div>
    </header>
  );
}
