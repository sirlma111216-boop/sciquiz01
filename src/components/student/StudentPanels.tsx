import { cx, formatDelta, formatPoints } from '../../lib/utils';
import { RECOVERY_BONUS } from '../../types/game';
import type { AnswerResult, LastResult } from '../../types/game';

/* ───────────── 대기실 ───────────── */

export function WaitingPanel({ nickname, score }: { nickname: string; score: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div>
        <p className="animate-pop-in text-4xl font-black text-white sm:text-5xl">입장 완료!</p>
        <p className="mt-3 text-base font-medium text-slate-300">
          선생님이 게임을 시작할 때까지
          <br />
          기다려 주세요.
        </p>
      </div>

      <div className="panel-strong w-full max-w-xs px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">내 닉네임</p>
        <p className="mt-1 truncate text-2xl font-black text-white">{nickname}</p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
          시작 포인트
        </p>
        <p className="mt-1 text-3xl font-black tabular-nums text-beam-400">
          {formatPoints(score)} P
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
        <span className="h-2 w-2 animate-soft-pulse rounded-full bg-beam-400" aria-hidden="true" />
        연결됨
      </div>
    </div>
  );
}

/* ───────────── 제출 완료 ───────────── */

export function SubmittedPanel({
  choice,
  confidencePoints,
}: {
  choice: boolean;
  confidencePoints: number;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <p className="animate-pop-in text-4xl font-black text-white sm:text-5xl">선택 완료!</p>

      <div className="panel-strong w-full max-w-xs px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">내 선택</p>
        <p
          className={cx(
            'mt-2 text-3xl font-black',
            choice ? 'text-real-400' : 'text-fake-400',
          )}
        >
          <span aria-hidden="true">{choice ? '◯ ' : '✕ '}</span>
          {choice ? '진짜' : '가짜'}
        </p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
          확신 포인트
        </p>
        <p className="mt-1 text-3xl font-black tabular-nums text-beam-400">
          {confidencePoints} P
        </p>
      </div>

      <p className="text-sm font-medium text-slate-400">
        <span className="mr-2 inline-block h-2 w-2 animate-soft-pulse rounded-full bg-beam-400" aria-hidden="true" />
        다른 친구들의 선택을 기다리는 중...
      </p>
      <p className="text-xs text-slate-500">이제 답을 바꿀 수 없어요.</p>
    </div>
  );
}

/* ───────────── 시간 종료 / 미응답 ───────────── */

export function TimeUpPanel({ submitted }: { submitted: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="text-3xl font-black text-slate-300 sm:text-4xl">시간 종료!</p>
      <p className="text-base font-medium text-slate-400">
        {submitted
          ? '결과를 기다리는 중이에요.'
          : '이번 문제는 선택하지 못했어요. 점수 변화는 없어요.'}
      </p>
      <p className="text-sm text-slate-500">교사 화면에서 정답을 확인하세요.</p>
    </div>
  );
}

/* ───────────── 과학 에너지 충전 ───────────── */

export function RecoveryPanel({ score }: { score: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-2 border-spark-400/50 bg-spark-400/15">
        <span className="animate-soft-pulse text-5xl" aria-hidden="true">
          ⚡
        </span>
      </div>

      <div>
        <p className="text-3xl font-black text-spark-400 sm:text-4xl">과학 에너지 충전 중!</p>
        <p className="mt-3 text-base font-medium text-slate-300">
          이번 문제는 잠시 쉬어갑니다.
          <br />한 문제 쉬고 다시 도전할 수 있어요!
        </p>
      </div>

      <div className="panel-strong w-full max-w-xs px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">현재 포인트</p>
        <p className="mt-1 text-3xl font-black tabular-nums text-beam-400">
          {formatPoints(score)} P
        </p>
        <p className="mt-3 text-sm font-bold text-spark-400">
          이번 문제가 끝나면 +{RECOVERY_BONUS} P 충전!
        </p>
      </div>

      <p className="text-sm text-slate-400">교사 화면의 문제와 해설을 함께 보세요.</p>
    </div>
  );
}

/* ───────────── 결과 ───────────── */

const RESULT_STYLE: Record<
  AnswerResult,
  { title: string; tone: string; box: string; symbol: string }
> = {
  correct: {
    title: '정답!',
    tone: 'text-real-400',
    box: 'border-real-500/50 bg-real-500/10',
    symbol: '◯',
  },
  incorrect: {
    title: '아쉽다!',
    tone: 'text-fake-400',
    box: 'border-fake-500/50 bg-fake-500/10',
    symbol: '✕',
  },
  none: {
    title: '미응답',
    tone: 'text-slate-300',
    box: 'border-white/15 bg-white/5',
    symbol: '–',
  },
  rested: {
    title: '충전 완료!',
    tone: 'text-spark-400',
    box: 'border-spark-400/50 bg-spark-400/10',
    symbol: '⚡',
  },
};

export function ResultPanel({
  result,
  rank,
  totalStudents,
}: {
  result: LastResult;
  rank: number | null;
  totalStudents: number;
}) {
  const style = RESULT_STYLE[result.result];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <div className={cx('animate-pop-in w-full max-w-xs rounded-3xl border-2 px-6 py-8', style.box)}>
        <p className="text-4xl" aria-hidden="true">
          {style.symbol}
        </p>
        <p className={cx('mt-2 text-4xl font-black sm:text-5xl', style.tone)}>{style.title}</p>

        {result.result === 'none' ? (
          <p className="mt-3 text-sm font-medium text-slate-400">점수 변화가 없어요</p>
        ) : (
          <p
            className={cx(
              'mt-3 text-3xl font-black tabular-nums',
              result.delta > 0 ? 'text-real-400' : result.delta < 0 ? 'text-fake-400' : 'text-slate-300',
            )}
          >
            {formatDelta(result.delta)} P
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">현재</p>
        <p className="mt-1 text-4xl font-black tabular-nums text-beam-400">
          {formatPoints(result.scoreAfter)} P
        </p>
      </div>

      {rank !== null && (
        <p className="rounded-full bg-white/10 px-4 py-2 text-base font-bold text-slate-200">
          현재 {rank}위 / {totalStudents}명
        </p>
      )}

      <p className="text-sm text-slate-400">교사 화면에서 해설을 확인하세요.</p>
    </div>
  );
}

/* ───────────── 최종 결과 ───────────── */

export function FinalPanel({
  nickname,
  score,
  rank,
  totalStudents,
}: {
  nickname: string;
  score: number;
  rank: number | null;
  totalStudents: number;
}) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🎓';

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-beam-400">GAME OVER</p>

      <div className="panel-strong animate-pop-in w-full max-w-xs px-6 py-8">
        <p className="text-6xl" aria-hidden="true">
          {medal}
        </p>
        <p className="mt-3 truncate text-2xl font-black text-white">{nickname}</p>
        {rank !== null && (
          <p className="mt-2 text-lg font-bold text-slate-300">
            {rank}위 / {totalStudents}명
          </p>
        )}
        <p className="mt-4 text-4xl font-black tabular-nums text-beam-400">
          {formatPoints(score)} P
        </p>
      </div>

      <p className="max-w-xs text-sm leading-relaxed text-slate-300">
        과학은 정답을 외우는 것에서 시작하지 않습니다.
        <br />
        “정말 그럴까?”라고 질문하는 것에서 시작합니다.
      </p>
    </div>
  );
}
