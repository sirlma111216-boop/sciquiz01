import { Button } from '../common/UI';
import { RankingBoard } from './RankingBoard';
import { formatPoints } from '../../lib/utils';
import type { Question, RankedParticipant, RoundSummaryDoc } from '../../types/game';

interface RevealStageProps {
  question: Question;
  roundNumber: number;
  totalRounds: number;
  summary: RoundSummaryDoc | null;
  ranked: RankedParticipant[];
  isLastRound: boolean;
  onNext: () => void;
  advancing: boolean;
}

/** 진짜 / 가짜 선택 인원을 막대로 보여 준다. */
function ChoiceBar({
  label,
  count,
  total,
  tone,
  isAnswer,
}: {
  label: string;
  count: number;
  total: number;
  tone: 'real' | 'fake';
  isAnswer: boolean;
}) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  const barColor = tone === 'real' ? 'bg-real-500' : 'bg-fake-500';
  const textColor = tone === 'real' ? 'text-real-400' : 'text-fake-400';

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className={`text-lg font-black ${textColor}`}>
          {isAnswer && <span aria-hidden="true">✓ </span>}
          {label}
          {isAnswer && <span className="sr-only">(정답)</span>}
        </span>
        <span className="text-lg font-bold text-slate-200">
          {count}명 <span className="text-sm text-slate-500">({percent}%)</span>
        </span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full animate-grow-bar rounded-full ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function RevealStage({
  question,
  roundNumber,
  totalRounds,
  summary,
  ranked,
  isLastRound,
  onNext,
  advancing,
}: RevealStageProps) {
  const isReal = question.answer;
  const totalChoices = (summary?.trueCount ?? 0) + (summary?.falseCount ?? 0);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-slate-500">
        QUESTION {String(roundNumber).padStart(2, '0')} / {totalRounds} · {question.category}
      </p>

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {/* 정답 */}
          <div
            className={`animate-pop-in rounded-3xl border-2 px-6 py-8 text-center ${
              isReal
                ? 'border-real-500/50 bg-real-500/10'
                : 'border-fake-500/50 bg-fake-500/10'
            }`}
          >
            <p className="text-base font-bold uppercase tracking-[0.3em] text-slate-400">정답</p>
            <p
              className={`teacher-verdict mt-2 font-black ${
                isReal ? 'text-real-400' : 'text-fake-400'
              }`}
            >
              <span aria-hidden="true">{isReal ? '◯ ' : '✕ '}</span>
              {isReal ? '진짜!' : '가짜!'}
            </p>
            <p className="mt-5 text-xl font-bold leading-snug text-slate-200 sm:text-3xl">
              {question.statement}
            </p>
          </div>

          {/* 해설 */}
          <div className="panel-strong flex-1 px-6 py-6">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-beam-400">
              과학 해설
            </p>
            <p className="text-lg leading-relaxed text-slate-100 sm:text-2xl sm:leading-relaxed">
              {question.explanation}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* 선택 통계 */}
          <div className="panel px-5 py-5">
            <h2 className="mb-4 text-lg font-black text-white">우리 반의 선택</h2>
            {summary ? (
              <div className="space-y-4">
                <ChoiceBar
                  label="진짜"
                  count={summary.trueCount}
                  total={totalChoices}
                  tone="real"
                  isAnswer={isReal}
                />
                <ChoiceBar
                  label="가짜"
                  count={summary.falseCount}
                  total={totalChoices}
                  tone="fake"
                  isAnswer={!isReal}
                />

                <dl className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4 text-center">
                  <div className="rounded-xl bg-white/5 px-2 py-3">
                    <dt className="text-xs font-semibold text-slate-400">확신 포인트 합계</dt>
                    <dd className="mt-1 text-xl font-black tabular-nums text-beam-400">
                      {formatPoints(summary.totalConfidence)} P
                    </dd>
                  </div>
                  <div className="rounded-xl bg-white/5 px-2 py-3">
                    <dt className="text-xs font-semibold text-slate-400">200P 선택</dt>
                    <dd className="mt-1 text-xl font-black tabular-nums text-spark-400">
                      {summary.maxConfidenceCount}명
                    </dd>
                  </div>
                </dl>

                {summary.restedCount > 0 && (
                  <p className="text-center text-xs font-semibold text-slate-400">
                    과학 에너지 충전 {summary.restedCount}명
                  </p>
                )}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">결과를 정리하는 중...</p>
            )}
          </div>

          <RankingBoard ranked={ranked} max={5} title="현재 순위" compact />
        </div>
      </div>

      <div className="sticky bottom-0 pb-2">
        <Button size="xl" block onClick={onNext} disabled={advancing}>
          {advancing ? '넘어가는 중...' : isLastRound ? '최종 결과 보기' : '다음 문제'}
        </Button>
      </div>
    </div>
  );
}
