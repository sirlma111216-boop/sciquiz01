import { cx } from '../../lib/utils';

interface TimerProps {
  remaining: number;
  duration: number;
  progress: number;
  /** 교사 화면(프로젝터)은 lg, 학생 화면은 sm */
  size?: 'sm' | 'lg';
}

/**
 * 원형 카운트다운.
 * 5초 이하가 되면 색이 바뀌고 부드럽게 커졌다 작아진다.
 */
export function CircularTimer({ remaining, duration, progress, size = 'sm' }: TimerProps) {
  const urgent = remaining <= 5 && remaining > 0;
  const finished = remaining <= 0;

  const dimension = size === 'lg' ? 224 : 128;
  const stroke = size === 'lg' ? 14 : 10;
  const radius = (dimension - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * Math.min(1, Math.max(0, progress));

  const ringColor = finished
    ? 'stroke-slate-600'
    : urgent
      ? 'stroke-fake-500'
      : 'stroke-beam-500';

  const textColor = finished ? 'text-slate-500' : urgent ? 'text-fake-400' : 'text-white';

  return (
    <div
      className={cx('relative shrink-0', urgent && 'animate-soft-pulse')}
      style={{ width: dimension, height: dimension }}
      role="timer"
      aria-live="off"
      aria-label={`남은 시간 ${Math.max(0, remaining)}초`}
    >
      <svg width={dimension} height={dimension} className="-rotate-90">
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          strokeWidth={stroke}
          className="fill-none stroke-white/10"
        />
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={cx('fill-none transition-[stroke-dashoffset] duration-150 ease-linear', ringColor)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cx(
            'font-black tabular-nums leading-none',
            size === 'lg' ? 'text-7xl' : 'text-4xl',
            textColor,
          )}
        >
          {Math.max(0, remaining)}
        </span>
        {size === 'lg' && (
          <span className="mt-2 text-sm font-semibold uppercase tracking-widest text-slate-400">
            초
          </span>
        )}
      </div>
      <span className="sr-only">{`제한 시간 ${duration}초 중 ${Math.max(0, remaining)}초 남음`}</span>
    </div>
  );
}
