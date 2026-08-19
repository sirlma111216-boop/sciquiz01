import { CircularTimer } from '../game/Timer';
import { Button } from '../common/UI';
import { difficultyStars } from '../../lib/utils';
import type { Question } from '../../types/game';

interface QuestionStageProps {
  question: Question;
  roundNumber: number;
  totalRounds: number;
  remaining: number;
  duration: number;
  progress: number;
  submittedCount: number;
  totalStudents: number;
  restingCount: number;
  locked: boolean;
  onLockNow: () => void;
}

/**
 * 교사 화면의 문제 표시.
 * 교실 뒤에서도 읽을 수 있도록 문장을 아주 크게 보여 준다.
 * 진행 중에는 제출 인원만 보여 주고 어느 쪽을 골랐는지는 절대 공개하지 않는다.
 */
export function QuestionStage({
  question,
  roundNumber,
  totalRounds,
  remaining,
  duration,
  progress,
  submittedCount,
  totalStudents,
  restingCount,
  locked,
  onLockNow,
}: QuestionStageProps) {
  const expected = Math.max(0, totalStudents - restingCount);

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* 머리말 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-beam-500/20 px-4 py-1.5 text-base font-black tracking-wide text-beam-400 sm:text-lg">
            QUESTION {String(roundNumber).padStart(2, '0')} / {totalRounds}
          </span>
          <span className="rounded-full bg-white/10 px-4 py-1.5 text-base font-bold text-slate-200 sm:text-lg">
            {question.category}
          </span>
          <span
            className="rounded-full bg-white/10 px-4 py-1.5 text-base font-bold text-spark-400 sm:text-lg"
            aria-label={`난이도 ${question.difficulty}단계`}
          >
            {difficultyStars(question.difficulty)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">제출</p>
            <p className="text-2xl font-black tabular-nums text-white sm:text-3xl">
              {submittedCount} <span className="text-slate-500">/ {expected}</span>
            </p>
          </div>
        </div>
      </div>

      {/* 문제 문장 */}
      <div className="panel-strong flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10 text-center sm:px-12">
        <p className="teacher-statement font-black text-white">{question.statement}</p>

        <div className="flex flex-col items-center gap-6">
          <p className="text-2xl font-bold text-slate-300 sm:text-4xl">
            <span className="text-real-400">진짜</span>일까?{' '}
            <span className="text-fake-400">가짜</span>일까?
          </p>
          <CircularTimer
            remaining={remaining}
            duration={duration}
            progress={progress}
            size="lg"
          />
        </div>
      </div>

      {/* 아래 안내 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-400">
          학생 휴대전화에는 문제 문장이 보이지 않습니다. 화면을 읽어 주세요.
          {restingCount > 0 && (
            <span className="ml-2 text-spark-400">
              과학 에너지 충전 중 {restingCount}명은 이번 문제를 쉽니다.
            </span>
          )}
        </p>
        <Button variant="secondary" onClick={onLockNow} disabled={locked}>
          {locked ? '마감됨' : '지금 마감하기'}
        </Button>
      </div>
    </div>
  );
}

/** 정답 공개 직전의 짧은 긴장감 화면 */
export function SuspenseStage() {
  return (
    <div className="panel-strong flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="animate-soft-pulse font-black text-white [font-size:clamp(2.5rem,8vw,6rem)]">
        정답은...
      </p>
      <p className="text-lg font-semibold text-slate-400">잠시 후 공개됩니다</p>
    </div>
  );
}
