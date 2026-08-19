import { CircularTimer } from '../game/Timer';
import { Button } from '../common/UI';
import { cx, formatPoints } from '../../lib/utils';
import { CONFIDENCE_OPTIONS } from '../../types/game';

interface ChoicePanelProps {
  remaining: number;
  duration: number;
  progress: number;
  currentScore: number;
  selectedChoice: boolean | null;
  selectedPoints: number | null;
  onSelectChoice: (choice: boolean) => void;
  onSelectPoints: (points: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  timeUp: boolean;
  error: string | null;
}

/**
 * 학생의 선택 화면.
 * 문제 문장은 절대 표시하지 않는다. 학생은 교사 화면을 봐야 한다.
 */
export function ChoicePanel({
  remaining,
  duration,
  progress,
  currentScore,
  selectedChoice,
  selectedPoints,
  onSelectChoice,
  onSelectPoints,
  onSubmit,
  submitting,
  timeUp,
  error,
}: ChoicePanelProps) {
  const canSubmit =
    selectedChoice !== null && selectedPoints !== null && !submitting && !timeUp;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* 안내 + 타이머 */}
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-base font-bold text-slate-300">교사 화면의 문제를 확인하세요.</p>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">남은 시간</p>
        <CircularTimer
          remaining={remaining}
          duration={duration}
          progress={progress}
          size="sm"
        />
      </div>

      {/* 진짜 / 가짜 */}
      <div className="grid grid-cols-1 gap-3">
        <ChoiceButton
          label="진짜"
          symbol="◯"
          tone="real"
          selected={selectedChoice === true}
          disabled={timeUp || submitting}
          onClick={() => onSelectChoice(true)}
        />
        <ChoiceButton
          label="가짜"
          symbol="✕"
          tone="fake"
          selected={selectedChoice === false}
          disabled={timeUp || submitting}
          onClick={() => onSelectChoice(false)}
        />
      </div>

      {/* 확신 포인트 */}
      <div
        className={cx(
          'panel px-4 py-4 transition-opacity',
          selectedChoice === null && 'pointer-events-none opacity-40',
        )}
      >
        <p className="text-center text-lg font-black text-white">얼마나 확신하나요?</p>
        <p className="mt-1 text-center text-xs text-slate-400">
          확신할수록 높은 포인트를 선택하세요
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {CONFIDENCE_OPTIONS.map((points) => {
            const affordable = points <= currentScore;
            const selected = selectedPoints === points;
            const disabled = !affordable || timeUp || submitting || selectedChoice === null;

            return (
              <button
                key={points}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onSelectPoints(points)}
                className={cx(
                  'relative min-h-[64px] rounded-2xl border-2 text-xl font-black transition-colors',
                  selected
                    ? 'border-beam-400 bg-beam-500/25 text-beam-400'
                    : affordable
                      ? 'border-white/15 bg-ink-800/70 text-slate-100 hover:border-white/30'
                      : 'border-white/5 bg-ink-800/40 text-slate-600',
                )}
              >
                {selected && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg" aria-hidden="true">
                    ✓
                  </span>
                )}
                {points}P
                {!affordable && (
                  <span className="mt-0.5 block text-[10px] font-bold text-slate-500">
                    포인트 부족
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-center text-sm font-semibold text-slate-300">
          현재 보유: <span className="text-beam-400">{formatPoints(currentScore)} P</span>
        </p>
      </div>

      {error && (
        <p role="alert" className="text-center text-sm font-bold text-fake-400">
          {error}
        </p>
      )}

      {/* 선택 완료 */}
      <div className="sticky bottom-0 mt-auto pb-2 pt-2">
        <Button size="xl" block onClick={onSubmit} disabled={!canSubmit}>
          {timeUp
            ? '시간이 끝났어요'
            : submitting
              ? '보내는 중...'
              : selectedChoice === null
                ? '진짜 / 가짜를 먼저 선택하세요'
                : selectedPoints === null
                  ? '확신 포인트를 선택하세요'
                  : '선택 완료'}
        </Button>
      </div>
    </div>
  );
}

function ChoiceButton({
  label,
  symbol,
  tone,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  symbol: string;
  tone: 'real' | 'fake';
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const base =
    tone === 'real'
      ? {
          on: 'border-real-400 bg-real-500/30 text-real-400',
          off: 'border-real-500/40 bg-real-500/10 text-real-400',
        }
      : {
          on: 'border-fake-400 bg-fake-500/30 text-fake-400',
          off: 'border-fake-500/40 bg-fake-500/10 text-fake-400',
        };

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'flex min-h-[104px] w-full items-center justify-center gap-3 rounded-3xl border-4 text-4xl font-black transition-all',
        selected ? base.on : base.off,
        selected && 'scale-[1.02] shadow-lg',
        disabled && 'opacity-50',
      )}
    >
      <span aria-hidden="true" className="text-3xl">
        {symbol}
      </span>
      <span>{label}</span>
      {selected && (
        <span className="text-lg font-bold" aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  );
}
